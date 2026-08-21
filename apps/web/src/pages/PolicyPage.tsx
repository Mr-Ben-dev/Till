import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { ProductNotices } from '../components/app/ProductNotices'
import { PolicyPanel } from '../components/app/PolicyPanel'
import { JourneyFooter, TillSkeleton } from '../components/app/TillContextBar'
import { SignHint } from '../components/app/SignHint'
import { POLICY_TEMPLATES } from '../lib/human'

function readPendingPreset(): (typeof POLICY_TEMPLATES)[number]['id'] {
  try {
    const v = sessionStorage.getItem('till.pendingPreset')
    if (v === 'conservative' || v === 'balanced' || v === 'custom') return v
  } catch {
    /* ignore */
  }
  return 'balanced'
}

export function PolicyPage({ till }: { till: TillState }) {
  const [template, setTemplate] = useState<(typeof POLICY_TEMPLATES)[number]['id']>(readPendingPreset)
  const [customMax, setCustomMax] = useState('0.05')
  const [customWindow, setCustomWindow] = useState('0.20')
  const [sessionDays, setSessionDays] = useState('30')
  const [fundAmt, setFundAmt] = useState('0.02')
  const [withdrawAmt, setWithdrawAmt] = useState('0.001')
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))

  if (till.authenticated && till.hydrated && !till.switching && till.tokenId == null) {
    return <Navigate to="/tills" replace />
  }

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Protect this Till</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        1. Budget · 2. Allowed work · 3. Agent permissions · 4. Session · 5. Review. One Save sends one transaction.
      </p>
      <div className="mt-8">
        <ProductNotices till={till} />
      </div>
      {loading ? (
        <TillSkeleton />
      ) : till.tokenId == null ? (
        <div className="mt-8">
          <CyanButton to="/tills">Open Tills</CyanButton>
        </div>
      ) : (
        <div className="mt-8">
          <PolicyPanel
            till={till}
            template={template}
            setTemplate={setTemplate}
            customMax={customMax}
            setCustomMax={setCustomMax}
            customWindow={customWindow}
            setCustomWindow={setCustomWindow}
            sessionDays={sessionDays}
            setSessionDays={setSessionDays}
            forceEdit
          />
          <section className="surf mt-8">
            <p className="mod-kicker">Owner money</p>
            <h2>Fund or withdraw</h2>
            <p className="mod-lede">These always use your wallet. One click is one transaction.</p>
            <SignHint kind="owner" write="fund" />
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[12px] text-white/70">Fund (0G)</span>
                <input
                  className="w-32 rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
                  value={fundAmt}
                  onChange={(e) => setFundAmt(e.target.value)}
                />
              </label>
              <CyanButton disabled={till.writeLocked} onClick={() => till.fund(fundAmt)}>
                Fund Till
              </CyanButton>
              <label className="flex flex-col gap-2">
                <span className="text-[12px] text-white/70">Withdraw (0G)</span>
                <input
                  className="w-32 rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                />
              </label>
              <CyanButton variant="ghost" disabled={till.writeLocked} onClick={() => till.withdraw(withdrawAmt)}>
                Withdraw
              </CyanButton>
            </div>
          </section>
          <JourneyFooter backLabel="Till Overview" nextTo="/till/agent" nextLabel="Enable agent" />
        </div>
      )}
    </main>
  )
}
