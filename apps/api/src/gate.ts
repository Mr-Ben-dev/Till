import { ethers } from 'ethers'
import { NFT_ABI, POLICY_ABI, OG_RPC_URL } from '@till/config'
import { USDCE_16661 } from './x402Herald.js'

const CAP = BigInt(process.env.TILL_USDCE_MAX_ATOMIC ?? '500000')

export class GateError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function provider() {
  return new ethers.JsonRpcProvider(OG_RPC_URL)
}

export async function usdceBalance(addr: string) {
  const c = new ethers.Contract(USDCE_16661, ['function balanceOf(address) view returns (uint256)'], provider())
  const raw = (await c.balanceOf(addr)) as bigint
  return { atomic: raw, usd: Number(raw) / 1e6 }
}

export async function assertMissionGate(opts: {
  owner: string
  tokenId: string
  session?: string
  quoteAtomic?: bigint
}) {
  const nft = process.env.TILL_AGENT_NFT
  const policy = process.env.TILL_POLICY
  if (!nft || !policy) throw new GateError('CONFIG', 'Till contracts are not configured')
  const p = provider()
  const n = new ethers.Contract(nft, NFT_ABI, p)
  const pol = new ethers.Contract(policy, POLICY_ABI, p)
  const tokenId = BigInt(opts.tokenId)
  const owner = await n.ownerOf(tokenId)
  if (String(owner).toLowerCase() !== ethers.getAddress(opts.owner).toLowerCase()) {
    throw new GateError('WRONG_TILL', 'This wallet does not own this Till')
  }
  const rec = await pol.policyOf(tokenId)
  if (rec.paused) throw new GateError('PAUSED', 'This Till is paused. Mission settlement is refused.')
  const exp = Number(rec.sessionExpiresAt)
  if (exp && exp < Math.floor(Date.now() / 1000)) {
    throw new GateError('EXPIRED', 'Session expired. Mission settlement is refused.')
  }
  if (opts.session) {
    const ok = await n.isUsageAuthorized(tokenId, opts.session)
    if (!ok) throw new GateError('REVOKED', 'Session is not authorized. Mission settlement is refused.')
    if (opts.quoteAtomic != null && opts.quoteAtomic > 0n) {
      const drawer = await usdceBalance(opts.session)
      if (drawer.atomic > CAP) {
        throw new GateError(
          'DRAWER_OVER',
          `Session drawer holds ${drawer.usd} USDC.e which exceeds the $0.50 hard max. Sweep before execute.`,
        )
      }
      const slack = opts.quoteAtomic > 20_000n ? (opts.quoteAtomic * 5n) / 100n : 20_000n
      const allowedIdle = opts.quoteAtomic + slack
      if (drawer.atomic > allowedIdle) {
        throw new GateError(
          'DRAWER_IDLE',
          `Session drawer leftover ${drawer.usd} USDC.e is above this mission quote. Sweep, then fund the quote.`,
        )
      }
      if (drawer.atomic < opts.quoteAtomic) {
        throw new GateError(
          'UNDERFUNDED_DRAWER',
          `Session drawer has ${drawer.usd} USDC.e; this mission needs ${(Number(opts.quoteAtomic) / 1e6).toFixed(3)}.`,
        )
      }
    }
  }
  return { owner: String(owner), capAtomic: CAP.toString() }
}
