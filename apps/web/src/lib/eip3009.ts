import { Wallet, getBytes, hexlify, randomBytes } from 'ethers'
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

export type PaymentPayload = {
  x402Version: 2
  resource: { url: string }
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

export async function signExactEip3009(opts: {
  privateKey: string
  from: string
  accept: HeraldAccept
  resourceUrl: string
}): Promise<PaymentPayload> {
  const wallet = new Wallet(opts.privateKey)
  if (wallet.address.toLowerCase() !== opts.from.toLowerCase()) {
    throw new Error('Session key does not match authorized session address')
  }
  const nonce = hexlify(randomBytes(32))
  const validAfter = '0'
  const validBefore = String(Math.floor(Date.now() / 1000) + 300)
  const domain = {
    name: opts.accept.extra?.name || 'Bridged USDC',
    version: opts.accept.extra?.version || '2',
    chainId: 16661,
    verifyingContract: opts.accept.asset || USDCE,
  }
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  }
  const message = {
    from: opts.from,
    to: opts.accept.payTo,
    value: opts.accept.amount,
    validAfter,
    validBefore,
    nonce,
  }
  const signature = await wallet.signTypedData(domain, types, message)
  void getBytes(signature)
  return {
    x402Version: 2,
    resource: { url: opts.resourceUrl },
    accepted: opts.accept,
    payload: {
      signature,
      authorization: {
        from: opts.from,
        to: opts.accept.payTo,
        value: opts.accept.amount,
        validAfter,
        validBefore,
        nonce,
      },
    },
  }
}
