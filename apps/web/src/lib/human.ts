import { decodeErr } from './errors'

export function humanError(e: unknown): string {
  const raw = decodeErr(e)
  const blob = raw.toLowerCase()
  if (blob.includes('4001') || blob.includes('user rejected') || blob.includes('rejected the')) {
    return 'You cancelled in the wallet. Nothing moved.'
  }
  if (blob.includes('wallet is not installed') || blob.includes('no injected')) {
    return 'No wallet found. Install one, or continue with email in Privy.'
  }
  if (blob.includes('backend unavailable') || blob.includes(':3001') || blob.includes('failed to fetch')) {
    return 'Payment and proof services are offline. You can still create, fund, and set policy.'
  }
  if (blob.includes('create a till first')) return 'Create a Till first. Then this action unlocks.'
  if (blob.includes('coalesce') || blob.includes('switch to 0g')) {
    return 'This wallet is not on 0G Aristotle (16661). Switch network, then retry.'
  }
  return raw
}

export const POLICY_TEMPLATES = [
  {
    id: 'conservative',
    name: 'Conservative',
    max: '0.05',
    window: '0.20',
    why: '$0.05 equivalent per purchase · $0.20 rolling. Approved service categories only.',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    max: '0.10',
    window: '0.50',
    why: '$0.10 per purchase · $0.50 rolling. Default for one investigation.',
  },
  {
    id: 'custom',
    name: 'Custom',
    max: '0.05',
    window: '0.20',
    why: 'You set max per purchase, rolling spend, and session length.',
  },
] as const

export const ONBOARD = [
  { id: 'connect', label: 'Connect' },
  { id: 'create', label: 'Create' },
  { id: 'policy', label: 'Budget' },
  { id: 'fund', label: 'Fund' },
  { id: 'agent', label: 'Session' },
  { id: 'test', label: 'Test' },
  { id: 'live', label: 'Live' },
] as const

export function sessionStatus(opts: {
  paused: boolean
  authorized: string[]
  agentOf: { address: string } | null
  agentGas: bigint
  sessionExpiresAt: bigint
  skipped?: boolean
}) {
  const now = Math.floor(Date.now() / 1000)
  if (opts.paused) return 'PAUSED'
  if (opts.skipped && !opts.authorized.length) return 'OWNER_MODE'
  if (opts.agentOf && !opts.authorized.some((a) => a.toLowerCase() === opts.agentOf!.address.toLowerCase())) return 'REVOKED'
  if (!opts.authorized.length) return 'OWNER_MODE'
  if (opts.sessionExpiresAt > 0n && Number(opts.sessionExpiresAt) < now) return 'EXPIRED'
  if (!opts.agentOf) return 'NOT_ON_THIS_DEVICE'
  if (opts.agentGas === 0n) return 'NOT_FUNDED'
  return 'READY'
}
