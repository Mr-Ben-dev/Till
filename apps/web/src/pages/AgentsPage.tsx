import { useState } from 'react'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { SessionPanel } from '../components/app/SessionPanel'
import { TillSkeleton } from '../components/app/TillContextBar'
import { loadTillName } from '../lib/tillMeta'

export function AgentsPage({ till }: { till: TillState }) {
  const [gasAmt, setGasAmt] = useState('0.002')
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))
  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Autonomous agent</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        This agent can execute approved work without asking you to sign every transaction.
      </p>
      {till.error && (
        <div className="mt-6">
          <Notice tone="danger" title="Stopped" body={till.error} />
        </div>
      )}
      {till.busy && <p className="mt-6 font-mono text-[12px] text-cyan">{till.busy}</p>}
      {loading ? (
        <TillSkeleton />
      ) : !till.tokenId ? (
        <div className="mt-10">
          <Notice
            title="No Till yet"
            body="Create a Till first. Then authorize a session."
            action={<CyanButton to="/till">Open Tills</CyanButton>}
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-6">
          <p className="text-[14px] text-white/55">
            Bound to {loadTillName(till.tokenId)}. Switching Tills reloads this session from Aristotle.
          </p>
          <SessionPanel till={till} gasAmt={gasAmt} setGasAmt={setGasAmt} />
        </div>
      )}
    </main>
  )
}
