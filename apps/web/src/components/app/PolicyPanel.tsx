import { fmt0g } from '../../lib/errors'
import { HUB_SWAP, txUrl } from '../../lib/chain'
import { POLICY_TEMPLATES, sessionStatus } from '../../lib/human'
import { CyanButton } from '../CyanButton'
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
}) {
  const chosen = POLICY_TEMPLATES.find((t) => t.id === template)!
  const max = template === 'custom' ? customMax : chosen.max
  const window = template === 'custom' ? customWindow : chosen.window
  const exp =
    till.sessionExpiresAt > 0n ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleString() : 'not set'
  const status = sessionLabel(till)
  return (
    <section className="rounded-[4.27px] border border-white/10 p-6 md:p-8">
      <p className="font-mono text-[11px] tracking-[0.16em] text-muted">Protection policy</p>
      <h2 className="mt-2 text-[1.35rem] font-bold">Your agent can spend within this boundary.</h2>
      <p className="mt-2 max-w-[52ch] text-[14px] text-white/55">
        It cannot withdraw your Till balance or change this policy.
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[12px] text-white/45">Maximum per purchase</dt>
          <dd className="font-mono text-cyan">{till.hasPolicy ? fmt0g(till.maxTxWei) : 'not set'}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Mission budget</dt>
          <dd className="font-mono text-cyan">${till.missionCapUsd.toFixed(2)} USDC.e</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Rolling cap</dt>
          <dd className="font-mono text-cyan">{till.hasPolicy ? fmt0g(till.windowBudgetWei) : 'not set'}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Allowed services</dt>
          <dd>Safety · Market · Contract</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Payment assets</dt>
          <dd>USDC.e for checks · 0G in the Till</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Session</dt>
          <dd>
            {status} · expires {exp}
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <CyanButton disabled={!!till.busy} onClick={() => till.setPolicy(max, window, Number(sessionDays) || 30)}>
          {till.hasPolicy ? 'Update policy' : 'Write policy'}
        </CyanButton>
        <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.pause(!till.paused)}>
          {till.paused ? 'Unpause agent' : 'Pause agent'}
        </CyanButton>
        {till.authorized[0] ? (
          <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.revokeAgent(till.authorized[0])}>
            Revoke session
          </CyanButton>
        ) : null}
      </div>
      {till.lastTx ? (
        <p className="mt-4 text-[13px] text-white/60">
          Policy updated on Aristotle{' '}
          <a className="text-cyan underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </p>
      ) : null}
      <details className="mt-6">
        <summary className="cursor-pointer text-[14px] text-white/70">Edit policy</summary>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
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
                <p className="mt-2 text-[13px] text-white/60">{t.why}</p>
              </button>
            </li>
          ))}
        </ul>
        {template === 'custom' && (
          <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-[12px] text-white/70">Max per purchase (0G)</span>
              <input
                className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[12px] text-white/70">Rolling cap (0G)</span>
              <input
                className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
                value={customWindow}
                onChange={(e) => setCustomWindow(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[12px] text-white/70">Session TTL (days)</span>
              <input
                className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
                value={sessionDays}
                onChange={(e) => setSessionDays(e.target.value)}
              />
            </label>
          </div>
        )}
        <p className="mt-3 text-[12px] text-white/40">
          Mission budget ${till.missionCapUsd.toFixed(2)} USDC.e · allowed services Safety · Market · Contract ·
          payment assets USDC.e and 0G. Categories are agent-selected from live quotes, not an on-chain enum.
          Owner signs every policy write.
        </p>
        <a className="mt-3 inline-block text-[13px] text-cyan" href={HUB_SWAP} target="_blank" rel="noreferrer">
          Get USDC.e on 0G Hub ↗
        </a>
      </details>
    </section>
  )
}
