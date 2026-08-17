import { useState } from 'react'
import type { JobPhase, TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { Notice } from '../components/app/Notice'
import { DenialCard } from '../components/app/DenialCard'
import { ActionCard } from '../components/app/ActionCard'
import { BriefCard } from '../components/app/BriefCard'
import { MissionCard } from '../components/app/MissionCard'
import { txUrl, DEFAULT_BRIEF_SUBJECT } from '../lib/chain'

const PHASES: { id: JobPhase; label: string }[] = [
  { id: 'quote', label: 'Quote' },
  { id: 'lock', label: 'Lock' },
  { id: 'working', label: 'Working' },
  { id: 'settle', label: 'Settle' },
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
  const [subject, setSubject] = useState(DEFAULT_BRIEF_SUBJECT)
  const idx = phaseIndex(till.jobPhase)
  return (
    <main className="app-page">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Jobs</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Tell the agent what to check before you pay. Three independent x402 purchases, then BUY / HOLD / AVOID.
      </p>
      {till.error && <div className="mt-6"><Notice tone="danger" title="Stopped" body={till.error} /></div>}
      {till.lastDenial && <div className="mt-6"><DenialCard denial={till.lastDenial} /></div>}
      {!till.tokenId && (
        <div className="mt-8">
          <Notice title="Create a Till first" action={<CyanButton to="/till">Open Till</CyanButton>} />
        </div>
      )}

      <div className="mt-10">
        <ActionCard
          what="Before you pay"
          why="Paste a token or keep the Base USDC default. The agent buys safety, oracle, and bytecode from three different providers, then 0G writes BUY / HOLD / AVOID."
          next="Storage anchor is the on-chain proof. Then try Buy $5 worth against the $0.50 cap."
        >
          <label className="flex max-w-xl flex-col gap-2">
            <span className="text-[12px] text-white/70">Mission</span>
            <input
              className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <div className="mt-6 flex flex-wrap gap-3">
            <CyanButton
              disabled={!!till.busy || till.tokenId == null || till.backend !== 'ok' || !subject.trim()}
              onClick={() => till.payX402(subject.trim())}
            >
              Run mission
            </CyanButton>
            <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.tryOverBudget()}>
              Buy $5 worth
            </CyanButton>
          </div>
          {till.mission && <MissionCard mission={till.mission} purchases={till.purchases} />}
          {till.lastBrief && (
            <BriefCard
              brief={till.lastBrief}
              model={till.briefModel}
              trust={till.briefTrust}
              spentUsd={till.purchases.reduce((n, p) => n + p.quote.amountUsd, 0)}
              remainingUsd={
                till.mission ? till.mission.capUsd - till.purchases.reduce((n, p) => n + p.quote.amountUsd, 0) : undefined
              }
              sources={till.purchases.map((p) => ({
                seller: p.seller,
                sku: p.sku,
                usd: p.quote.amountUsd,
              }))}
            />
          )}
          <Pipeline steps={till.steps} tech={till.tech} />
        </ActionCard>
      </div>

      <details className="mt-10 rounded-[4.27px] border border-white/10 p-6">
        <summary className="cursor-pointer text-[15px] font-semibold">Lock, settle, or refund</summary>
        <p className="mt-3 max-w-[54ch] text-[14px] text-white/55">
          Secondary path. Lock 0G into a job. Settle pays the payee. Refund returns it to this Till.
        </p>
        <ol className="job-rail mt-8">
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
          <CyanButton disabled={!!till.busy || till.tokenId == null} onClick={() => till.lockJob(label, amt, 'settle')}>
            Lock and settle
          </CyanButton>
          <CyanButton
            variant="ghost"
            disabled={!!till.busy || till.tokenId == null}
            onClick={() => till.lockJob(label, amt, 'refund')}
          >
            Lock and refund
          </CyanButton>
        </div>
        {till.tech.mode && (
          <div className="mt-8 rounded-[4.27px] bg-white/[0.04] p-5">
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
      </details>
      {till.busy && (
        <p className="mt-4 text-[14px] text-white/60">
          {till.busy}. Waiting for a receipt, not a timer.
        </p>
      )}
    </main>
  )
}
