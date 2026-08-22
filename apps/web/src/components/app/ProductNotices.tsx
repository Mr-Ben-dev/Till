import { CyanButton } from '../CyanButton'
import { DenialCard } from './DenialCard'
import { Notice } from './Notice'
import { autoWhy, ownerWhy } from '../../lib/signCopy'
import type { TillState } from '../../hooks/useTill'

export function ProductNotices({ till, hideDenial = false }: { till: TillState; hideDenial?: boolean }) {
  return (
    <div className="grid gap-3">
      {till.backend === 'down' && (
        <Notice
          tone="info"
          title="Work services are offline"
          body="You can still create a Till, write policy, and fund. Private work waits until the service is back."
        />
      )}
      {till.wrongNetwork && (
        <Notice
          tone="info"
          title="Switch to 0G Mainnet"
          body="Till only spends on 0G Aristotle (chain 16661)."
          action={
            <CyanButton disabled={till.writeLocked} onClick={till.switchNetwork}>
              Switch network
            </CyanButton>
          }
        />
      )}
      {till.error && <Notice tone="danger" title="Stopped" body={till.error} />}
      {till.loadError && <Notice tone="danger" title="This Till could not be loaded" body={till.loadError} />}
      {till.busy && (
        <Notice
          tone="ok"
          title={
            till.signKind === 'auto'
              ? 'Autonomous — no wallet signature required'
              : till.signKind === 'owner'
                ? 'Owner approval required'
                : till.busy
          }
          body={
            till.signKind === 'auto'
              ? autoWhy(till.lastWrite)
              : till.signKind === 'owner'
                ? `${ownerWhy(till.lastWrite)} ${till.writePhase === 'waiting' ? 'Waiting for the Aristotle receipt.' : till.writePhase === 'submitted' ? 'Submitted. Do not click again.' : 'Confirm in MetaMask if it opens.'}`
                : 'Waiting for 0G Compute. No wallet popup for a quote.'
          }
        />
      )}
      {!hideDenial && till.lastDenial && <DenialCard denial={till.lastDenial} />}
    </div>
  )
}
