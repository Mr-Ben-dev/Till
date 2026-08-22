import type { TillState } from '../hooks/useTill'
import { POLICY_TEMPLATES } from './human'
import { parseEther } from 'ethers'

export type SetupItem = {
  id: 'created' | 'policy' | 'fund' | 'agent' | 'mission'
  label: string
  done: boolean
  to: string
}

export function setupItems(till: TillState): SetupItem[] {
  const agentDone = till.authorized.length > 0 || till.agentSkipped
  return [
    { id: 'created', label: 'Till created', done: till.tokenId != null, to: '/till' },
    { id: 'policy', label: 'Set protection', done: till.hasPolicy, to: '/till/policy' },
    { id: 'fund', label: 'Add funds', done: till.available > 0n, to: '/till/policy' },
    { id: 'agent', label: 'Enable agent', done: agentDone, to: '/till/agent' },
    { id: 'mission', label: 'Run first mission', done: Boolean(till.lastBrief), to: '/till/mission' },
  ]
}

export function setupReady(till: TillState) {
  return till.hasPolicy && till.available > 0n && (till.authorized.length > 0 || till.agentSkipped)
}

export function policyPresetName(maxTxWei: bigint, windowWei: bigint) {
  if (maxTxWei === 0n) return 'Not set'
  const hit = POLICY_TEMPLATES.find(
    (t) => t.id !== 'custom' && parseEther(t.max) === maxTxWei && parseEther(t.window) === windowWei
  )
  return hit?.name ?? 'Custom'
}
