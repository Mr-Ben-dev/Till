import { formatEther, type BigNumberish } from 'ethers'

export function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}

export function fmt0g(wei: BigNumberish) {
  const v = formatEther(wei)
  const [i, f = ''] = v.split('.')
  return `${i}.${f.slice(0, 4)} 0G`
}

export function explorerWait(hash: string) {
  return hash
}

export function decodeErr(e: unknown): string {
  if (!e) return 'Something went wrong.'
  if (typeof e === 'string') return e
  const err = e as {
    shortMessage?: string
    reason?: string
    message?: string
    code?: string | number
    info?: { error?: { message?: string; code?: number } }
    data?: string
  }
  const custom = String(err.data ?? '')
  const blob = `${err.shortMessage ?? ''} ${err.message ?? ''} ${err.info?.error?.message ?? ''}`.toLowerCase()
  if (
    err.code === 4001 ||
    err.code === 'ACTION_REJECTED' ||
    err.info?.error?.code === 4001 ||
    blob.includes('user rejected') ||
    blob.includes('user denied')
  ) {
    return 'You cancelled in the wallet. Nothing moved.'
  }
  const map: Record<string, string> = {
    CapExceeded: 'Your per-transaction limit is lower than this amount.',
    WindowExceeded: 'This would exceed the rolling budget.',
    Paused: 'This Till is paused. Unpause to let the agent spend again.',
    NonceUsed: 'This payment id was already used. Try again.',
    NotAuthorizedExecutor: 'This wallet is not allowed to spend from this Till.',
    OnlyOwner: 'Only you, the Till owner, can do this.',
    InsufficientAvailable: 'Not enough unlocked 0G in the Till.',
    TargetNotAllowed: 'This payee is not on your allowlist.',
    ResourceNotAllowed: 'This resource is not on your allowlist.',
    SessionExpired: 'This policy window expired. Write a new policy.',
    UnknownTeeSigner: '0G Compute signer is not registered for this Till.',
    DigestNotInResponse: 'TEE attestation does not bind this spend.',
    DecisionDenied: 'The model did not allow this spend.',
  }
  for (const [k, v] of Object.entries(map)) {
    if (custom.includes(k) || (err.shortMessage ?? err.message ?? '').includes(k)) return v
  }
  if (err.info?.error?.message) return err.info.error.message
  if (blob.includes('coalesce')) {
    return 'This wallet is not on 0G Aristotle (16661). Switch network, then retry.'
  }
  if (blob.includes('failed to fetch') || blob.includes('networkerror')) {
    return 'Payment and proof services are offline. You can still create, fund, and set policy.'
  }
  return err.shortMessage || err.reason || err.message || 'The transaction did not complete.'
}
