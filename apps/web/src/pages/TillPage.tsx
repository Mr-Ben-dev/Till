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
import { Stepper } from '../components/app/Stepper'
import { fmt0g, shortAddr } from '../lib/errors'
import { txUrl, DEFAULT_BRIEF_SUBJECT } from '../lib/chain'
import { POLICY_TEMPLATES } from '../lib/human'

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
  const [template, setTemplate] = useState<(typeof POLICY_TEMPLATES)[number]['id']>('daily')
  const [withdrawAmt, setWithdrawAmt] = useState('0.001')
  const [gasAmt, setGasAmt] = useState('0.002')
  const [subject, setSubject] = useState(DEFAULT_BRIEF_SUBJECT)
  const chosen = POLICY_TEMPLATES.find((t) => t.id === template)!
  const live = step === 6
  const expiry =
    till.sessionExpiresAt > 0n
      ? new Date(Number(till.sessionExpiresAt) * 1000).toLocaleDateString()
      : 'not set'

  return (
    <main className="app-page">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted">0G Aristotle</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight tracking-tight">
        Before you pay
      </h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Your agent buys the intelligence it needs. Till controls every dollar.
      </p>

      <div className="mt-8">
        <Stepper current={step} />
      </div>

      <div className="mt-8 grid gap-4">
        {till.backend === 'down' && (
          <Notice
            tone="info"
            title="Payment services are offline"
            body="You can still create a Till, write policy, and fund. Private briefs and storage proofs wait until the service is back."
          />
        )}
        {till.wrongNetwork && (
          <Notice
            tone="info"
            title="Switch to 0G Aristotle"
            body="Your wallet is on another network. Till only spends on 0G Aristotle."
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
            body="Confirm in your wallet if it opens. This waits for a real receipt, not a timer."
          />
        )}
        {till.lastDenial && <DenialCard denial={till.lastDenial} />}
        {live && till.paused && (
          <Notice
            tone="info"
            title="This Till is paused"
            body="Unpause from Owner controls before the agent can buy."
          />
        )}
      </div>

      {!till.authenticated ? (
        <div className="mt-10">
          <ActionCard
            what="Connect your wallet"
            why="Privy opens a wallet or email login. Injected wallets stay supported."
            next="Next: create a Till. Your keys stay in the wallet."
          >
            <CyanButton onClick={till.login}>Connect</CyanButton>
          </ActionCard>
        </div>
      ) : (
        <div className="mt-10 grid gap-10">
          {step === 1 && (
            <ActionCard
              what="Create a Till"
              why="Mints a drawer you own. The agent never receives this wallet."
              next="Next: pick a spend cap. Confirm the mint in your wallet."
            >
              <p className="mb-4 text-[13px] text-white/50">Wallet {shortAddr(till.address)} · {fmt0g(till.walletBal)}</p>
              <CyanButton disabled={!!till.busy} onClick={till.mint}>
                Create Till
              </CyanButton>
            </ActionCard>
          )}

          {step === 2 && (
            <ActionCard
              what="Choose a policy"
              why="Caps live on-chain. The model can propose. The vault decides."
              next="Next: fund the Till. Three transactions write the template."
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
                        {t.max} / tx · {t.window} / day
                      </p>
                      <p className="mt-2 text-[13px] text-white/60">{t.why}</p>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CyanButton
                  disabled={!!till.busy}
                  onClick={() => till.setPolicy(chosen.max, chosen.window)}
                >
                  Use {chosen.name}
                </CyanButton>
              </div>
            </ActionCard>
          )}

          {step === 3 && (
            <ActionCard
              what="Fund the Till"
              why="0G sits in the vault. Only you can withdraw it."
              next="Next: attach an agent, or keep running as owner."
            >
              <div className="flex max-w-md flex-col gap-4 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2">
                  <span className="text-[12px] text-white/70">Amount (0G)</span>
                  <input className={inputCls} value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
                </label>
                <CyanButton disabled={!!till.busy} onClick={() => till.fund(fundAmt)}>
                  Fund
                </CyanButton>
              </div>
            </ActionCard>
          )}

          {step === 4 && (
            <ActionCard
              what="Attach an agent"
              why="Creates a device-local session key and authorizes it on this Till only. It cannot withdraw or change policy. Revoke turns it off immediately."
              next="The key stays in this browser. If it will sign itself, it still needs a little 0G for gas."
            >
              <CyanButton disabled={!!till.busy} onClick={till.attachAgent}>
                Create agent
              </CyanButton>
              <button
                type="button"
                className="ml-4 text-[14px] text-white/55 underline-offset-4 hover:underline"
                onClick={till.skipAgent}
              >
                {till.authorized.length > 0 ? 'Continue without gas' : 'Continue as owner'}
              </button>
              {till.agentOf && (
                <div className="mt-6 grid gap-3">
                  <p className="font-mono text-[12px] text-white/60">
                    Session {shortAddr(till.agentOf.address)} · gas {fmt0g(till.agentGas)}
                  </p>
                  {till.agentGas === 0n && (
                    <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex flex-1 flex-col gap-2">
                        <span className="text-[12px] text-white/70">Gas for the agent (0G)</span>
                        <input className={inputCls} value={gasAmt} onChange={(e) => setGasAmt(e.target.value)} />
                      </label>
                      <CyanButton disabled={!!till.busy} onClick={() => till.fundAgentGas(gasAmt)}>
                        Send gas
                      </CyanButton>
                    </div>
                  )}
                  {till.authorized.length > 0 && (
                    <p className="text-[14px] text-cyan">Agent ready</p>
                  )}
                </div>
              )}
            </ActionCard>
          )}

          {step === 5 && (
            <ActionCard
              what="Test the policy"
              why="This checks the same rules the vault will run. No money moves."
              next="Next: go live and run an investigation if you want."
            >
              <div className="flex flex-wrap gap-3">
                <CyanButton
                  disabled={!!till.busy}
                  onClick={() => till.testPolicy(till.priceWei)}
                >
                  Test in-cap
                </CyanButton>
                <CyanButton
                  variant="ghost"
                  disabled={!!till.busy}
                  onClick={() => till.testPolicy(parseEther('9'))}
                >
                  Test over-cap
                </CyanButton>
              </div>
            </ActionCard>
          )}

          {till.tokenId != null && (
            <Metrics
              items={[
                { label: 'Available', value: fmt0g(till.available) },
                { label: 'Locked', value: fmt0g(till.locked) },
                { label: "Today's spend", value: fmt0g(till.windowSpentWei) },
                { label: 'Limit', value: till.hasPolicy ? fmt0g(till.maxTxWei) + ' / tx' : 'none yet' },
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
                  'Buy quoted x402 resources in USDC.e on 0G Aristotle',
                  `Stay under the $${(0.5).toFixed(2)} mission cap`,
                  till.authorized.length ? 'Spend with the active grant' : 'Spend as owner until you attach an agent',
                  `Grant expires ${expiry}`,
                ]}
                cannot={[
                  'Receive the owner wallet.',
                  'Pay over the USDC.e cap.',
                  'Buy an UNAVAILABLE seller.',
                  'Withdraw. Only you can.',
                ]}
              />

              <ActionCard
                what="Before you pay"
                why="Paste a token, contract, protocol, wallet, or vendor. The agent needs three facts from three different providers, quotes the basket, then Till TEE-approves every dollar."
                next="Confirm Storage after the verdict. Then try a $5 buy against the $0.50 cap."
              >
                <label className="mb-4 flex max-w-xl flex-col gap-2">
                  <span className="text-[12px] text-white/70">Should I deposit into this?</span>
                  <input
                    className={inputCls}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={DEFAULT_BRIEF_SUBJECT}
                  />
                </label>
                {till.modelNote ? (
                  <p className="mb-4 text-[14px] text-white/70">
                    0G selected the appropriate trusted model for this request:{' '}
                    <span className="font-mono text-cyan">{till.modelNote}</span>
                  </p>
                ) : (
                  <p className="mb-4 text-[14px] text-white/55">
                    0G selected the appropriate trusted model for this request. Exact id appears after Compute answers.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <CyanButton
                    disabled={!!till.busy || till.backend !== 'ok' || !subject.trim()}
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

              <details className="rounded-[4.27px] border border-white/10 p-6">
                <summary className="cursor-pointer text-[15px] font-semibold">Owner controls</summary>
                <p className="mt-3 max-w-[50ch] text-[14px] text-white/55">
                  Pause freezes spend. Withdraw returns 0G to this wallet. Fund tops up the drawer. Revoke is on Agents.
                </p>
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] text-white/70">Fund (0G)</span>
                    <input
                      className={`${inputCls} w-32`}
                      value={fundAmt}
                      onChange={(e) => setFundAmt(e.target.value)}
                    />
                  </label>
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
