import { x402Client, x402HTTPClient } from '@x402/core/client'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { encodeFunctionData, getAddress, parseSignature } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { requireEnv } from '@till/sdk'

export const HERALD_ROUTER = 'https://router.heraldprotocol.xyz/route/x402'
export const USDCE_16661 = '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e'
export const OG_CAIP = 'eip155:16661'

export type HeraldAccept = {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds?: number
  extra?: { name?: string; version?: string; verifyingContract?: string }
}

export type HeraldQuote = {
  destination: string
  seller: string
  description: string
  network: string
  asset: string
  assetName: string
  amount: string
  amountUsd: number
  payTo: string
  router: string
  extraName?: string
  extraVersion?: string
  scheme?: string
}

function routerUrl(destination: string) {
  return `${HERALD_ROUTER}?url=${encodeURIComponent(destination)}`
}

function amountUsd(atomic: string) {
  return Number(atomic) / 1e6
}

export async function quoteHerald(destination: string, seller: string): Promise<HeraldQuote> {
  const url = routerUrl(destination)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const hdr = res.headers.get('PAYMENT-REQUIRED') ?? res.headers.get('payment-required') ?? ''
  if (res.status !== 402 || !hdr) {
    throw new Error(`Herald ${res.status} for ${destination} (expected 402 with PAYMENT-REQUIRED)`)
  }
  const parsed = JSON.parse(Buffer.from(hdr, 'base64').toString('utf8')) as {
    resource?: { description?: string }
    accepts?: {
      scheme?: string
      network?: string
      amount?: string
      asset?: string
      payTo?: string
      extra?: { name?: string; version?: string; verifyingContract?: string }
    }[]
  }
  const og =
    parsed.accepts?.filter(
      (a) =>
        a.network === OG_CAIP &&
        a.asset?.toLowerCase() === USDCE_16661.toLowerCase() &&
        !a.extra?.verifyingContract
    ) ?? []
  const pick = og[0] ?? parsed.accepts?.find((a) => a.network === OG_CAIP && !a.extra?.verifyingContract)
  if (!pick?.amount || !pick.payTo || !pick.asset) {
    throw new Error(`No eip155:16661 USDC.e Exact option in Herald accepts for ${destination}`)
  }
  return {
    destination,
    seller,
    description: parsed.resource?.description ?? seller,
    network: pick.network!,
    asset: pick.asset,
    assetName: pick.extra?.name ?? 'USDC.e',
    amount: pick.amount,
    amountUsd: amountUsd(pick.amount),
    payTo: pick.payTo,
    router: url,
    extraName: pick.extra?.name,
    extraVersion: pick.extra?.version,
    scheme: pick.scheme ?? 'exact',
  }
}

export type X402Resource = { url: string; description?: string; mimeType?: string }

export function sellerResourceUrl(destination: string, resource?: { url?: string } | null): string {
  const url = resource?.url?.trim() || destination
  if (/router\.heraldprotocol\.xyz/i.test(url)) return destination
  return url
}

export const HERALD_PAYTO = '0x686Ca1f3BAf7F7Df3334f2f1A65AE314ee9CDb29'

export const HERALD_ROUTER_BLOCKER =
  'FAILED_HERALD_ROUTER: Herald router did not dest-settle this seller from Aristotle. ' +
  'Live Base sellers either try to execute the 16661 PAYMENT-SIGNATURE as Base USDC, or the router dest-wallet cannot complete outbound USDC. ' +
  'No public x402 seller currently advertises eip155:16661 natively. ' +
  'Herald facilitator POST /verify and /settle on 16661 succeed independently. ' +
  'Till will not self-settle inbound USDC.e without a seller 200 (funds would sit at Herald payTo with no SKU).'

export function describeHerald402Failure(required: unknown): string | null {
  const parsed = required as {
    error?: string
    accepts?: { network?: string; payTo?: string }[]
    resource?: { url?: string }
  } | null
  if (!parsed || typeof parsed !== 'object') return null
  const accepts = parsed.accepts ?? []
  const destNative = accepts.some(
    (a) =>
      a.network === 'eip155:8453' &&
      a.payTo &&
      a.payTo.toLowerCase() !== HERALD_PAYTO.toLowerCase()
  )
  const ogHerald = accepts.some(
    (a) => a.network === OG_CAIP && a.payTo?.toLowerCase() === HERALD_PAYTO.toLowerCase()
  )
  const destResource = /https?:\/\//i.test(parsed.resource?.url || '') &&
    !/router\.heraldprotocol\.xyz/i.test(parsed.resource?.url || '')
  const destHopFail = /execution reverted|invalid_payload|insufficient_balance|facilitator_error/i.test(
    parsed.error || ''
  )
  if ((destNative && !ogHerald) || (destHopFail && (destNative || destResource))) {
    return HERALD_ROUTER_BLOCKER
  }
  return null
}

export function withDestinationResource(payment: PaymentPayload, destination: string): PaymentPayload {
  const url = sellerResourceUrl(destination, payment.resource)
  return {
    ...payment,
    x402Version: payment.x402Version ?? 2,
    resource: {
      url,
      description: payment.resource?.description,
      mimeType: payment.resource?.mimeType,
    },
  }
}

export async function quoteAccept(destination: string): Promise<{
  resourceUrl: string
  resource: X402Resource
  accept: HeraldAccept
  description: string
}> {
  const url = routerUrl(destination)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const hdr = res.headers.get('PAYMENT-REQUIRED') ?? res.headers.get('payment-required') ?? ''
  if (res.status !== 402 || !hdr) {
    throw new Error(`FAILED_HERALD: expected 402 PAYMENT-REQUIRED for ${destination}, got ${res.status}`)
  }
  const parsed = JSON.parse(Buffer.from(hdr, 'base64').toString('utf8')) as {
    resource?: X402Resource
    accepts?: HeraldAccept[]
  }
  const pick =
    parsed.accepts?.find(
      (a) =>
        a.network === OG_CAIP &&
        a.asset?.toLowerCase() === USDCE_16661.toLowerCase() &&
        !a.extra?.verifyingContract
    )
  if (!pick) throw new Error(`FAILED_HERALD: no 16661 USDC.e Exact accept for ${destination}`)
  const resourceUrl = sellerResourceUrl(destination, parsed.resource)
  return {
    resourceUrl,
    resource: {
      url: resourceUrl,
      description: parsed.resource?.description ?? '',
      mimeType: parsed.resource?.mimeType ?? '',
    },
    accept: pick,
    description: parsed.resource?.description ?? '',
  }
}

export type PaymentPayload = {
  x402Version?: number
  resource?: { url?: string; description?: string; mimeType?: string }
  accepted?: HeraldAccept
  payload?: {
    signature?: string
    authorization?: {
      from?: string
      to?: string
      value?: string
      validAfter?: string
      validBefore?: string
      nonce?: string
    }
  }
}

function decodeX402Header(res: Response, name: string): unknown {
  const raw = res.headers.get(name) ?? res.headers.get(name.toLowerCase())
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return { raw: raw.slice(0, 120) }
  }
}

function ecdsaV27(signature: string): string {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return signature
  const body = signature.slice(2, 130)
  let v = Number.parseInt(signature.slice(130, 132), 16)
  if (v === 0 || v === 1) v += 27
  return `0x${body}${v.toString(16).padStart(2, '0')}`
}

const TWA_VRS_ABI = [
  {
    type: 'function',
    name: 'transferWithAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

async function rpcCall(data: string): Promise<{ result?: string; error?: { message?: string } }> {
  const r = await fetch(requireEnv('OG_RPC_URL'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: USDCE_16661, data, from: '0x686Ca1f3BAf7F7Df3334f2f1A65AE314ee9CDb29' }, 'latest'],
    }),
  })
  return (await r.json()) as { result?: string; error?: { message?: string } }
}

async function usdceBalance(address: string): Promise<bigint> {
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`
  const j = await rpcCall(data)
  return j.result ? BigInt(j.result) : 0n
}

async function simulateSessionTwa(payment: PaymentPayload): Promise<string> {
  const auth = payment.payload?.authorization
  const signature = payment.payload?.signature
  if (!auth?.from || !auth.to || !auth.value || !auth.nonce || !signature) return 'missing-payload'
  const parsed = parseSignature(ecdsaV27(signature) as `0x${string}`)
  const v = Number(parsed.v ?? 27n + BigInt(parsed.yParity ?? 0))
  const data = encodeFunctionData({
    abi: TWA_VRS_ABI,
    functionName: 'transferWithAuthorization',
    args: [
      getAddress(auth.from),
      getAddress(auth.to),
      BigInt(auth.value),
      BigInt(auth.validAfter ?? '0'),
      BigInt(auth.validBefore ?? '0'),
      auth.nonce as `0x${string}`,
      v,
      parsed.r,
      parsed.s,
    ],
  })
  const j = await rpcCall(data)
  if (j.result === '0x' || j.result === '0x0') return 'ok'
  return j.error?.message || j.result || 'unknown'
}

export async function settleWithPaymentPayload(
  destination: string,
  payment: PaymentPayload
): Promise<{ status: number; body: unknown; settlement: unknown }> {
  const from = payment.payload?.authorization?.from
  if (!from) throw new Error('PAYMENT-SIGNATURE missing authorization.from')
  const url = routerUrl(destination)
  const client = new x402Client((_version, accepts) => {
    const og = accepts.filter(
      (a) => a.network === OG_CAIP && a.asset?.toLowerCase() === USDCE_16661.toLowerCase()
    )
    return og.find((a) => !a.extra?.verifyingContract) ?? og[0] ?? accepts[0]
  })
  client.registerPolicy((_version, requirements) =>
    requirements.filter(
      (r) =>
        r.network === OG_CAIP &&
        !(r.extra as { verifyingContract?: string } | undefined)?.verifyingContract
    )
  )
  client.setSpendControls({
    allowedAssets: [{ network: OG_CAIP, asset: USDCE_16661, maxAmountPerPayment: '500000' }],
  })
  client.register(OG_CAIP, {
    scheme: 'exact',
    createPaymentPayload: async (x402Version: number, requirements: HeraldAccept) => {
      const auth = payment.payload?.authorization
      const signature = payment.payload?.signature
      if (!auth || !signature) throw new Error('PAYMENT-SIGNATURE missing payload')
      if (auth.value !== requirements.amount) {
        throw new Error(
          `FAILED_HERALD: signed amount ${auth.value} != live quote ${requirements.amount}`
        )
      }
      if (!auth.to || auth.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
        throw new Error(`FAILED_HERALD: signed payTo ${auth.to} != live ${requirements.payTo}`)
      }
      return {
        x402Version,
        payload: {
          signature: ecdsaV27(signature),
          authorization: {
            ...auth,
            from: getAddress(auth.from),
            to: getAddress(auth.to),
          },
        },
      }
    },
  } as never)
  const need = BigInt(payment.payload?.authorization?.value ?? '0')
  let localBal = 0n
  const waitUntil = Date.now() + 20_000
  while (Date.now() < waitUntil) {
    localBal = await usdceBalance(from)
    if (localBal >= need) break
    await new Promise((r) => setTimeout(r, 1500))
  }
  const localSim = await simulateSessionTwa(payment)
  if (localSim !== 'ok' && !/exceeds balance/i.test(localSim)) {
    throw new Error(
      `FAILED_HERALD: local transferWithAuthorization reverted before Herald (${localSim}); drawer=${localBal} need=${need}`
    )
  }
  if (localBal < need) {
    throw new Error(`FAILED_HERALD: session drawer ${localBal} < ${need} at settle for ${from}`)
  }
  const paidFetch = wrapFetchWithPayment(fetch, client)
  let res = await paidFetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 Till/1.0',
    },
  })
  if (res.status === 402 && localSim === 'ok') {
    await new Promise((r) => setTimeout(r, 2000))
    res = await paidFetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 Till/1.0',
      },
    })
  }
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* keep text */
  }
  const settlement = decodeX402Header(res, 'PAYMENT-RESPONSE')
  if (res.status === 402) {
    const required = decodeX402Header(res, 'PAYMENT-REQUIRED')
    const routerFail = describeHerald402Failure(required)
    if (routerFail) {
      throw new Error(`${routerFail} dest=${destination} localSim=${localSim} drawer=${localBal}`)
    }
    const reason = JSON.stringify(required ?? settlement ?? body).slice(0, 400)
    throw new Error(
      `FAILED_HERALD: still 402 after session payment for ${destination}: ${reason} localSim=${localSim} drawer=${localBal}`
    )
  }
  if (!res.ok) {
    throw new Error(`FAILED_HERALD: HTTP ${res.status} for ${destination}: ${text.slice(0, 400)}`)
  }
  return { status: res.status, body, settlement }
}

export async function payHerald(destination: string, maxAtomic = process.env.TILL_USDCE_MAX_ATOMIC ?? '500000'): Promise<{
  status: number
  body: unknown
  settlement: unknown
}> {
  const pk = requireEnv('DEPLOYER_PRIVATE_KEY') as `0x${string}`
  const signer = privateKeyToAccount(pk)
  const client = new x402Client((_version, accepts) => {
    const og = accepts.filter(
      (a) => a.network === OG_CAIP && a.asset?.toLowerCase() === USDCE_16661.toLowerCase()
    )
    // Prefer EIP-3009 (no verifyingContract). The 0x7777 extra is CDP/Permit2 and
    // Herald's 16661 facilitator rejects that payload (CDP 400).
    return og.find((a) => !a.extra?.verifyingContract) ?? og[0] ?? accepts[0]
  })
  client.registerPolicy((_version, requirements) =>
    requirements.filter(
      (r) =>
        r.network === OG_CAIP &&
        !(r.extra as { verifyingContract?: string } | undefined)?.verifyingContract
    )
  )
  client.setSpendControls({
    allowedAssets: [
      {
        network: OG_CAIP,
        asset: USDCE_16661,
        maxAmountPerPayment: maxAtomic,
      },
    ],
  })
  client.register(
    OG_CAIP,
    new ExactEvmScheme(signer, { rpcUrl: requireEnv('OG_RPC_URL') })
  )
  const paidFetch = wrapFetchWithPayment(fetch, client)
  const res = await paidFetch(routerUrl(destination), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 Till/1.0',
    },
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* keep text */
  }
  let settlement: unknown = null
  try {
    const http = new x402HTTPClient(client)
    settlement = http.getPaymentSettleResponse((name) => res.headers.get(name))
  } catch {
    settlement = { paymentResponse: res.headers.get('PAYMENT-RESPONSE') ?? res.headers.get('payment-response') }
  }
  if (!res.ok) {
    const required = decodeX402Header(res, 'PAYMENT-REQUIRED')
    const routerFail = describeHerald402Failure(required)
    if (routerFail) throw new Error(`${routerFail} dest=${destination}`)
    throw new Error(`Herald paid fetch HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  return { status: res.status, body, settlement }
}
