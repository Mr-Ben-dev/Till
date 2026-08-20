import { Link } from 'react-router-dom'
import { fmt0g, shortAddr } from '../../lib/errors'
import { HUB_SWAP } from '../../lib/chain'
import { loadTillName } from '../../lib/tillMeta'
import { CyanButton } from '../CyanButton'
import type { TillState } from '../../hooks/useTill'
import { sessionLabel } from './PolicyPanel'
import { PermissionDiagram } from './PermissionDiagram'
import { policyPresetName } from '../../lib/setup'

export function SessionPanel({
  till,
  gasAmt,
  setGasAmt,
  compact = false,
}: {
  till: TillState
  gasAmt: string
  setGasAmt: (v: string) => void
  compact?: boolean
}) {
  const status = sessionLabel(till)
  const sessionAddr = till.authorized.at(0)
  const exp =
    till.sessionExpiresAt > 0n ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleString() : 'not set'
  return (
    <section className="surf" id="agent">
      <p className="mod-kicker">Autonomous agent</p>
      <h2>{compact ? 'Autonomous agent' : 'Runs approved work without asking you to sign every transaction.'}</h2>
      {compact ? <p className="mod-lede">Runs approved work without asking you to sign every transaction.</p> : null}
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surf-inner">
          <dt>Status</dt>
          <dd className="font-mono text-cyan">{status}</dd>
        </div>
        <div className="surf-inner">
          <dt>Till</dt>
          <dd>{till.tokenId != null ? loadTillName(till.tokenId) : 'none'}</dd>
        </div>
        <div className="surf-inner">
          <dt>Scope</dt>
          <dd>This Till only</dd>
        </div>
        <div className="surf-inner">
          <dt>Gas</dt>
          <dd className="font-mono">{till.agentOf ? fmt0g(till.agentGas) : 'n/a'}</dd>
        </div>
        <div className="surf-inner sm:col-span-2">
          <dt>Expiry</dt>
          <dd>{exp}</dd>
        </div>
      </dl>
      {till.agentOf ? (
        <p className="mt-4 font-mono text-[12px] text-white/50">Session {shortAddr(till.agentOf.address)}</p>
      ) : null}
      <ul className="cap-list mt-6">
        <li className="is-yes">Buy allowed work</li>
        <li className="is-yes">Run jobs</li>
        <li className="is-yes">Respect policy</li>
        <li className="is-no">Withdraw</li>
        <li className="is-no">Change policy</li>
        <li className="is-no">Spend another Till</li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <CyanButton to="/till#mission" variant="ghost">
          Run
        </CyanButton>
        {status === 'OWNER_MODE' || status === 'REVOKED' || status === 'EXPIRED' ? (
          <CyanButton disabled={!!till.busy} onClick={till.attachAgent}>
            Authorize session
          </CyanButton>
        ) : (
          <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.pause(!till.paused)}>
            {till.paused ? 'Unpause' : 'Pause'}
          </CyanButton>
        )}
        {sessionAddr ? (
          <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.revokeAgent(sessionAddr)}>
            Revoke
          </CyanButton>
        ) : (
          <button type="button" className="text-[14px] text-white/50 underline" onClick={till.skipAgent}>
            Continue in owner mode
          </button>
        )}
        {till.agentOf ? (
          <>
            <input
              className="w-28 rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
              value={gasAmt}
              onChange={(e) => setGasAmt(e.target.value)}
            />
            <CyanButton disabled={!!till.busy} onClick={() => till.fundAgentGas(gasAmt)}>
              Fund gas
            </CyanButton>
          </>
        ) : null}
      </div>
      <div className="mt-8">
        <details>
          <summary className="cursor-pointer text-[13px] text-white/60">How permissions work</summary>
          <div className="mt-4">
            <PermissionDiagram />
          </div>
        </details>
      </div>
      {compact ? null : (
        <a className="mt-4 inline-block text-[13px] text-cyan" href={HUB_SWAP} target="_blank" rel="noreferrer">
          Get USDC.e
        </a>
      )}
    </section>
  )
}

export function PaymentsPanel({ till }: { till: TillState }) {
  const required = till.mission?.totalUsd
  const needsUsdce = (required ?? 0) > 0
  const rail = required != null ? till.usdceUsd >= required : till.usdceUsd > 0
  return (
    <section className="surf">
      <p className="mod-kicker">Payment / funding</p>
      <h2>What this Till can pay with</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-[14px]">
        <div className="surf-inner">
          <dt>Till balance</dt>
          <dd className="font-mono text-cyan">{fmt0g(till.available)}</dd>
        </div>
        <div className="surf-inner">
          <dt>USDC.e on this wallet</dt>
          <dd className="font-mono text-cyan">${till.usdceUsd.toFixed(3)}</dd>
        </div>
        <div className="surf-inner">
          <dt>This mission</dt>
          <dd className="font-mono">
            {required == null ? 'Quote first' : needsUsdce ? `$${required.toFixed(3)} USDC.e` : 'No USDC.e required'}
          </dd>
        </div>
      </dl>
      <p className="mt-4 max-w-[54ch] text-[13px] text-white/55">
        {needsUsdce
          ? 'This mission settles in USDC.e. Swap a small amount of 0G for USDC.e on 0G Hub.'
          : required == null
            ? 'Before You Pay checks usually settle in USDC.e. Quote a mission to see the exact amount.'
            : 'The current mission does not require USDC.e.'}
      </p>
      <a className="mt-3 inline-block text-[14px] text-cyan underline-offset-4 hover:underline" href={HUB_SWAP} target="_blank" rel="noreferrer">
        Get USDC.e
      </a>
      <p className="mt-2 text-[12px] text-white/40">
        {required == null
          ? 'Balances are live on Aristotle after refresh.'
          : rail
            ? 'This wallet holds enough USDC.e for the quoted mission.'
            : 'If settlement uses this wallet, fund USDC.e before you pay.'}
      </p>
    </section>
  )
}

export function MyTills({ till, onOpen }: { till: TillState; onOpen?: (id: bigint) => void }) {
  if (!till.tokenIds.length) return null
  return (
    <section id="tills">
      <ul className="till-grid">
        {till.tokenIds.map((id) => {
          const active = till.tokenId != null && till.tokenId.toString() === id.toString()
          const card = till.tillCards.find((c) => c.id === id)
          const ready = active ? till.executionMode === 'autonomous' : (card?.authorized ?? 0) > 0
          const hasPolicy = active ? till.hasPolicy : (card?.maxTxWei ?? 0n) > 0n
          const paused = active ? till.paused : Boolean(card?.paused)
          return (
            <li key={id.toString()} className={`surf surf-interactive ${active ? 'is-active' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[20px] font-bold">{loadTillName(id)}</p>
                <span className={`status-pill ${paused ? 'is-warn' : hasPolicy ? 'is-live' : 'is-setup'}`}>
                  {paused ? 'Paused' : hasPolicy ? 'LIVE' : 'Setup'}
                </span>
              </div>
              <p className="mt-2 font-mono text-[1.2rem] text-cyan">
                {active && till.tillReady ? fmt0g(till.available) : card ? fmt0g(card.available) : '…'}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
                <div>
                  <dt className="text-white/45">Policy</dt>
                  <dd>
                    {active && till.tillReady && till.hasPolicy
                      ? policyPresetName(till.maxTxWei, till.windowBudgetWei)
                      : hasPolicy
                        ? 'On'
                        : 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/45">Agent</dt>
                  <dd>{active && till.tillReady ? sessionLabel(till) : ready ? 'Autonomous' : 'Owner'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Mode</dt>
                  <dd>{active && till.tillReady ? (till.executionMode === 'autonomous' ? 'Autonomous' : 'Owner') : ready ? 'Autonomous' : 'Owner'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Network</dt>
                  <dd>Aristotle</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <CyanButton
                  onClick={() => {
                    if (onOpen) onOpen(id)
                    else till.selectTill(id)
                  }}
                >
                  Open
                </CyanButton>
                <Link
                  className="rounded-[4.27px] border border-white/20 px-3 py-2 text-[13px] text-white/80"
                  to="/till/policy"
                  onClick={() => till.selectTill(id)}
                >
                  Edit policy
                </Link>
                <Link
                  className="rounded-[4.27px] border border-white/20 px-3 py-2 text-[13px] text-white/80"
                  to="/till/agent"
                  onClick={() => till.selectTill(id)}
                >
                  Agent
                </Link>
                <Link
                  className="rounded-[4.27px] border border-white/20 px-3 py-2 text-[13px] text-white/80"
                  to="/activity"
                  onClick={() => till.selectTill(id)}
                >
                  Activity
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
