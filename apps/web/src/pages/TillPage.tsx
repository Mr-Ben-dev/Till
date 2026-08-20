import { useState } from 'react'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { ActionCard } from '../components/app/ActionCard'
import { BriefCard } from '../components/app/BriefCard'
import { MissionCard } from '../components/app/MissionCard'
import { DenialCard } from '../components/app/DenialCard'
import { Notice } from '../components/app/Notice'
import { OgRail } from '../components/app/OgRail'
import { Stepper } from '../components/app/Stepper'
import { fmt0g, shortAddr } from '../lib/errors'
import { txUrl, DEFAULT_BRIEF_SUBJECT } from '../lib/chain'
import { POLICY_TEMPLATES } from '../lib/human'
import { CHECKS, EXAMPLES } from '../lib/serviceLabels'
import { loadTillName } from '../lib/tillMeta'
import { PolicyPanel } from '../components/app/PolicyPanel'
import { CreateTillCard } from '../components/app/CreateTillCard'
import { MyTills, PaymentsPanel, SessionPanel } from '../components/app/SessionPanel'
import { TillSkeleton } from '../components/app/TillContextBar'

function stepOf(till: TillState) {
  if (!till.authenticated) return 0
  if (till.tokenId == null) return 1
  if (!till.tillReady) return -1
  if (!till.hasPolicy) return 2
  if (till.available === 0n) return 3
  if (till.authorized.length === 0 && !till.agentSkipped) return 4
  return 6
}

const inputCls =
  'w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm text-white outline-none focus:border-cyan'

export function TillPage({ till }: { till: TillState }) {
  const step = stepOf(till)
  const [fundAmt, setFundAmt] = useState('0.02')
  const [template, setTemplate] = useState<(typeof POLICY_TEMPLATES)[number]['id']>('balanced')
  const [customMax, setCustomMax] = useState('0.05')
  const [customWindow, setCustomWindow] = useState('0.20')
  const [withdrawAmt, setWithdrawAmt] = useState('0.001')
  const [gasAmt, setGasAmt] = useState('0.002')
  const [sessionDays, setSessionDays] = useState('30')
  const [subject, setSubject] = useState(DEFAULT_BRIEF_SUBJECT)
  const live = step === 6
  const autonomous = till.executionMode === 'autonomous'
  const loading =
    till.authenticated && (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))

  const runMission = () => {
    if (!till.authenticated) {
      till.login()
      return
    }
    if (!live) {
      till.setError('Finish setup first: create, protect, and fund this Till.')
      return
    }
    void till.payX402(subject.trim())
  }

  const checksOn = CHECKS.length
  const est = till.mission?.totalUsd ?? 0.016

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      {till.tokenId != null && till.tillReady ? (
        <header className="surf mb-8">
          <p className="mod-kicker">Aristotle 16661</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-tight">{loadTillName(till.tokenId)}</h1>
              <p className="mt-1 text-[14px] text-white/55">A permissioned spend account. The agent never holds this wallet.</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-[14px] sm:grid-cols-4">
              <div>
                <dt className="text-white/45">Balance</dt>
                <dd className="font-mono text-cyan">{fmt0g(till.available)}</dd>
              </div>
              <div>
                <dt className="text-white/45">Mode</dt>
                <dd>{autonomous ? 'Autonomous' : 'Owner'}</dd>
              </div>
              <div>
                <dt className="text-white/45">Status</dt>
                <dd>{till.paused ? 'Paused' : live ? 'Live' : 'Setup'}</dd>
              </div>
              <div>
                <dt className="text-white/45">Wallet</dt>
                <dd className="font-mono">{shortAddr(till.address)}</dd>
              </div>
            </dl>
          </div>
        </header>
      ) : (
        <>
          <h1 className="max-w-5xl text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight tracking-tight">
            Tell your agent what you&apos;re about to pay for.
          </h1>
          <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
            It buys the intelligence it needs. You get the answer. Your agent never gets your wallet.
          </p>
        </>
      )}

      {step >= 0 && !loading ? (
        <div className="mt-6">
          <Stepper current={Math.max(step, 0)} />
        </div>
      ) : null}

      {till.loadError ? (
        <div className="mt-6">
          <Notice tone="danger" title="This Till could not be loaded" body={till.loadError} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4">
        {till.backend === 'down' && (
          <Notice
            tone="info"
            title="Payment services are offline"
            body="You can still create a Till, write policy, and fund. Private briefs wait until the service is back."
          />
        )}
        {till.wrongNetwork && (
          <Notice
            tone="info"
            title="Switch to 0G Mainnet"
            body="Till only spends on 0G Mainnet (chain 16661)."
            action={
              <CyanButton disabled={!!till.busy} onClick={till.switchNetwork}>
                Switch network
              </CyanButton>
            }
          />
        )}
        {till.error && <Notice tone="danger" title="Stopped" body={till.error} />}
        {till.busy && (
          <Notice
            tone="ok"
            title={till.busy}
            body={
              autonomous && till.busy.toLowerCase().includes('mission')
                ? 'Purchases settle without your wallet. If a session key is authorized and funded, MetaMask will not open for the storage proof.'
                : 'If MetaMask opens, it is an owner action (create, fund, policy, authorize, or owner-mode proof). This waits for a real receipt.'
            }
          />
        )}
        {till.lastDenial && <DenialCard denial={till.lastDenial} />}
      </div>

      {!till.authenticated ? (
        <div className="mt-10">
          <ActionCard
            what="Connect your wallet"
            why="Confirm the URL is till-0g.vercel.app. MetaMask often warns on *.vercel.app hosts. That warning is Blockaid/phishing detection, not Privy allowed-origins. Privy already lists this domain. If the URL matches, connect anyway."
            next="Then create a Till. Your keys stay in the wallet."
          >
            <CyanButton onClick={till.login}>Connect</CyanButton>
            <p className="mt-4 max-w-[52ch] text-[13px] text-white/50">
              In the Privy dashboard, switch the app from Development to Production. Development mode plus a new vercel.app host is a common false-positive for MetaMask.
            </p>
          </ActionCard>
        </div>
      ) : loading ? (
        <TillSkeleton />
      ) : (
        <div className="mt-10 grid gap-10">
          {till.tokenId == null ? <CreateTillCard till={till} /> : null}

          {till.tokenId != null ? (
            <>
              <MyTills till={till} />
              <CreateTillCard till={till} />
              <PolicyPanel
                till={till}
                template={template}
                setTemplate={setTemplate}
                customMax={customMax}
                setCustomMax={setCustomMax}
                customWindow={customWindow}
                setCustomWindow={setCustomWindow}
                sessionDays={sessionDays}
                setSessionDays={setSessionDays}
              />
              {till.available === 0n ? (
                <section className="surf">
                  <p className="mod-kicker">Fund</p>
                  <h2>Put 0G in this Till</h2>
                  <p className="mod-lede">Protected balance. Only you can withdraw. x402 checks settle in USDC.e.</p>
                  <div className="mt-5 flex max-w-md flex-col gap-4 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-2">
                      <span className="text-[12px] text-white/70">Amount (0G)</span>
                      <input className={inputCls} value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
                    </label>
                    <CyanButton disabled={!!till.busy} onClick={() => till.fund(fundAmt)}>
                      Fund Till
                    </CyanButton>
                  </div>
                </section>
              ) : null}
              <SessionPanel till={till} gasAmt={gasAmt} setGasAmt={setGasAmt} />
            </>
          ) : null}

          <section className="surf surf-accent" id="mission">
            <p className="mod-kicker">Before You Pay</p>
            <h2>Tell your agent what you&apos;re about to pay for.</h2>
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
            <ul className="mt-6 grid gap-3 md:grid-cols-3">
              {CHECKS.map((c) => (
                <li key={c.id} className="surf-inner">
                  <p className="font-mono text-[11px] tracking-[0.16em] text-cyan">{c.title}</p>
                  <p className="mt-2 text-[14px] text-white/75">{c.body}</p>
                  <p className="mt-3 font-mono text-[11px] text-white/40">
                    {c.price} · {c.seller}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="surf" id="pipeline">
            <p className="mod-kicker">0G pipeline</p>
            <h2>This is a 0G-native system</h2>
            <p className="mod-lede">Every node maps to a real backend state. Nothing is decorative.</p>
            <div className="mt-6">
              <OgRail steps={till.steps} tech={till.tech} />
            </div>
          </section>

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
              <Pipeline steps={till.steps} tech={till.tech} />
            </section>
          )}

          {till.tokenId != null ? <PaymentsPanel till={till} /> : null}

          {live ? (
            <>
              {till.lastExecutor ? (
                <p className="font-mono text-[11px] text-white/45">
                  Last on-chain executor: {till.lastExecutor === 'session' ? 'session key (no MetaMask)' : 'owner wallet'}
                </p>
              ) : null}
              <section className="surf">
                <p className="mod-kicker">Jobs</p>
                <h2>Pay when the work finishes</h2>
                <p className="mod-lede">Lock a budget. Work starts. Seller is paid only after settlement, or this Till is refunded.</p>
                <CyanButton to="/jobs">Open Jobs</CyanButton>
              </section>
              <details className="surf">
                <summary className="cursor-pointer text-[15px] font-semibold">Owner controls</summary>
                <p className="mt-3 max-w-[50ch] text-[14px] text-white/55">Pause, fund, withdraw. These always use your wallet.</p>
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <CyanButton disabled={!!till.busy} onClick={() => till.fund(fundAmt)}>
                    Fund
                  </CyanButton>
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
            </>
          ) : null}

          {till.lastTx && (
            <p className="font-mono text-[12px] text-cyan">
              Last receipt{' '}
              <a className="underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
                {till.lastTx.slice(0, 10)}…{till.lastTx.slice(-6)}
              </a>
            </p>
          )}
        </div>
      )}
    </main>
  )
}
