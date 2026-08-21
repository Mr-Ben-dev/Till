import { autoWhy, ownerWhy, type SignKind } from '../../lib/signCopy'

export function SignHint({ kind, write, why }: { kind: SignKind; write?: string; why?: string }) {
  if (kind !== 'owner' && kind !== 'auto') return null
  const body = why || (kind === 'owner' ? ownerWhy(write ?? '') : autoWhy(write ?? ''))
  return (
    <p className={`sign-hint sign-hint--${kind}`} role="status">
      <strong>{kind === 'owner' ? 'Owner approval required' : 'Autonomous — no wallet signature required'}</strong>
      {body}
    </p>
  )
}
