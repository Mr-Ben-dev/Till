import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Pipeline } from '../components/Pipeline'
import { BriefCard } from '../components/app/BriefCard'
import { MissionCard } from '../components/app/MissionCard'
import { ProductNotices } from '../components/app/ProductNotices'
import { SignHint } from '../components/app/SignHint'
import { TillSkeleton } from '../components/app/TillContextBar'
import { compileMission, liveModels } from '../lib/api'
import { txUrl } from '../lib/chain'
import { loadTillName } from '../lib/tillMeta'
import { setupReady } from '../lib/setup'
import { fmt0g } from '../lib/errors'

type Preset = 'auto' | 'cheap' | 'fast' | 'deep' | 'private'

const FAMILIES = [
  { id: 'investigate', title: 'Investigate', body: 'Is this address, token, or protocol something I should touch?' },
  { id: 'review', title: 'Review', body: 'Solidity, ABI, or a contract. AI-assisted — not a certified audit.' },
  { id: 'research', title: 'Research', body: 'A private structured brief. Not a chatbot.' },
  { id: 'compare', title: 'Compare', body: 'Two addresses or artifacts. Differences, not a scoreboard.' },
] as const

export function MissionPage({ till }: { till: TillState }) {
  const [text, setText] = useState('')
  const [family, setFamily] = useState<(typeof FAMILIES)[number]['id'] | ''>('')
  const [artifact, setArtifact] = useState('')
  const [ask, setAsk] = useState('')
  const [compiled, setCompiled] = useState('')
  const [autoOpen, setAutoOpen] = useState(false)
  const [preset, setPreset] = useState<Preset>('auto')
  const [catalog, setCatalog] = useState<{
    count: number
    presets?: Record<string, string>
    spendAllow?: { id: string; verifiability: string }[]
    note?: string
  } | null>(null)
  const live = setupReady(till)

  useEffect(() => {
    if (!autoOpen || catalog) return
    void liveModels()
      .then(setCatalog)
      .catch(() => setCatalog({ count: 0, note: 'Live catalog unavailable. AUTO will retry at run time.' }))
  }, [autoOpen, catalog])
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
      setAsk(res.ask || res.refuse || res.copilot || '')
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
      preset,
    })
  }

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      {loading || !till.tokenId ? (
        <TillSkeleton label={`Loading ${till.tokenId != null ? loadTillName(till.tokenId) : 'Till'}…`} />
      ) : (
        <>
          <header className="surf mb-8">
            <p className="mod-kicker">Work Desk</p>
            <h1 className="text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold leading-tight">What do you need done?</h1>
            <p className="mod-lede mt-3 max-w-[58ch]">
              Tell your agent the result you want. It finishes the work inside this Till&apos;s native 0G policy. You
              never hand it your wallet.
            </p>
          </header>
          <ProductNotices till={till} hideDenial />
          <section className="surf mt-8">
            <label className="block">
              <span className="text-[13px] text-white/55">Request</span>
              <textarea
                className="mt-2 w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-3 text-sm"
                rows={4}
                placeholder="Investigate this contract… Review this Solidity… Compare these two addresses…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <p className="mt-6 text-[13px] tracking-[0.16em] text-white/45">WORK TYPE</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] text-white/55">Model</p>
                <p className="mt-1 font-semibold">{preset === 'auto' ? 'AUTO' : preset.toUpperCase()}</p>
                <p className="text-[13px] text-white/50">Let Till choose the best live 0G model for this job.</p>
              </div>
              <button type="button" className="text-[13px] text-cyan" onClick={() => setAutoOpen((v) => !v)}>
                {autoOpen ? 'Hide models' : 'Choose model'}
              </button>
            </div>
            {autoOpen ? (
              <div className="mt-3 space-y-3 text-[13px] text-white/55">
                <p>{catalog?.note || 'Fetching live 0G catalog…'}</p>
                <div className="flex flex-wrap gap-2">
                  {(['auto', 'cheap', 'fast', 'deep', 'private'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-[4.27px] border px-3 py-1.5 ${preset === id ? 'border-cyan text-cyan' : 'border-white/20'}`}
                      onClick={() => setPreset(id)}
                    >
                      {id === 'auto' ? 'AUTO' : id.toUpperCase()}
                      {id !== 'auto' && catalog?.presets?.[id] ? ` · ${catalog.presets[id]}` : ''}
                    </button>
                  ))}
                </div>
                <p>
                  {catalog
                    ? `${catalog.count} models live · ${catalog.spendAllow?.length ?? 0} TeeML+JSON may ALLOW. CUSTOM unverified models are blocked.`
                    : null}
                </p>
              </div>
            ) : null}
            <p className="mt-4 text-[13px] text-white/55">
              Budget {fmt0g(till.available)} available · policy max {fmt0g(till.maxTxWei)} per tx · Balanced
            </p>
            {ask ? <p className="mt-4 text-cyan">{ask}</p> : null}
            {compiled ? <p className="mt-4 text-white/80">{compiled}</p> : null}
            {till.authorized.length > 0 ? (
              <SignHint kind="auto" write="mission" />
            ) : (
              <SignHint
                kind="owner"
                write="mission"
                why="This Till has no READY session. Enable an agent first. APP work is not autonomous in owner mode."
              />
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <CyanButton disabled={till.writeLocked || !text.trim()} onClick={() => void compile()}>
                Compile
              </CyanButton>
              <CyanButton disabled={till.writeLocked || !text.trim() || !live} onClick={() => void start()}>
                Start work
              </CyanButton>
              <CyanButton variant="ghost" disabled={till.writeLocked} onClick={till.tryOverBudget}>
                Test over-budget 0G
              </CyanButton>
            </div>
          </section>
          {till.lastDenial?.kind === 'overbudget' ? (
            <section className="surf surf-accent mt-8" id="blocked">
              <p className="mod-kicker">Test over-budget 0G</p>
              <h2>BLOCKED</h2>
              <p className="mt-2 font-mono text-cyan">5 0G requested · 0 moved</p>
              <p className="mt-3 text-white/70">{till.lastDenial.why}</p>
              <p className="mt-2 text-[13px] text-white/45">This is an intentional security test, not a real purchase.</p>
            </section>
          ) : till.lastDenial ? (
            <section className="surf surf-accent mt-8" id="blocked">
              <p className="mod-kicker">Work blocked</p>
              <h2>BLOCKED</h2>
              <p className="mt-3 text-white/70">{till.lastDenial.why}</p>
              <p className="mt-2 text-[13px] text-white/45">Nothing left the vault.</p>
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
                spentUsd={0}
                sources={[]}
              />
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono tracking-[0.12em]">
                <span className="rounded-[4.27px] border border-cyan/40 px-2 py-1 text-cyan">PRIVATE</span>
                <span className="rounded-[4.27px] border border-cyan/40 px-2 py-1 text-cyan">
                  TEE {till.tech.processResponse === 'true' ? 'VERIFIED' : 'PENDING'}
                </span>
                <span className="rounded-[4.27px] border border-white/20 px-2 py-1 text-white/70">NOT SHARED WITH SELLERS</span>
                <span className="rounded-[4.27px] border border-white/20 px-2 py-1 text-white/70">
                  {till.tech.anchorTx ? 'STORED' : 'NOT STORED'}
                </span>
              </div>
              <details className="mt-4 rounded-[4.27px] border border-white/10 p-4">
                <summary className="cursor-pointer text-white/70">Proof</summary>
                <ul className="mt-3 space-y-2 font-mono text-[12px] text-white/60">
                  {till.tech.anchorTx ? (
                    <li>
                      <a className="text-cyan" href={txUrl(till.tech.anchorTx)}>
                        Anchor {till.tech.anchorTx.slice(0, 10)}…
                      </a>
                    </li>
                  ) : null}
                  {till.tech.flowTx ? (
                    <li>
                      <a className="text-cyan" href={txUrl(till.tech.flowTx)}>
                        Storage flow {till.tech.flowTx.slice(0, 10)}…
                      </a>
                    </li>
                  ) : null}
                  <li>Signer {till.tech.signer || 'session'}</li>
                  <li>Model {till.briefModel || till.tech.model}</li>
                  <li>Provider {till.tech.provider}</li>
                  <li>{till.tech.money || 'Payment Layer bills operator Compute. TillVault not debited for tokens.'}</li>
                </ul>
              </details>
            </section>
          ) : null}
          {till.mission && (till.mission.quotes?.length ?? 0) > 0 ? (
            <MissionCard mission={till.mission} purchases={till.purchases} />
          ) : till.mission?.moneyNote ? (
            <p className="mt-6 max-w-[62ch] text-[13px] text-white/55">{till.mission.moneyNote}</p>
          ) : null}
        </>
      )}
    </main>
  )
}
