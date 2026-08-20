import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { ActionCard } from '../components/app/ActionCard'
import { ProductNotices } from '../components/app/ProductNotices'
import { POLICY_TEMPLATES } from '../lib/human'
import { saveTillName } from '../lib/tillMeta'
import { txUrl } from '../lib/chain'

const inputCls =
  'w-full rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm text-white outline-none focus:border-cyan'

export function CreateTillPage({ till }: { till: TillState }) {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(`Till ${(till.tokenIds.length + 1).toString()}`)
  const [preset, setPreset] = useState<(typeof POLICY_TEMPLATES)[number]['id']>('balanced')
  const [waiting, setWaiting] = useState(false)
  const [priorTx, setPriorTx] = useState<string | null>(null)
  const chosen = POLICY_TEMPLATES.find((t) => t.id === preset) ?? POLICY_TEMPLATES[1]
  const created = waiting && !till.busy && Boolean(till.lastTx) && till.lastTx !== priorTx && till.tokenId != null && !till.error

  useEffect(() => {
    if (till.error) setWaiting(false)
  }, [till.error])

  useEffect(() => {
    if (!created) return
    try {
      sessionStorage.setItem('till.pendingPreset', preset)
    } catch {
      /* ignore */
    }
    nav('/till')
  }, [created, preset, nav])

  if (!till.authenticated) {
    return (
      <main className="app-page">
        <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Create a Till</h1>
        <div className="mt-8">
          <ActionCard what="Connect first" why="Creating a Till is an on-chain mint on Aristotle 16661." next="Then name it and pick a protection preset.">
            <CyanButton onClick={till.login}>Connect</CyanButton>
          </ActionCard>
        </div>
      </main>
    )
  }

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <p className="mod-kicker">New Till</p>
      <h1 className="mt-2 text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Create a Till</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        You are creating a separate protected spending account. The agent never receives your wallet.
      </p>
      <div className="mt-8">
        <ProductNotices till={till} />
      </div>
      <ol className="create-steps mt-8">
        {['Name', 'Protection', 'Review', 'Confirm'].map((s, i) => (
          <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''}>
            {s}
          </li>
        ))}
      </ol>
      <section className="surf surf-accent mt-8">
        {created ? (
          <>
            <h2>Till created</h2>
            <p className="mod-lede">
              {name} is selected. Next: write the {chosen.name} policy, then fund it.
            </p>
            {till.lastTx ? (
              <p className="mt-4 font-mono text-[13px] text-cyan">
                <a className="underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              </p>
            ) : null}
            <div className="mt-6">
              <CyanButton to="/till">Open Till</CyanButton>
            </div>
          </>
        ) : step === 0 ? (
          <>
            <h2>Name this Till</h2>
            <label className="mt-5 flex max-w-md flex-col gap-2">
              <span className="text-[12px] text-white/70">Name</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="mt-6 flex gap-3">
              <CyanButton onClick={() => setStep(1)}>Continue</CyanButton>
              <Link className="self-center text-[14px] text-white/50" to="/tills">
                Cancel
              </Link>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h2>Choose protection</h2>
            <p className="mod-lede">You can change this after the mint. Saving policy is a second wallet signature.</p>
            <ul className="mt-5 grid gap-3 md:grid-cols-3">
              {POLICY_TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`h-full w-full rounded-[4.27px] border p-4 text-left ${
                      preset === t.id ? 'border-cyan bg-cyan/10' : 'border-white/15'
                    }`}
                    onClick={() => setPreset(t.id)}
                  >
                    <p className="font-semibold">{t.name}</p>
                    <p className="mt-2 text-[13px] text-white/55">{t.why}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <CyanButton variant="ghost" onClick={() => setStep(0)}>
                Back
              </CyanButton>
              <CyanButton onClick={() => setStep(2)}>Continue</CyanButton>
            </div>
          </>
        ) : (
          <>
            <h2>Review</h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="surf-inner">
                <dt>Name</dt>
                <dd>{name.trim() || `Till ${(till.tokenIds.length + 1).toString()}`}</dd>
              </div>
              <div className="surf-inner">
                <dt>Preset</dt>
                <dd>{chosen.name}</dd>
              </div>
              <div className="surf-inner">
                <dt>Network</dt>
                <dd>Aristotle · 16661</dd>
              </div>
              <div className="surf-inner">
                <dt>What happens</dt>
                <dd>Wallet signature mints the Till NFT</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] text-white/50">
              Policy is not written until you confirm it on the next screen. Nothing moves until the Aristotle receipt.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <CyanButton variant="ghost" onClick={() => setStep(1)}>
                Back
              </CyanButton>
              <CyanButton
                disabled={!!till.busy}
                onClick={() => {
                  setWaiting(true)
                  setPriorTx(till.lastTx)
                  saveTillName('pending', name)
                  void till.mint(name)
                }}
              >
                Confirm transaction
              </CyanButton>
            </div>
          </>
        )}
      </section>
      {created ? (
        <p className="mt-4 text-[13px] text-white/45">
          Or stay here.{' '}
          <button type="button" className="text-cyan underline" onClick={() => nav('/till')}>
            Open the new Till
          </button>
        </p>
      ) : null}
    </main>
  )
}
