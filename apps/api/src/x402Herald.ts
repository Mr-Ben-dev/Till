import { x402Client, x402HTTPClient } from '@x402/core/client'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { wrapFetchWithPayment } from '@x402/fetch'
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

export async function settleWithPaymentPayload(
  destination: string,
  payment: PaymentPayload
): Promise<{ status: number; body: unknown; settlement: unknown }> {
  const from = payment.payload?.authorization?.from
  if (!from) throw new Error('PAYMENT-SIGNATURE missing authorization.from')
  const url = routerUrl(destination)
  const normalized = withDestinationResource(payment, destination)
  const encoded = Buffer.from(JSON.stringify(normalized)).toString('base64')
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'PAYMENT-SIGNATURE': encoded,
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
  const settleHdr = res.headers.get('PAYMENT-RESPONSE') ?? res.headers.get('payment-response')
  let settlement: unknown = settleHdr
    ? (() => {
        try {
          return JSON.parse(Buffer.from(settleHdr, 'base64').toString('utf8'))
        } catch {
          return { paymentResponse: settleHdr }
        }
      })()
    : null
  if (res.status === 402) {
    const reason =
      settlement && typeof settlement === 'object'
        ? JSON.stringify(settlement).slice(0, 400)
        : text.slice(0, 240)
    throw new Error(`FAILED_HERALD: still 402 after session payment for ${destination}: ${reason}`)
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
    throw new Error(`Herald paid fetch HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  return { status: res.status, body, settlement }
}
