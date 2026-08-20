import { useState } from 'react'
import type { JobPhase, TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { DenialCard } from '../components/app/DenialCard'
import { TillSkeleton } from '../components/app/TillContextBar'
import { txUrl } from '../lib/chain'

const PHASES: { id: JobPhase; label: string }[] = [
  { id: 'quote', label: 'Quote' },
  { id: 'lock', label: 'Lock' },
  { id: 'working', label: 'Working' },
  { id: 'settle', label: 'Settle / Refund' },
]

function phaseIndex(p: JobPhase) {
  if (p === 'refunded') return 3
  if (p === 'failed') return -1
  const i = PHASES.findIndex((x) => x.id === p)
  return i
}

export function JobsPage({ till }: { till: TillState }) {
  const [amt, setAmt] = useState('0.001')
  const [label, setLabel] = useState('private-brief')
  const idx = phaseIndex(till.jobPhase)
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))
  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Pay when the work finishes.</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Lock a budget. Work starts. Seller is paid only after settlement - otherwise your Till is refunded.
      </p>
      {till.error && (
        <div className="mt-6">
          <Notice tone="danger" title="Stopped" body={till.error} />
        </div>
      )}
      {till.lastDenial && (
        <div className="mt-6">
          <DenialCard denial={till.lastDenial} />
        </div>
      )}
      {loading ? <TillSkeleton /> : null}
      {!till.tokenId && !loading && (
        <div className="mt-8">
          <Notice title="Create a Till first" action={<CyanButton to="/tills">Open Tills</CyanButton>} />
        </div>
      )}

      <section className="surf mt-10">
        <ol className="job-rail">
          {PHASES.map((p, i) => (
            <li
              key={p.id}
              className={
                till.jobPhase === 'failed'
                  ? 'is-fail'
                  : till.jobPhase === 'refunded' && i === 3
                    ? 'is-on'
                    : i < idx
                      ? 'is-done'
                      : i === idx
                        ? 'is-on'
                        : ''
              }
            >
              {till.jobPhase === 'refunded' && i === 3 ? 'Refunded' : p.label}
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-white/70">Job label</span>
            <input
              className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-white/70">Amount (0G)</span>
            <input
              className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <CyanButton disabled={!!till.busy || till.tokenId == null || loading} onClick={() => till.lockJob(label, amt, 'settle')}>
            Lock and settle
          </CyanButton>
          <CyanButton
            variant="ghost"
            disabled={!!till.busy || till.tokenId == null || loading}
            onClick={() => till.lockJob(label, amt, 'refund')}
          >
            Lock and refund
          </CyanButton>
        </div>
        {till.tech.mode && (
          <div className="surf-ok mt-8 p-5">
            <p className="text-[15px] font-semibold text-white">
              {till.tech.mode === 'settle' ? `${till.tech.amount} went to the payee.` : `${till.tech.amount} returned to this Till.`}
            </p>
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] text-muted">Technical details</summary>
              <dl className="mt-3 grid gap-2 font-mono text-[11px] text-white/70">
                {Object.entries(till.tech).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[100px_1fr] gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-all">
                      {k.toLowerCase().includes('tx') ? (
                        <a href={txUrl(v)} className="text-cyan underline">
                          {v}
                        </a>
                      ) : (
                        v
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}
      </section>
      {till.busy && <p className="mt-4 text-[14px] text-white/60">{till.busy}. Waiting for a receipt, not a timer.</p>}
    </main>
  )
}
