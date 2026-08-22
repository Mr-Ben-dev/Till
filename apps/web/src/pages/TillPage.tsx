import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { BriefCard } from '../components/app/BriefCard'
import { OgRail } from '../components/app/OgRail'
import { ProductNotices } from '../components/app/ProductNotices'
import { SetupChecklist } from '../components/app/SetupChecklist'
import { SignHint } from '../components/app/SignHint'
import { JourneyFooter, TillSkeleton } from '../components/app/TillContextBar'
import { fmt0g } from '../lib/errors'
import { txUrl, HUB_SWAP } from '../lib/chain'
import { loadTillName } from '../lib/tillMeta'
import { policyPresetName, setupItems, setupReady } from '../lib/setup'

const inputCls =
  'w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm text-white outline-none focus:border-cyan'

export function TillPage({ till }: { till: TillState }) {
  const loc = useLocation()
  const [fundAmt, setFundAmt] = useState('0.02')
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

  const status = till.paused ? 'Paused' : live ? 'LIVE' : 'Setup'
  const policyName = till.hasPolicy ? policyPresetName(till.maxTxWei, till.windowBudgetWei) : 'Not set'
  const nextSetup = setupItems(till).find((i) => !i.done)

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
                  <dt className="text-white/45">Protection</dt>
                  <dd>{policyName}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Agent</dt>
                  <dd>{autonomous ? 'Ready' : 'Owner'}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Status</dt>
                  <dd>{status}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <CyanButton to={live ? '/till/mission' : (nextSetup?.to ?? '/till/policy')}>
                {live ? 'Start work' : nextSetup?.label ?? 'Finish setup'}
              </CyanButton>
              <CyanButton to="/till/policy" variant="ghost">
                Edit policy
              </CyanButton>
            </div>
          </header>

          <ProductNotices till={till} />

          <div className="mt-8 grid gap-8">
            {live ? null : <SetupChecklist till={till} />}

            {live ? (
              <section className="surf surf-accent">
                <p className="mod-kicker">Work ready</p>
                <h2>Tell your agent what you need done.</h2>
                <p className="mod-lede">Give it a bounded Till. It finishes the work. You get the result and proof.</p>
                <div className="mt-5">
                  <CyanButton to="/till/mission">Start work</CyanButton>
                </div>
              </section>
            ) : till.hasPolicy && till.available === 0n ? (
              <FundBlock till={till} fundAmt={fundAmt} setFundAmt={setFundAmt} />
            ) : null}

            {live && till.lastBrief ? (
              <section className="surf surf-proof" id="proof">
                <BriefCard
                  brief={till.lastBrief}
                  model={till.briefModel}
                  trust={till.briefTrust}
                  tee={till.tech.tee === 'true'}
                  storageTx={till.tech.anchorTx}
                  spentUsd={till.purchases.reduce((n, p) => n + p.quote.amountUsd, 0)}
                />
                <details className="mt-4">
                  <summary className="cursor-pointer text-[13px] text-white/55">Technical details</summary>
                  <div className="mt-4">
                    <Pipeline steps={till.steps} tech={till.tech} />
                    <OgRail steps={till.steps} tech={till.tech} spine />
                  </div>
                </details>
              </section>
            ) : null}

            <nav className="ov-more" aria-label="More on this Till">
              <Link to="/till/policy">Policy</Link>
              <Link to="/till/agent">Agent</Link>
              <Link to="/till/mission">Mission</Link>
              <Link to="/activity">Activity</Link>
              <Link to="/verify">Proof</Link>
            </nav>

            {till.lastTx && (
              <p className="font-mono text-[12px] text-cyan">
                Last receipt{' '}
                <a className="underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
                  {till.lastTx.slice(0, 10)}…{till.lastTx.slice(-6)}
                </a>
                {till.lastExecutor ? ` · ${till.lastExecutor === 'session' ? 'session key' : 'owner wallet'}` : ''}
              </p>
            )}
            <JourneyFooter
              backTo="/tills"
              backLabel="All Tills"
              nextTo={live ? '/till/mission' : (nextSetup?.to ?? '/till/policy')}
              nextLabel={live ? 'Start a mission' : nextSetup?.label ?? 'Configure policy'}
            />
          </div>
        </>
      )}
    </main>
  )
}

function FundBlock({
  till,
  fundAmt,
  setFundAmt,
}: {
  till: TillState
  fundAmt: string
  setFundAmt: (v: string) => void
}) {
  return (
    <section className="surf" id="fund">
      <p className="mod-kicker">Funding</p>
      <h2>Fund your Till</h2>
      <p className="mod-lede">
        Native 0G goes in the vault under TillPolicy. Work Desk does not require a second token.
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 text-[14px]">
        <div className="surf-inner">
          <dt>Till balance (0G)</dt>
          <dd className="font-mono text-cyan">{fmt0g(till.available)}</dd>
        </div>
        <div className="surf-inner">
          <dt>Policy max / tx</dt>
          <dd className="font-mono text-cyan">{fmt0g(till.maxTxWei)}</dd>
        </div>
      </dl>
      <SignHint kind="owner" write="fund" />
      <div className="mt-5 flex max-w-lg flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2">
          <span className="text-[12px] text-white/70">Amount (0G)</span>
          <input className={inputCls} value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
        </label>
        <CyanButton disabled={till.writeLocked} onClick={() => till.fund(fundAmt)}>
          Fund Till
        </CyanButton>
      </div>
      <a className="mt-4 inline-block text-[14px] text-cyan underline-offset-4 hover:underline" href={HUB_SWAP} target="_blank" rel="noreferrer">
        Get 0G
      </a>
    </section>
  )
}
