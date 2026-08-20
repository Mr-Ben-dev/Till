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
    id: 'careful',
    name: 'Careful',
    max: '0.01',
    window: '0.05',
    why: 'Small tests. Hard to overspend.',
  },
  {
    id: 'daily',
    name: 'Daily work',
    max: '0.05',
    window: '0.2',
    why: 'Covers one investigation and a few more jobs.',
  },
  {
    id: 'wide',
    name: 'Wide cap',
    max: '0.1',
    window: '0.5',
    why: 'Still capped. You can tighten later.',
  },
] as const

export const ONBOARD = [
  { id: 'connect', label: 'Connect' },
  { id: 'create', label: 'Create' },
  { id: 'policy', label: 'Budget' },
  { id: 'fund', label: 'Fund' },
  { id: 'agent', label: 'Permit' },
  { id: 'test', label: 'Test' },
  { id: 'live', label: 'Live' },
] as const
