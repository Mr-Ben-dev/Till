import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { BriefCard } from '../components/app/BriefCard'
import { MissionCard } from '../components/app/MissionCard'
import { OgRail } from '../components/app/OgRail'
import { ProductNotices } from '../components/app/ProductNotices'
import { SetupChecklist } from '../components/app/SetupChecklist'
import { SessionPanel } from '../components/app/SessionPanel'
import { TillSkeleton } from '../components/app/TillContextBar'
import { fmt0g } from '../lib/errors'
import { txUrl, DEFAULT_BRIEF_SUBJECT, HUB_SWAP } from '../lib/chain'
import { CHECKS, EXAMPLES } from '../lib/serviceLabels'
import { loadTillName } from '../lib/tillMeta'
import { policyPresetName, setupItems, setupReady } from '../lib/setup'

const inputCls =
  'w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm text-white outline-none focus:border-cyan'

export function TillPage({ till }: { till: TillState }) {
  const loc = useLocation()
  const [fundAmt, setFundAmt] = useState('0.02')
  const [withdrawAmt, setWithdrawAmt] = useState('0.001')
  const [gasAmt, setGasAmt] = useState('0.002')
  const [subject, setSubject] = useState(DEFAULT_BRIEF_SUBJECT)
  const autonomous = till.executionMode === 'autonomous'
  const live = setupReady(till)
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))

  useEffect(() => {
    const id = loc.hash.replace('#', '')
    if (!id || loading) return
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loc.hash, loading, till.tokenId])

  if (till.ready && !till.authenticated) return <Navigate to="/tills" replace />
  if (till.authenticated && till.hydrated && !till.switching && till.tokenId == null) {
    return <Navigate to="/tills" replace />
  }

  const runMission = () => {
    if (!live) {
      till.setError('Finish setup first: protect, fund, then enable an agent.')
      return
    }
    void till.payX402(subject.trim())
  }

  const checksOn = CHECKS.length
  const est = till.mission?.totalUsd ?? 0.016
  const status = till.paused ? 'Paused' : live ? 'Live' : 'Setup'
  const policyName = till.hasPolicy ? policyPresetName(till.maxTxWei, till.windowBudgetWei) : 'Not set'

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      {loading || !till.tokenId ? (
        <TillSkeleton label={till.tokenId != null ? `Loading ${loadTillName(till.tokenId)}…` : 'Loading this Till from Aristotle…'} />
      ) : (
        <>
          <header className="surf mb-8">
            <p className="mod-kicker">Aristotle · 16661</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className="text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold leading-tight">{loadTillName(till.tokenId)}</h1>
                <p className="mt-2 font-mono text-[1.15rem] text-cyan">{fmt0g(till.available)} available</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-[14px] sm:grid-cols-3">
                <div>
                  <dt className="text-white/45">Policy</dt>
                  <dd>{policyName}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Agent</dt>
                  <dd>{autonomous ? 'Autonomous' : 'Owner'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Status</dt>
                  <dd>{status}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <CyanButton to={live ? '/till#mission' : (setupItems(till).find((i) => !i.done)?.to ?? '/till/policy')}>
                {live ? 'Run a mission' : 'Finish setup'}
              </CyanButton>
              <CyanButton to="/till/policy" variant="ghost">
                Edit policy
              </CyanButton>
            </div>
          </header>

          <ProductNotices till={till} />

          <div className="mt-8 grid gap-8">
            <SetupChecklist till={till} />

            {live ? (
              <MissionBlock
                till={till}
                subject={subject}
                setSubject={setSubject}
                checksOn={checksOn}
                est={est}
                runMission={runMission}
              />
            ) : null}

            {live ? (
              <section className="surf" id="pipeline">
                <p className="mod-kicker">0G pipeline</p>
                <h2>How a mission runs on 0G</h2>
                <p className="mod-lede">One path. Policy, compute, TEE, x402, storage, proof.</p>
                <div className="mt-6">
                  <OgRail steps={till.steps} tech={till.tech} spine />
                </div>
              </section>
            ) : null}

            {till.mission && <MissionCard mission={till.mission} purchases={till.purchases} />}
            {till.lastBrief && (
              <section className="surf surf-proof" id="proof">
                <BriefCard
                  brief={till.lastBrief}
                  model={till.briefModel}
                  trust={till.briefTrust}
                  tee={till.tech.tee === 'true'}
                  storageTx={till.tech.anchorTx}
                  spentUsd={till.purchases.reduce((n, p) => n + p.quote.amountUsd, 0)}
                  remainingUsd={
                    till.mission ? till.mission.capUsd - till.purchases.reduce((n, p) => n + p.quote.amountUsd, 0) : undefined
                  }
                  sources={till.purchases.map((p) => ({
                    seller: p.seller,
                    sku: p.sku,
                    usd: p.quote.amountUsd,
                    tx: p.ogTx,
                  }))}
                />
                <details className="mt-4">
                  <summary className="cursor-pointer text-[13px] text-white/55">Technical details</summary>
                  <div className="mt-4">
                    <Pipeline steps={till.steps} tech={till.tech} />
                  </div>
                </details>
              </section>
            )}

            <section className="surf" id="policy">
              <p className="mod-kicker">Protection</p>
              <h2>Protection policy</h2>
              <p className="mod-lede">Your agent can spend within these rules.</p>
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
                  <dt>Session expiry</dt>
                  <dd>
                    {till.sessionExpiresAt > 0n
                      ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleDateString()
                      : 'not set'}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <CyanButton to="/till/policy">Edit policy</CyanButton>
                <CyanButton to="/till/agent" variant="ghost">
                  View permissions
                </CyanButton>
                <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.pause(!till.paused)}>
                  {till.paused ? 'Unpause' : 'Pause'}
                </CyanButton>
              </div>
            </section>

            {!live ? (
              <FundBlock till={till} fundAmt={fundAmt} setFundAmt={setFundAmt} est={est} />
            ) : null}

            <SessionPanel till={till} gasAmt={gasAmt} setGasAmt={setGasAmt} compact />

            {!live ? (
              <MissionBlock
                till={till}
                subject={subject}
                setSubject={setSubject}
                checksOn={checksOn}
                est={est}
                runMission={runMission}
              />
            ) : (
              <FundBlock till={till} fundAmt={fundAmt} setFundAmt={setFundAmt} est={est} />
            )}

            <section className="surf" id="activity">
              <p className="mod-kicker">Activity</p>
              <h2>Recent actions</h2>
              <p className="mod-lede">Human-readable events for this Till. Hashes stay collapsed.</p>
              <ol className="timeline mt-6">
                {till.hasPolicy ? (
                  <li className="timeline__item">
                    <p className="timeline__title">Policy {policyName}</p>
                  </li>
                ) : null}
                {till.authorized.length > 0 ? (
                  <li className="timeline__item">
                    <p className="timeline__title">Agent authorized</p>
                  </li>
                ) : till.agentSkipped ? (
                  <li className="timeline__item">
                    <p className="timeline__title">Owner mode</p>
                  </li>
                ) : null}
                {till.lastBrief?.verdict ? (
                  <li className="timeline__item">
                    <p className="timeline__title">Verdict {till.lastBrief.verdict}</p>
                  </li>
                ) : null}
                {till.tech.tee === 'true' ? (
                  <li className="timeline__item">
                    <p className="timeline__title">TEE verified</p>
                  </li>
                ) : null}
                {till.tech.anchorTx ? (
                  <li className="timeline__item">
                    <p className="timeline__title">Evidence stored</p>
                  </li>
                ) : null}
              </ol>
              <div className="mt-4">
                <CyanButton to="/activity" variant="ghost">
                  Open activity
                </CyanButton>
              </div>
            </section>

            <section className="surf">
              <p className="mod-kicker">Jobs</p>
              <h2>Pay when the work finishes</h2>
              <p className="mod-lede">Quote → Lock → Working → Settle / Refund. Seller is paid only after settlement.</p>
              <CyanButton to="/jobs" variant="ghost">
                Open Jobs
              </CyanButton>
            </section>

            <details className="surf">
              <summary className="cursor-pointer text-[15px] font-semibold">Owner controls</summary>
              <p className="mt-3 max-w-[50ch] text-[14px] text-white/55">Pause, fund, withdraw. These always use your wallet.</p>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.pause(!till.paused)}>
                  {till.paused ? 'Unpause' : 'Pause'}
                </CyanButton>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] text-white/70">Withdraw (0G)</span>
                  <input className={`${inputCls} w-32`} value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} />
                </label>
                <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.withdraw(withdrawAmt)}>
                  Withdraw
                </CyanButton>
              </div>
            </details>

            {till.lastTx && (
              <p className="font-mono text-[12px] text-cyan">
                Last receipt{' '}
                <a className="underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
                  {till.lastTx.slice(0, 10)}…{till.lastTx.slice(-6)}
                </a>
              </p>
            )}
            {till.lastExecutor ? (
              <p className="font-mono text-[11px] text-white/45">
                Last on-chain executor: {till.lastExecutor === 'session' ? 'session key (no MetaMask)' : 'owner wallet'}
              </p>
            ) : null}
          </div>
        </>
      )}
    </main>
  )
}

function MissionBlock({
  till,
  subject,
  setSubject,
  checksOn,
  est,
  runMission,
}: {
  till: TillState
  subject: string
  setSubject: (v: string) => void
  checksOn: number
  est: number
  runMission: () => void
}) {
  return (
    <section className="surf surf-accent" id="mission">
      <p className="mod-kicker">Before You Pay</p>
      <h2>Tell your agent what you&apos;re about to pay for.</h2>
      <p className="mod-lede">It buys the intelligence it needs. You get the answer. Your agent never gets your wallet.</p>
      <label className="mt-5 flex flex-col gap-2">
        <span className="text-[12px] text-white/70">Paste a token, contract, or protocol</span>
        <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={DEFAULT_BRIEF_SUBJECT} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70 hover:border-cyan hover:text-cyan"
            onClick={() => setSubject(ex.value)}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <p className="mt-4 font-mono text-[12px] text-white/55">
        {checksOn} checks selected · ${est.toFixed(3)} estimated · ${till.missionCapUsd.toFixed(2)} maximum
      </p>
      <div className="mt-5">
        <CyanButton disabled={!!till.busy || !subject.trim()} onClick={runMission}>
          Analyze before I pay
        </CyanButton>
      </div>
    </section>
  )
}

function FundBlock({
  till,
  fundAmt,
  setFundAmt,
  est,
}: {
  till: TillState
  fundAmt: string
  setFundAmt: (v: string) => void
  est: number
}) {
  return (
    <section className="surf" id="fund">
      <p className="mod-kicker">Funding</p>
      <h2>Fund your Till</h2>
      <p className="mod-lede">Some paid services use USDC.e on 0G.</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3 text-[14px]">
        <div className="surf-inner">
          <dt>Till balance</dt>
          <dd className="font-mono text-cyan">{fmt0g(till.available)}</dd>
        </div>
        <div className="surf-inner">
          <dt>Service balance</dt>
          <dd className="font-mono text-cyan">${till.usdceUsd.toFixed(3)} USDC.e</dd>
        </div>
        <div className="surf-inner">
          <dt>Mission estimate</dt>
          <dd className="font-mono">${est.toFixed(3)}</dd>
        </div>
      </dl>
      <div className="mt-5 flex max-w-lg flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2">
          <span className="text-[12px] text-white/70">Amount (0G)</span>
          <input className={inputCls} value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
        </label>
        <CyanButton disabled={!!till.busy} onClick={() => till.fund(fundAmt)}>
          Fund Till
        </CyanButton>
      </div>
      <a className="mt-4 inline-block text-[14px] text-cyan underline-offset-4 hover:underline" href={HUB_SWAP} target="_blank" rel="noreferrer">
        Get USDC.e
      </a>
    </section>
  )
}
