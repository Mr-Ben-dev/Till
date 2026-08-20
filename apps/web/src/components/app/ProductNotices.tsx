import { CyanButton } from '../CyanButton'
import { DenialCard } from './DenialCard'
import { Notice } from './Notice'
import type { TillState } from '../../hooks/useTill'

export function ProductNotices({ till }: { till: TillState }) {
  const autonomous = till.executionMode === 'autonomous'
  return (
    <div className="grid gap-3">
      {till.backend === 'down' && (
        <Notice
          tone="info"
          title="Payment services are offline"
          body="You can still create a Till, write policy, and fund. Private briefs wait until the service is back."
        />
      )}
      {till.wrongNetwork && (
        <Notice
          tone="info"
          title="Switch to 0G Mainnet"
          body="Till only spends on 0G Aristotle (chain 16661)."
          action={
            <CyanButton disabled={!!till.busy} onClick={till.switchNetwork}>
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
          title={till.busy}
          body={
            autonomous && till.busy.toLowerCase().includes('mission')
              ? 'Purchases settle without your wallet when a session is authorized and funded.'
              : 'If MetaMask opens, it is an owner action. This waits for a real receipt.'
          }
        />
      )}
      {till.lastDenial && <DenialCard denial={till.lastDenial} />}
    </div>
  )
}
