import { getAddress, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { USDCE } from './chain'

export type HeraldAccept = {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds?: number
  extra?: { name?: string; version?: string }
}

export type X402Resource = { url: string; description?: string; mimeType?: string }

export type PaymentPayload = {
  x402Version: 2
  resource: X402Resource
  accepted: HeraldAccept
  payload: {
    signature: string
    authorization: {
      from: string
      to: string
      value: string
      validAfter: string
      validBefore: string
      nonce: string
    }
  }
}

const TRANSFER_WITH_AUTHORIZATION = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const

export async function signExactEip3009(opts: {
  privateKey: string
  from: string
  accept: HeraldAccept
  resourceUrl: string
  resource?: X402Resource
}): Promise<PaymentPayload> {
  const account = privateKeyToAccount(opts.privateKey as `0x${string}`)
  if (account.address.toLowerCase() !== opts.from.toLowerCase()) {
    throw new Error('Session key does not match authorized session address')
  }
  const name = opts.accept.extra?.name
  const version = opts.accept.extra?.version
  if (!name || !version) {
    throw new Error('Herald accept is missing EIP-712 name/version for Bridged USDC')
  }
  const resourceUrl = opts.resource?.url || opts.resourceUrl
  if (!resourceUrl || /router\.heraldprotocol\.xyz/i.test(resourceUrl)) {
    throw new Error('Payment resource.url must be the seller destination, not the Herald router')
  }
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const now = Math.floor(Date.now() / 1000)
  const validAfter = '0'
  const windowSec = Math.max(opts.accept.maxTimeoutSeconds ?? 300, 900)
  const validBefore = String(now + windowSec)
  const from = getAddress(opts.from)
  const to = getAddress(opts.accept.payTo)
  const verifyingContract = getAddress(opts.accept.asset || USDCE)
  let signature = await account.signTypedData({
    domain: {
      name,
      version,
      chainId: 16661,
      verifyingContract,
    },
    types: { TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION },
    primaryType: 'TransferWithAuthorization',
    message: {
      from,
      to,
      value: BigInt(opts.accept.amount),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    },
  })
  const v = Number.parseInt(signature.slice(130, 132), 16)
  if (v === 0 || v === 1) {
    signature = (`0x${signature.slice(2, 130)}${(v + 27).toString(16).padStart(2, '0')}`) as `0x${string}`
  }
  return {
    x402Version: 2,
    resource: {
      url: resourceUrl,
      description: opts.resource?.description ?? '',
      mimeType: opts.resource?.mimeType ?? '',
    },
    accepted: opts.accept,
    payload: {
      signature,
      authorization: {
        from,
        to,
        value: opts.accept.amount,
        validAfter,
        validBefore,
        nonce,
      },
    },
  }
}
