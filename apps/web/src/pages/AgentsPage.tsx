import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { ProductNotices } from '../components/app/ProductNotices'
import { SessionPanel } from '../components/app/SessionPanel'
import { sessionLabel } from '../components/app/PolicyPanel'
import { JourneyFooter, TillSkeleton } from '../components/app/TillContextBar'
import { SignHint } from '../components/app/SignHint'
import { loadTillName } from '../lib/tillMeta'

export function AgentsPage({ till }: { till: TillState }) {
  const [gasAmt, setGasAmt] = useState('0.002')
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))
  const status = sessionLabel(till)
  const ready = status === 'READY'

  if (till.authenticated && till.hydrated && !till.switching && till.tokenId == null) {
    return <Navigate to="/tills" replace />
  }

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      {ready ? (
        <>
          <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Agent is ready</h1>
          <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
            Bound to {till.tokenId != null ? loadTillName(till.tokenId) : 'this Till'}. Approved work can run without a wallet prompt for every purchase.
          </p>
          <SignHint kind="auto" write="mission" />
          <p className="mt-3 text-[13px] text-white/50">Revoke is an owner action.</p>
          <SignHint kind="owner" write="revoke" />
          <div className="mt-3 flex flex-wrap gap-3">
            <CyanButton to="/till#mission">Run a mission</CyanButton>
            <CyanButton to="/till" variant="ghost">
              View Till
            </CyanButton>
            <CyanButton to="/till/policy" variant="ghost">
              Edit policy
            </CyanButton>
            <CyanButton
              variant="ghost"
              disabled={till.writeLocked || !till.authorized[0]}
              onClick={() => {
                const addr = till.authorized[0]
                if (addr) void till.revokeAgent(addr)
              }}
            >
              Revoke session
            </CyanButton>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Enable autonomous agent</h1>
          <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
            Authorize a device-local session so approved work can run without asking you to sign every transaction.
          </p>
            <SignHint kind="owner" write="authorize" />
            <div className="mt-3 flex flex-wrap gap-3">
            <CyanButton disabled={till.writeLocked || loading || till.tokenId == null} onClick={till.attachAgent}>
              Authorize session
            </CyanButton>
            <button type="button" className="text-[14px] text-white/55 underline" onClick={till.skipAgent}>
              Continue in owner mode
            </button>
          </div>
        </>
      )}
      <div className="mt-8">
        <ProductNotices till={till} />
      </div>
      {loading ? (
        <TillSkeleton />
      ) : !till.tokenId ? (
        <div className="mt-10">
          <Notice
            title="No Till yet"
            body="Create a Till first. Then authorize a session."
            action={<CyanButton to="/tills">Open Tills</CyanButton>}
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-6">
          <SessionPanel till={till} gasAmt={gasAmt} setGasAmt={setGasAmt} />
          <JourneyFooter backLabel="Till Overview" nextTo="/till#mission" nextLabel="Run first mission" />
        </div>
      )}
    </main>
  )
}
