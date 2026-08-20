import { Link } from 'react-router-dom'
import { fmt0g, shortAddr } from '../../lib/errors'
import { HUB_SWAP } from '../../lib/chain'
import { loadTillName } from '../../lib/tillMeta'
import { CyanButton } from '../CyanButton'
import type { TillState } from '../../hooks/useTill'
import { sessionLabel } from './PolicyPanel'
import { PermissionDiagram } from './PermissionDiagram'

export function SessionPanel({ till, gasAmt, setGasAmt }: { till: TillState; gasAmt: string; setGasAmt: (v: string) => void }) {
  const status = sessionLabel(till)
  const sessionAddr = till.authorized.at(0)
  const exp =
    till.sessionExpiresAt > 0n ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleString() : 'not set'
  return (
    <section className="surf" id="agent">
      <p className="mod-kicker">Autonomous agent</p>
      <h2>This agent can execute approved work without asking you to sign every transaction.</h2>
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
        <PermissionDiagram />
      </div>
      <a className="mt-4 inline-block text-[13px] text-cyan" href={HUB_SWAP} target="_blank" rel="noreferrer">
        Get USDC.e
      </a>
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

export function MyTills({ till }: { till: TillState }) {
  if (!till.tokenIds.length) return null
  return (
    <section id="tills">
      <p className="mod-kicker">My Tills</p>
      <h2 className="mt-2 text-[1.35rem] font-bold">Each Till is a separate spend account</h2>
      <p className="mod-lede">Switching loads the new Till. Old numbers never stay on screen as if they belong to the next one.</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {till.tokenIds.map((id) => {
          const active = till.tokenId != null && till.tokenId.toString() === id.toString()
          const card = till.tillCards.find((c) => c.id === id)
          const ready = active ? till.executionMode === 'autonomous' : (card?.authorized ?? 0) > 0
          return (
            <li key={id.toString()} className={`surf surf-interactive ${active ? 'is-active' : ''}`}>
              <p className="text-[18px] font-bold">{loadTillName(id)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                <div>
                  <dt className="text-white/45">Balance</dt>
                  <dd className="font-mono text-cyan">{active && till.tillReady ? fmt0g(till.available) : card ? fmt0g(card.available) : '…'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Policy</dt>
                    <dd>{(active ? till.hasPolicy : (card?.maxTxWei ?? 0n) > 0n) ? 'On' : 'Not set'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Agent</dt>
                  <dd>{active && till.tillReady ? sessionLabel(till) : ready ? 'Session' : 'Owner'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Network</dt>
                  <dd>Aristotle</dd>
                </div>
                <div>
                  <dt className="text-white/45">Status</dt>
                  <dd>{(active ? till.paused : card?.paused) ? 'PAUSED' : 'LIVE'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Mode</dt>
                  <dd>{active && till.tillReady ? till.executionMode : ready ? 'autonomous' : 'owner'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <CyanButton disabled={active} onClick={() => till.selectTill(id)}>
                  Open
                </CyanButton>
                <Link className="rounded-[4.27px] border border-white/20 px-3 py-2 text-[13px] text-white/80" to="/till#policy">
                  Edit policy
                </Link>
                <Link className="rounded-[4.27px] border border-white/20 px-3 py-2 text-[13px] text-white/80" to="/agents">
                  Agents
                </Link>
                <Link className="rounded-[4.27px] border border-white/20 px-3 py-2 text-[13px] text-white/80" to="/activity">
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
