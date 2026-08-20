import { useState } from 'react'
import { parseEther } from 'ethers'
import type { JobPhase, TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { DenialCard } from '../components/app/DenialCard'
import { ProductNotices } from '../components/app/ProductNotices'
import { JourneyFooter, TillSkeleton } from '../components/app/TillContextBar'
import { txUrl } from '../lib/chain'
import { fmt0g } from '../lib/errors'

const PHASES: { id: JobPhase; label: string }[] = [
  { id: 'quote', label: 'Quote' },
  { id: 'lock', label: 'Lock funds' },
  { id: 'working', label: 'Work' },
  { id: 'settle', label: 'Settle / Refund' },
]

function phaseIndex(p: JobPhase) {
  if (p === 'refunded') return 3
  if (p === 'failed') return -1
  const i = PHASES.findIndex((x) => x.id === p)
  return i
}

function jobBlockedReason(till: TillState, amt: string) {
  if (!till.authenticated) return 'Connect a wallet first.'
  if (till.tokenId == null) return 'Create a Till first.'
  if (!till.hasPolicy) return 'Set a protection policy before locking a job.'
  if (till.paused) return 'This Till is paused.'
  if (till.backend === 'down') return 'Job lock needs 0G Compute. The API is offline.'
  if (till.wrongNetwork) return 'Switch to 0G Aristotle (16661).'
  try {
    if (parseEther(amt) <= 0n) return 'Enter an amount greater than zero.'
    if (parseEther(amt) > till.available) return `This Till only has ${fmt0g(till.available)}.`
  } catch {
    return 'Amount is not a valid 0G value.'
  }
  return ''
}

export function JobsPage({ till }: { till: TillState }) {
  const [amt, setAmt] = useState('0.001')
  const [label, setLabel] = useState('private-brief')
  const idx = phaseIndex(till.jobPhase)
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))
  const blocked = jobBlockedReason(till, amt)
  const canRun = !blocked && !till.busy && !loading && till.writePhase !== 'signing' && till.writePhase !== 'submitted' && till.writePhase !== 'waiting'
  const jobDenial = till.jobPhase === 'failed' ? till.lastDenial : null

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <p className="mod-kicker">Secondary workflow</p>
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Pay when the work finishes</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Lock a budget for a job. Work happens. If it succeeds, the seller is paid. If it is refunded, the money returns to this Till.
      </p>
      <p className="mt-3 max-w-[54ch] text-[14px] text-white/50">
        It is separate from Before You Pay. You can use a Job when an agent needs someone else to complete paid work.
      </p>
      <ol className="mt-6 max-w-[54ch] text-[15px] text-white/75">
        <li>Quote — 0G Compute decides if this lock is allowed</li>
        <li>Lock funds — amount leaves the available balance into escrow</li>
        <li>Work — the seller performs the job</li>
        <li>Settle OR Refund — seller is paid, or this Till is restored</li>
      </ol>
      <div className="mt-8">
        <ProductNotices till={till} hideDenial />
      </div>
      {jobDenial && (
        <div className="mt-6">
          <DenialCard denial={jobDenial} />
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
                till.jobPhase === 'failed' && i === Math.max(idx, 0)
                  ? 'is-fail'
                  : till.jobPhase === 'failed'
                    ? ''
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
        {till.busy ? (
          <p className="mt-4 font-mono text-[13px] text-cyan">{till.busy}…</p>
        ) : null}
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
        {blocked ? (
          <div className="mt-6">
            <Notice title="Jobs cannot run yet" body={blocked} />
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <CyanButton disabled={!canRun} onClick={() => till.lockJob(label, amt, 'settle')}>
              Lock and settle
            </CyanButton>
            <CyanButton variant="ghost" disabled={!canRun} onClick={() => till.lockJob(label, amt, 'refund')}>
              Lock and refund
            </CyanButton>
          </div>
        )}
        {till.jobPhase === 'failed' && !blocked ? (
          <p className="mt-3 text-[13px] text-white/50">Quote was denied. Fix the reason above, then try again. Nothing left this Till.</p>
        ) : null}
        <p className="mt-4 text-[13px] text-white/45">
          A successful job needs a Compute quote, then two owner signatures: lock, then settle or refund.
        </p>
        {till.tech.mode && till.lastWrite === 'job' && (
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
      <JourneyFooter nextTo="/activity" nextLabel="View activity" />
    </main>
  )
}
