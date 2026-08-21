import { useState } from 'react'
import { fmt0g } from '../../lib/errors'
import { HUB_SWAP, txUrl } from '../../lib/chain'
import { POLICY_TEMPLATES, sessionStatus } from '../../lib/human'
import { CyanButton } from '../CyanButton'
import { SignHint } from './SignHint'
import type { TillState } from '../../hooks/useTill'

export function sessionLabel(till: TillState) {
  return sessionStatus({
    paused: till.paused,
    authorized: till.authorized,
    agentOf: till.agentOf,
    agentGas: till.agentGas,
    sessionExpiresAt: till.sessionExpiresAt,
    skipped: till.agentSkipped,
  })
}

export function PolicyPanel({
  till,
  template,
  setTemplate,
  customMax,
  setCustomMax,
  customWindow,
  setCustomWindow,
  sessionDays,
  setSessionDays,
  forceEdit = false,
}: {
  till: TillState
  template: (typeof POLICY_TEMPLATES)[number]['id']
  setTemplate: (id: (typeof POLICY_TEMPLATES)[number]['id']) => void
  customMax: string
  setCustomMax: (v: string) => void
  customWindow: string
  setCustomWindow: (v: string) => void
  sessionDays: string
  setSessionDays: (v: string) => void
  forceEdit?: boolean
}) {
  const [editing, setEditing] = useState(!till.hasPolicy || forceEdit)
  const [step, setStep] = useState(0)
  const chosen = POLICY_TEMPLATES.find((t) => t.id === template) ?? POLICY_TEMPLATES[1]
  const max = template === 'custom' ? customMax : chosen.max
  const window = template === 'custom' ? customWindow : chosen.window
  const exp =
    till.sessionExpiresAt > 0n ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleString() : 'not set'
  const status = sessionLabel(till)
  const steps = ['Budget', 'Allowed work', 'Agent permissions', 'Session', 'Review']
  return (
    <section className="surf surf-accent" id="policy">
      <p className="mod-kicker">Protection policy</p>
      <h2>Protect this Till</h2>
      <p className="mod-lede">Your agent can spend within this boundary. It cannot withdraw or change the rules.</p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="surf-inner">
          <dt>Maximum per purchase</dt>
          <dd>{till.hasPolicy ? fmt0g(till.maxTxWei) : 'not set'}</dd>
        </div>
        <div className="surf-inner">
          <dt>Mission budget</dt>
          <dd>${till.missionCapUsd.toFixed(2)}</dd>
        </div>
        <div className="surf-inner">
          <dt>Rolling spend</dt>
          <dd>{till.hasPolicy ? fmt0g(till.windowBudgetWei) : 'not set'}</dd>
        </div>
        <div className="surf-inner">
          <dt>Allowed services</dt>
          <dd>Safety, Market, Contract</dd>
        </div>
        <div className="surf-inner">
          <dt>Payment assets</dt>
          <dd>USDC.e · 0G</dd>
        </div>
        <div className="surf-inner">
          <dt>Session</dt>
          <dd>
            {status}
            {exp !== 'not set' ? ` · ${exp}` : ' · 24h-90d'}
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <CyanButton disabled={till.writeLocked} onClick={() => setEditing(true)}>
          Edit policy
        </CyanButton>
        <CyanButton variant="ghost" disabled={till.writeLocked} onClick={() => till.pause(!till.paused)}>
          {till.paused ? 'Unpause' : 'Pause'}
        </CyanButton>
        <a className="inline-flex items-center text-[14px] text-cyan" href="/till/agent">
          View permissions
        </a>
      </div>
      {(till.writePhase === 'signing' || till.writePhase === 'submitted' || till.writePhase === 'waiting') &&
      till.lastWrite === 'policy' ? (
        <p className="mt-4 font-mono text-[13px] text-cyan">Waiting for the Aristotle receipt…</p>
      ) : null}
      {till.writePhase === 'confirmed' && till.lastWrite === 'policy' && till.lastTx ? (
        <p className="mt-4 text-[15px] text-white">
          Policy updated on Aristotle ✓{' '}
          <a className="text-cyan underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </p>
      ) : till.lastTx && till.hasPolicy && !till.busy && till.lastWrite === 'policy' ? (
        <p className="mt-4 text-[13px] text-white/60">
          Policy updated on Aristotle{' '}
          <a className="text-cyan underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </p>
      ) : null}

      {editing ? (
        <div className="mt-8 border-t border-white/10 pt-6">
          <ol className="policy-steps">
            {steps.map((s, i) => (
              <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''}>
                <button type="button" onClick={() => setStep(i)}>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          {step === 0 && (
            <div className="mt-5">
              <p className="text-[15px] text-white/80">You can spend up to {max} 0G on a single purchase.</p>
              <p className="mt-2 text-[14px] text-white/55">Rolling window {window} 0G. Mission checks cap at ${till.missionCapUsd.toFixed(2)} USDC.e.</p>
              <ul className="mt-4 grid gap-2 md:grid-cols-3">
                {POLICY_TEMPLATES.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`h-full w-full rounded-[4.27px] border p-4 text-left ${
                        template === t.id ? 'border-cyan bg-cyan/10' : 'border-white/15'
                      }`}
                      onClick={() => setTemplate(t.id)}
                    >
                      <p className="font-semibold">{t.name}</p>
                      <p className="mt-2 font-mono text-[12px] text-cyan">
                        {t.max} 0G / tx · {t.window} 0G rolling
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {template === 'custom' && (
                <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] text-white/70">Max per purchase (0G)</span>
                    <input className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm" value={customMax} onChange={(e) => setCustomMax(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] text-white/70">Rolling cap (0G)</span>
                    <input className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm" value={customWindow} onChange={(e) => setCustomWindow(e.target.value)} />
                  </label>
                </div>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="mt-5">
              <p className="text-[15px] text-white/80">This Till may buy Safety, Market, and Contract checks.</p>
              <p className="mt-2 text-[14px] text-white/55">The agent picks live x402 quotes. It cannot pay an unlisted seller.</p>
            </div>
          )}
          {step === 2 && (
            <div className="mt-5">
              <p className="text-[15px] text-white/80">Your agent cannot withdraw your balance.</p>
              <p className="mt-2 text-[15px] text-white/80">Your agent cannot change this policy.</p>
              <p className="mt-2 text-[14px] text-white/55">It cannot spend another Till. Scope is this account only.</p>
            </div>
          )}
          {step === 3 && (
            <div className="mt-5">
              <p className="text-[15px] text-white/80">Session length is how long an authorized agent may execute.</p>
              <label className="mt-4 flex max-w-xs flex-col gap-2">
                <span className="text-[12px] text-white/70">Session TTL (days)</span>
                <input className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm" value={sessionDays} onChange={(e) => setSessionDays(e.target.value)} />
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="mt-5">
              <p className="text-[15px] text-white/80">
                Save writes {max} 0G per purchase and {window} 0G rolling for {sessionDays} days.
              </p>
              <p className="mt-2 text-[14px] text-white/55">One Save is one owner signature. Nothing is saved until the receipt lands on Aristotle.</p>
              <SignHint kind="owner" write="policy" />
              <details className="mt-4 text-[13px] text-white/50">
                <summary className="cursor-pointer text-white/70">Technical values</summary>
                <p className="mt-2 font-mono text-[12px]">
                  maxSpendPerTx {max} · rollingWindowBudget {window} · sessionDays {sessionDays} · allowlist Safety/Market/Contract · assets USDC.e + 0G
                </p>
              </details>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {step > 0 ? (
              <CyanButton variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </CyanButton>
            ) : null}
            {step < 4 ? (
              <CyanButton onClick={() => setStep((s) => s + 1)}>Continue</CyanButton>
            ) : (
              <CyanButton
                disabled={till.writeLocked}
                onClick={() => {
                  if (till.writeLocked) return
                  void till.setPolicy(max, window, Number(sessionDays) || 30)
                }}
              >
                Save policy
              </CyanButton>
            )}
            {till.hasPolicy ? (
              <button type="button" className="text-[14px] text-white/50" onClick={() => setEditing(false)}>
                Close
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <a className="mt-4 inline-block text-[13px] text-cyan" href={HUB_SWAP} target="_blank" rel="noreferrer">
        Get USDC.e on 0G Hub
      </a>
    </section>
  )
}
