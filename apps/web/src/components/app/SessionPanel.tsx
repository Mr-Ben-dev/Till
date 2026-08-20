import { fmt0g, shortAddr } from '../../lib/errors'
import { HUB_SWAP } from '../../lib/chain'
import { CyanButton } from '../CyanButton'
import type { TillState } from '../../hooks/useTill'
import { sessionLabel } from './PolicyPanel'

export function SessionPanel({ till, gasAmt, setGasAmt }: { till: TillState; gasAmt: string; setGasAmt: (v: string) => void }) {
  const status = sessionLabel(till)
  const exp =
    till.sessionExpiresAt > 0n ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleString() : 'not set'
  return (
    <section className="rounded-[4.27px] border border-white/10 p-6 md:p-8">
      <p className="font-mono text-[11px] tracking-[0.16em] text-muted">Autonomous execution</p>
      <h2 className="mt-2 text-[1.35rem] font-bold">Enable autonomous execution</h2>
      <p className="mt-2 max-w-[52ch] text-[14px] text-white/55">
        Let this agent execute approved work without asking you to sign every transaction.
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[12px] text-white/45">Session</dt>
          <dd className="font-mono text-cyan">{status}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Gas balance</dt>
          <dd className="font-mono">{till.agentOf ? fmt0g(till.agentGas) : 'n/a'}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Scope</dt>
          <dd>This Till only</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Expiry</dt>
          <dd>{exp}</dd>
        </div>
      </dl>
      {till.agentOf ? (
        <p className="mt-4 font-mono text-[12px] text-white/50">Session {shortAddr(till.agentOf.address)}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {status === 'OWNER_MODE' || status === 'REVOKED' || status === 'EXPIRED' ? (
          <CyanButton disabled={!!till.busy} onClick={till.attachAgent}>
            Authorize session
          </CyanButton>
        ) : null}
        {till.agentOf && till.agentGas === 0n ? (
          <>
            <input
              className="w-28 rounded-[4.27px] border border-white/15 bg-navy px-3 py-2 text-sm"
              value={gasAmt}
              onChange={(e) => setGasAmt(e.target.value)}
            />
            <CyanButton disabled={!!till.busy} onClick={() => till.fundAgentGas(gasAmt)}>
              Fund agent gas
            </CyanButton>
          </>
        ) : null}
        {till.authorized[0] ? (
          <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.revokeAgent(till.authorized[0])}>
            Revoke session
          </CyanButton>
        ) : (
          <button type="button" className="text-[14px] text-white/50 underline" onClick={till.skipAgent}>
            Continue in owner mode
          </button>
        )}
      </div>
      <details className="mt-6 text-[13px] text-white/50">
        <summary className="cursor-pointer text-white/70">View permissions</summary>
        <ul className="mt-3 grid gap-1">
          <li>Key stays in this browser/device</li>
          <li>Cannot withdraw, change policy, or spend another Till</li>
          <li>Autonomous execution needs a small amount of 0G for transaction gas</li>
          <li>x402 checks settle in USDC.e on the Herald rail, not from this session key</li>
        </ul>
        <a className="mt-3 inline-block text-cyan" href={HUB_SWAP} target="_blank" rel="noreferrer">
          Get USDC.e ↗
        </a>
      </details>
    </section>
  )
}

export function PaymentsPanel({ till }: { till: TillState }) {
  const required = till.mission?.totalUsd ?? 0.016
  const rail = till.usdceUsd >= required
  return (
    <section className="rounded-[4.27px] border border-white/10 p-6">
      <p className="font-mono text-[11px] tracking-[0.16em] text-muted">Payments</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-[14px]">
        <div>
          <dt className="text-white/45">Your Till balance</dt>
          <dd className="font-mono text-cyan">{fmt0g(till.available)}</dd>
        </div>
        <div>
          <dt className="text-white/45">Service balance (this wallet)</dt>
          <dd className="font-mono text-cyan">${till.usdceUsd.toFixed(3)} USDC.e</dd>
        </div>
        <div>
          <dt className="text-white/45">Required for current mission</dt>
          <dd className="font-mono">${required.toFixed(3)} USDC.e</dd>
        </div>
      </dl>
      <p className="mt-4 max-w-[54ch] text-[13px] text-white/55">
        Live Before You Pay checks settle in USDC.e. Swap a small amount of 0G for USDC.e on 0G Hub if this wallet
        is the spend rail. 0G Compute billing is separate.
      </p>
      <a className="mt-3 inline-block text-[14px] text-cyan underline-offset-4 hover:underline" href={HUB_SWAP} target="_blank" rel="noreferrer">
        Get USDC.e ↗
      </a>
      <p className="mt-2 text-[12px] text-white/40">{rail ? 'This wallet holds enough USDC.e for one mission.' : 'If settlement uses this wallet, fund USDC.e before you pay.'}</p>
    </section>
  )
}

export function MyTills({ till }: { till: TillState }) {
  if (!till.tokenIds.length) return null
  return (
    <section>
      <p className="font-mono text-[11px] tracking-[0.16em] text-muted">My Tills</p>
      <ul className="mt-3 grid gap-2">
        {till.tokenIds.map((id) => {
          const active = till.tokenId === id
          return (
            <li key={id.toString()}>
              <button
                type="button"
                onClick={() => till.setTokenId(id)}
                className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-[4.27px] border px-4 py-3 text-left ${
                  active ? 'border-cyan bg-cyan/10' : 'border-white/10'
                }`}
              >
                <span className="font-semibold">Till {id.toString()}</span>
                <span className="font-mono text-[12px] text-white/60">
                  {active ? 'ACTIVE' : ''} {active ? fmt0g(till.available) : ''} {active ? (till.paused ? 'PAUSED' : till.executionMode.toUpperCase()) : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
