import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { BriefCard } from '../components/app/BriefCard'
import { MissionCard } from '../components/app/MissionCard'
import { ProductNotices } from '../components/app/ProductNotices'
import { SignHint } from '../components/app/SignHint'
import { TillSkeleton } from '../components/app/TillContextBar'
import { compileMission } from '../lib/api'
import { txUrl } from '../lib/chain'
import { loadTillName } from '../lib/tillMeta'
import { setupReady } from '../lib/setup'

const FAMILIES = [
  { id: 'pay', title: 'Before You Pay', body: 'Should I send funds to this token, protocol, or contract?' },
  { id: 'trust', title: 'Before You Trust', body: 'Should I grant this address or agent any authority?' },
  { id: 'research', title: 'Research For Me', body: 'A private structured brief. Not a chatbot.' },
  { id: 'review', title: 'Review This', body: 'Solidity, ABI, or a contract. AI-assisted — not a certified audit.' },
] as const

export function MissionPage({ till }: { till: TillState }) {
  const [text, setText] = useState('')
  const [family, setFamily] = useState<(typeof FAMILIES)[number]['id'] | ''>('')
  const [artifact, setArtifact] = useState('')
  const [ask, setAsk] = useState('')
  const [compiled, setCompiled] = useState('')
  const live = setupReady(till)
  const loading =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))

  if (till.ready && !till.authenticated) return <Navigate to="/tills" replace />
  if (till.authenticated && till.hydrated && !till.switching && till.tokenId == null) {
    return <Navigate to="/tills" replace />
  }

  const compile = async () => {
    const res = await compileMission({ text, family: family || undefined, artifact: artifact || undefined })
    if (!res.ok) {
      setAsk(res.ask || res.refuse || '')
      setCompiled('')
      if (res.refuse) till.setError(res.refuse)
      return res
    }
    setAsk('')
    setCompiled(res.familyLabel || res.goal || '')
    if (res.family) setFamily(res.family as typeof family)
    return res
  }

  const start = async () => {
    if (!live) {
      till.setError('Finish setup first: protect, fund, then enable an agent.')
      return
    }
    const res = await compile()
    if (!res?.ok) return
    void till.payX402(text.trim(), {
      family: (res.family as typeof family) || family || undefined,
      artifact: artifact || text.trim() || undefined,
    })
  }

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      {loading || !till.tokenId ? (
        <TillSkeleton label={`Loading ${till.tokenId != null ? loadTillName(till.tokenId) : 'Till'}…`} />
      ) : (
        <>
          <header className="surf mb-8">
            <p className="mod-kicker">Mission Desk</p>
            <h1 className="text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold leading-tight">What do you need done?</h1>
            <p className="mod-lede mt-3 max-w-[58ch]">
              Tell your agent the result you want. It buys specialist facts when needed. You never hand it your wallet.
            </p>
            <p className="mt-4 text-[13px] text-white/55">
              USDC.e is limited by this mission&apos;s session drawer, not by TillPolicy. Native 0G policy is a separate vault rail.
            </p>
          </header>
          <ProductNotices till={till} hideDenial />
          <section className="surf mt-8">
            <p className="mod-kicker">Family</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`rounded-[4.27px] border p-4 text-left ${family === f.id ? 'border-cyan bg-cyan/10' : 'border-white/15'}`}
                  onClick={() => setFamily(f.id)}
                >
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-1 text-[14px] text-white/60">{f.body}</p>
                </button>
              ))}
            </div>
            <label className="mt-6 block">
              <span className="text-[13px] text-white/55">Request</span>
              <textarea
                className="mt-2 w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-3 text-sm"
                rows={3}
                placeholder="I’m considering putting $500 into this protocol…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            {family === 'review' ? (
              <label className="mt-4 block">
                <span className="text-[13px] text-white/55">Artifact (Solidity, ABI, diff)</span>
                <textarea
                  className="mt-2 w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-3 font-mono text-[12px]"
                  rows={8}
                  value={artifact}
                  onChange={(e) => setArtifact(e.target.value)}
                />
                <p className="mt-2 text-[12px] text-white/45">AI-assisted review — not a certified audit.</p>
              </label>
            ) : null}
            {ask ? <p className="mt-4 text-cyan">{ask}</p> : null}
            {compiled ? <p className="mt-4 text-white/80">{compiled}</p> : null}
            {till.signKind === 'owner' ? (
              <SignHint kind="owner" write={till.lastWrite} />
            ) : (
              <SignHint kind="auto" write="mission" />
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <CyanButton disabled={till.writeLocked || !text.trim()} onClick={() => void compile()}>
                Compile
              </CyanButton>
              <CyanButton disabled={till.writeLocked || !text.trim() || !live} onClick={() => void start()}>
                Start
              </CyanButton>
              <CyanButton variant="ghost" disabled={till.writeLocked} onClick={till.tryOverBudget}>
                Test over-budget spend
              </CyanButton>
            </div>
            <p className="mt-3 text-[12px] text-white/45">
              Session drawer {till.drawerUsdceUsd.toFixed(3)} USDC.e · owner wallet {till.usdceUsd.toFixed(3)} USDC.e ·
              hard max $0.50
            </p>
          </section>
          {till.lastDenial?.kind === 'overbudget' ? (
            <section className="surf surf-accent mt-8" id="blocked">
              <p className="mod-kicker">Test over-budget spend</p>
              <h2>BLOCKED</h2>
              <p className="mt-2 font-mono text-cyan">$5 requested · $0 spent · $0.50 mission limit</p>
              <p className="mt-3 text-white/70">{till.lastDenial.why}</p>
              <p className="mt-2 text-[13px] text-white/45">This is an intentional security test, not a real purchase.</p>
            </section>
          ) : till.lastDenial ? (
            <section className="surf surf-accent mt-8" id="blocked">
              <p className="mod-kicker">Mission blocked</p>
              <h2>BLOCKED</h2>
              <p className="mt-3 text-white/70">{till.lastDenial.why}</p>
              <p className="mt-2 text-[13px] text-white/45">
                {till.lastDenial.vault === false
                  ? 'USDC.e for this mission sits in the session drawer, not the Till vault. Leftover is swept back to the owner.'
                  : 'Nothing left the vault.'}
              </p>
            </section>
          ) : null}
          <section className="mt-8">
            <Pipeline steps={till.steps} tech={till.tech} />
          </section>
          {till.lastBrief ? (
            <section className="mt-8">
              <BriefCard
                brief={till.lastBrief}
                model={till.briefModel}
                trust={till.briefTrust}
                tee={till.tech.tee === 'true' || till.tech.processResponse === 'true'}
                storageTx={till.tech.anchorTx}
                spentUsd={till.purchases.reduce((n, p) => n + p.quote.amountUsd, 0)}
                sources={till.purchases.map((p) => ({
                  seller: p.seller,
                  sku: p.sku,
                  usd: p.quote.amountUsd,
                  tx: p.ogTx,
                }))}
              />
              <details className="mt-4 rounded-[4.27px] border border-white/10 p-4">
                <summary className="cursor-pointer text-white/70">Proof</summary>
                <ul className="mt-3 space-y-2 font-mono text-[12px] text-white/60">
                  {till.lastTx ? (
                    <li>
                      <a className="text-cyan" href={txUrl(till.lastTx)}>
                        Settlement {till.lastTx.slice(0, 10)}…
                      </a>
                    </li>
                  ) : null}
                  {till.tech.sweepTx ? (
                    <li>
                      <a className="text-cyan" href={txUrl(till.tech.sweepTx)}>
                        Sweep {till.tech.sweepTx.slice(0, 10)}…
                      </a>
                    </li>
                  ) : null}
                  {till.tech.anchorTx ? (
                    <li>
                      <a className="text-cyan" href={txUrl(till.tech.anchorTx)}>
                        Anchor {till.tech.anchorTx.slice(0, 10)}…
                      </a>
                    </li>
                  ) : null}
                  <li>Signer {till.tech.signer || 'session'}</li>
                  <li>Model {till.briefModel || till.tech.model}</li>
                </ul>
              </details>
            </section>
          ) : null}
          {till.mission ? <MissionCard mission={till.mission} purchases={till.purchases} /> : null}
        </>
      )}
    </main>
  )
}
