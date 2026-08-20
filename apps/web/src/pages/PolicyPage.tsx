import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { ProductNotices } from '../components/app/ProductNotices'
import { PolicyPanel } from '../components/app/PolicyPanel'
import { TillSkeleton } from '../components/app/TillContextBar'
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
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))

  if (till.authenticated && till.hydrated && !till.switching && till.tokenId == null) {
    return <Navigate to="/tills" replace />
  }

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Protection policy</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Your agent can spend within these rules. It cannot withdraw or change them.
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
        </div>
      )}
    </main>
  )
}
