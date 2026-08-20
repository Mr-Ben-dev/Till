import { useState } from 'react'
import { parseEther } from 'ethers'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { ActionCard } from '../components/app/ActionCard'
import { BriefCard } from '../components/app/BriefCard'
import { MissionCard } from '../components/app/MissionCard'
import { CanCannot } from '../components/app/CanCannot'
import { DenialCard } from '../components/app/DenialCard'
import { Metrics } from '../components/app/Metrics'
import { Notice } from '../components/app/Notice'
import { OgRail } from '../components/app/OgRail'
import { Stepper } from '../components/app/Stepper'
import { fmt0g, shortAddr } from '../lib/errors'
import { HUB_SWAP, txUrl, DEFAULT_BRIEF_SUBJECT } from '../lib/chain'
import { POLICY_TEMPLATES } from '../lib/human'
import { CHECKS, EXAMPLES } from '../lib/serviceLabels'

function stepOf(till: TillState) {
  if (!till.authenticated) return 0
  if (till.tokenId == null) return 1
  if (!till.hasPolicy) return 2
  if (till.available === 0n) return 3
  if (till.authorized.length === 0 && !till.agentSkipped && till.windowSpentWei === 0n) return 4
  if (till.agentOf && till.agentGas === 0n && !till.agentSkipped && till.windowSpentWei === 0n) return 4
  if (!till.policyTested) return 5
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
  const [subject, setSubject] = useState(DEFAULT_BRIEF_SUBJECT)
  const chosen = POLICY_TEMPLATES.find((t) => t.id === template)!
  const policyMax = template === 'custom' ? customMax : chosen.max
  const policyWindow = template === 'custom' ? customWindow : chosen.window
  const live = step === 6
  const autonomous = till.executionMode === 'autonomous'
  const expiry =
    till.sessionExpiresAt > 0n
      ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleDateString()
      : 'not set'

  const runMission = () => {
    if (!till.authenticated) {
      till.login()
      return
    }
    if (!live) {
      till.setError('Finish setup first — create, protect, fund, then choose owner or autonomous mode.')
      return
    }
    void till.payX402(subject.trim())
  }

  return (
    <main className="app-page">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted">Before you pay · 0G Mainnet 16661</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight tracking-tight">
        Tell your agent what you&apos;re about to pay for.
      </h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        It buys the intelligence it needs. You get the answer. Your agent never gets your wallet.
      </p>

      <div className="mt-8">
        <Stepper current={step} />
      </div>

      <section className="mt-10 rounded-[4.27px] border border-cyan/25 bg-cyan/5 p-6 md:p-8">
        <label className="flex flex-col gap-2">
          <span className="text-[12px] text-white/70">Paste a token, contract, or protocol</span>
          <input
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={DEFAULT_BRIEF_SUBJECT}
          />
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
        <div className="mt-6">
          <CyanButton disabled={!!till.busy || !subject.trim()} onClick={runMission}>
            Analyze before I pay
          </CyanButton>
        </div>
        <p className="mt-4 text-[13px] text-white/50">
          We automatically choose the checks your mission needs.
        </p>
      </section>

      <ul className="mt-6 grid gap-3 md:grid-cols-3">
        {CHECKS.map((c) => (
          <li key={c.id} className="rounded-[4.27px] border border-white/10 p-4">
            <p className="font-mono text-[11px] tracking-[0.16em] text-cyan">{c.title}</p>
            <p className="mt-2 text-[14px] text-white/75">{c.body}</p>
            <p className="mt-3 font-mono text-[11px] text-white/40">
              {c.price} · {c.seller}
            </p>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted">Powered by 0G</p>
        <OgRail steps={till.steps} />
      </section>

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
            why="Confirm the URL is till-0g.vercel.app. MetaMask often warns on *.vercel.app hosts — that warning is Blockaid/phishing detection, not Privy allowed-origins. Privy already lists this domain. If the URL matches, connect anyway."
            next="Then create a Till. Your keys stay in the wallet."
          >
            <CyanButton onClick={till.login}>Connect</CyanButton>
            <p className="mt-4 max-w-[52ch] text-[13px] text-white/50">
              In the Privy dashboard, switch the app from Development to Production. Development mode plus a new vercel.app host is a common false-positive for MetaMask.
            </p>
            <p className="mt-2 font-mono text-[11px] text-white/40">
              github.com/Mr-Ben-dev/Till · contracts on chainscan.0g.ai
            </p>
          </ActionCard>
        </div>
      ) : (
        <div className="mt-10 grid gap-10">
          {step === 1 && (
            <ActionCard
              what="Create a Till"
              why="Mints a drawer you own. The agent never receives this wallet."
              next="Wallet signature required. Next: protection policy."
            >
              <p className="mb-4 text-[13px] text-white/50">
                Wallet {shortAddr(till.address)} · {fmt0g(till.walletBal)}
              </p>
              <CyanButton disabled={!!till.busy} onClick={till.mint}>
                Create Till
              </CyanButton>
            </ActionCard>
          )}

          {step === 2 && (
            <ActionCard
              what="Protection policy"
              why="Your agent can spend within this boundary. It cannot withdraw your Till balance or change this policy."
              next="Three owner signatures write the template on-chain. Limits never increase by themselves."
            >
              <ul className="grid gap-3 md:grid-cols-3">
                {POLICY_TEMPLATES.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`h-full w-full rounded-[4.27px] border p-4 text-left ${
                        template === t.id ? 'border-cyan bg-cyan/10' : 'border-white/15 bg-white/[0.03]'
                      }`}
                      onClick={() => setTemplate(t.id)}
                    >
                      <p className="font-semibold text-white">{t.name}</p>
                      <p className="mt-2 font-mono text-[12px] text-cyan">
                        {t.max} 0G / tx · {t.window} 0G rolling
                      </p>
                      <p className="mt-2 text-[13px] text-white/60">{t.why}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {template === 'custom' && (
                <div className="mt-4 grid max-w-lg gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] text-white/70">Max per purchase (0G)</span>
                    <input className={inputCls} value={customMax} onChange={(e) => setCustomMax(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] text-white/70">Rolling spend (0G)</span>
                    <input className={inputCls} value={customWindow} onChange={(e) => setCustomWindow(e.target.value)} />
                  </label>
                </div>
              )}
              <div className="mt-6">
                <CyanButton disabled={!!till.busy} onClick={() => till.setPolicy(policyMax, policyWindow)}>
                  Write {chosen.name} on-chain
                </CyanButton>
              </div>
            </ActionCard>
          )}

          {step === 3 && (
            <ActionCard
              what="Fund the Till"
              why="Till balance is protected 0G only you can withdraw. x402 services settle in USDC.e. 0G Compute billing is separate."
              next="Some services on 0G accept USDC.e. Swap a small amount of 0G for USDC.e on 0G Hub if this wallet is the spend rail."
            >
              <dl className="mb-5 grid gap-3 text-[14px] text-white/75 sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Till balance</dt>
                  <dd className="font-mono text-cyan">{fmt0g(till.available)}</dd>
                </div>
                <div>
                  <dt className="text-muted">USDC.e on this wallet</dt>
                  <dd className="font-mono text-cyan">${till.usdceUsd.toFixed(3)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Mission cap</dt>
                  <dd className="font-mono">${till.missionCapUsd.toFixed(2)}</dd>
                </div>
              </dl>
              <div className="flex max-w-md flex-col gap-4 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2">
                  <span className="text-[12px] text-white/70">Amount (0G)</span>
                  <input className={inputCls} value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
                </label>
                <CyanButton disabled={!!till.busy} onClick={() => till.fund(fundAmt)}>
                  Fund Till
                </CyanButton>
              </div>
              <a
                className="mt-4 inline-block text-[14px] text-cyan underline-offset-4 hover:underline"
                href={HUB_SWAP}
                target="_blank"
                rel="noreferrer"
              >
                Get USDC.e on 0G Hub ↗
              </a>
            </ActionCard>
          )}

          {step === 4 && (
            <ActionCard
              what="Autonomous agent"
              why="Let this Till execute approved work without asking you to sign every transaction."
              next="The key stays in this browser, scoped to this Till. It cannot withdraw, change policy, or spend another Till. You can revoke it immediately."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[4.27px] border border-cyan/30 p-4">
                  <p className="font-semibold">Enable autonomous mode</p>
                  <p className="mt-2 text-[13px] text-white/60">
                    Create a device-local session key. Autonomous execution needs a small amount of 0G for transaction gas.
                  </p>
                  <div className="mt-4">
                    <CyanButton disabled={!!till.busy} onClick={till.attachAgent}>
                      Authorize session
                    </CyanButton>
                  </div>
                </div>
                <div className="rounded-[4.27px] border border-white/15 p-4">
                  <p className="font-semibold">Continue in owner mode</p>
                  <p className="mt-2 text-[13px] text-white/60">
                    Use your wallet to approve each on-chain proof. x402 purchases still settle without your key.
                  </p>
                  <button
                    type="button"
                    className="mt-4 text-[14px] text-white/55 underline-offset-4 hover:underline"
                    onClick={till.skipAgent}
                  >
                    Owner mode
                  </button>
                </div>
              </div>
              {till.agentOf && (
                <div className="mt-6 grid gap-3">
                  <p className="font-mono text-[12px] text-white/60">
                    Session {shortAddr(till.agentOf.address)} · gas {fmt0g(till.agentGas)} · expires {expiry}
                  </p>
                  {till.agentGas === 0n && (
                    <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex flex-1 flex-col gap-2">
                        <span className="text-[12px] text-white/70">Fund agent gas (0G)</span>
                        <input className={inputCls} value={gasAmt} onChange={(e) => setGasAmt(e.target.value)} />
                      </label>
                      <CyanButton disabled={!!till.busy} onClick={() => till.fundAgentGas(gasAmt)}>
                        Fund agent gas
                      </CyanButton>
                    </div>
                  )}
                  {till.authorized.length > 0 && till.agentGas > 0n && (
                    <p className="text-[14px] text-cyan">Autonomous mode on. Before You Pay will not ask MetaMask to sign the storage proof.</p>
                  )}
                </div>
              )}
            </ActionCard>
          )}

          {step === 5 && (
            <ActionCard
              what="Test the policy"
              why="Same rules the vault will run. No money moves."
              next="Then go live."
            >
              <div className="flex flex-wrap gap-3">
                <CyanButton disabled={!!till.busy} onClick={() => till.testPolicy(till.priceWei)}>
                  Test in-cap
                </CyanButton>
                <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.testPolicy(parseEther('9'))}>
                  Test over-cap
                </CyanButton>
              </div>
            </ActionCard>
          )}

          {till.tokenId != null && (
            <Metrics
              items={[
                { label: 'Till balance', value: fmt0g(till.available) },
                { label: 'USDC.e', value: `$${till.usdceUsd.toFixed(3)}` },
                { label: 'Limit', value: till.hasPolicy ? fmt0g(till.maxTxWei) + ' / tx' : 'none yet' },
                { label: 'Mode', value: autonomous ? 'Autonomous' : 'Owner' },
                {
                  label: 'Status',
                  value: till.paused ? 'Paused' : live ? 'Live' : 'Setup',
                  warn: till.paused,
                },
              ]}
            />
          )}

          {till.tokenIds.length > 1 && (
            <label className="flex max-w-xs flex-col gap-2">
              <span className="text-[12px] text-white/70">Active Till</span>
              <select
                className={inputCls}
                value={till.tokenId?.toString() ?? ''}
                onChange={(e) => till.setTokenId(BigInt(e.target.value))}
              >
                {till.tokenIds.map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    Till #{id.toString()}
                  </option>
                ))}
              </select>
            </label>
          )}

          {live && (
            <>
              <CanCannot
                can={[
                  `Buy quoted x402 checks in USDC.e (cap $${till.missionCapUsd.toFixed(2)})`,
                  autonomous
                    ? 'Anchor proof with the session key — no owner signature per purchase'
                    : 'Anchor proof as owner (you will sign)',
                  `Grant expires ${expiry}`,
                ]}
                cannot={[
                  'Receive the owner wallet',
                  'Withdraw. Only you can',
                  'Change this policy',
                  'Pay an UNAVAILABLE seller',
                ]}
              />

              <section>
                <p className="font-mono text-[11px] tracking-[0.16em] text-muted">What can I use Till for?</p>
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {EXAMPLES.map((ex) => (
                    <li key={ex.label}>
                      <button
                        type="button"
                        className="w-full rounded-[4.27px] border border-white/10 p-4 text-left hover:border-cyan"
                        onClick={() => setSubject(ex.value)}
                      >
                        <p className="font-semibold">{ex.label}</p>
                        <p className="mt-1 text-[12px] text-cyan">Try example</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {till.mission && <MissionCard mission={till.mission} purchases={till.purchases} />}
              {till.lastBrief && (
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
              )}
              <Pipeline steps={till.steps} tech={till.tech} />

              {till.lastExecutor ? (
                <p className="font-mono text-[11px] text-white/45">
                  Last on-chain executor: {till.lastExecutor === 'session' ? 'session key (no MetaMask)' : 'owner wallet'}
                </p>
              ) : null}

              <ActionCard
                what="Test over-budget spend"
                why={`Try a $5 service purchase against your $${till.missionCapUsd.toFixed(2)} mission cap.`}
                next="Expected: BLOCKED. $0 spent. Till balance unchanged."
              >
                <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.tryOverBudget()}>
                  Test over-budget spend
                </CyanButton>
              </ActionCard>

              <details className="rounded-[4.27px] border border-white/10 p-6">
                <summary className="cursor-pointer text-[15px] font-semibold">Owner controls</summary>
                <p className="mt-3 max-w-[50ch] text-[14px] text-white/55">
                  Pause, fund, withdraw. Revoke the session on Agents. These always use your wallet.
                </p>
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <CyanButton disabled={!!till.busy} onClick={() => till.fund(fundAmt)}>
                    Fund
                  </CyanButton>
                  <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.pause(!till.paused)}>
                    {till.paused ? 'Unpause' : 'Pause'}
                  </CyanButton>
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] text-white/70">Withdraw (0G)</span>
                    <input
                      className={`${inputCls} w-32`}
                      value={withdrawAmt}
                      onChange={(e) => setWithdrawAmt(e.target.value)}
                    />
                  </label>
                  <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.withdraw(withdrawAmt)}>
                    Withdraw
                  </CyanButton>
                </div>
              </details>
            </>
          )}

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
