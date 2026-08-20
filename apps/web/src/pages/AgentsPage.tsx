import { useState } from 'react'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { SessionPanel } from '../components/app/SessionPanel'

export function AgentsPage({ till }: { till: TillState }) {
  const [gasAmt, setGasAmt] = useState('0.002')
  return (
    <main className="app-page">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted">Agents</p>
      <h1 className="mt-3 text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Enable autonomous execution</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        A device-local session on this Till. It can prove work. It cannot withdraw or change policy. Revoke turns it off immediately.
      </p>
      {till.error && (
        <div className="mt-6">
          <Notice tone="danger" title="Stopped" body={till.error} />
        </div>
      )}
      {till.busy && <p className="mt-6 font-mono text-[12px] text-cyan">{till.busy}</p>}
      {!till.tokenId ? (
        <div className="mt-10">
          <Notice
            title="No Till yet"
            body="Create a Till first. Then authorize a session."
            action={<CyanButton to="/till">Open Till</CyanButton>}
          />
        </div>
      ) : (
        <div className="mt-10">
          <SessionPanel till={till} gasAmt={gasAmt} setGasAmt={setGasAmt} />
          <div className="mt-6">
            <CyanButton to="/till">Run a mission</CyanButton>
          </div>
        </div>
      )}
      <details className="mt-8 text-[13px] text-white/45">
        <summary className="cursor-pointer">Technical details</summary>
        <p className="mt-3 max-w-[54ch] leading-relaxed">
          Session keys stay in this browser, scoped to this Till. ERC-8004 Identity and Reputation are live. Validation
          Registry is not claimed.
        </p>
      </details>
    </main>
  )
}
