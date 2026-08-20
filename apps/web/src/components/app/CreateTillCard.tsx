import { loadTillName, saveTillName } from '../../lib/tillMeta'
import { POLICY_TEMPLATES } from '../../lib/human'
import { CyanButton } from '../CyanButton'
import type { TillState } from '../../hooks/useTill'
import { useState } from 'react'
import { txUrl } from '../../lib/chain'

export function CreateTillCard({ till }: { till: TillState }) {
  const [name, setName] = useState(`Till ${(till.tokenIds.length + 1).toString()}`)
  const [preset, setPreset] = useState<(typeof POLICY_TEMPLATES)[number]['id']>('balanced')
  const created = till.lastTx && till.busy === '' && till.tokenId != null
  return (
    <section className="surf surf-accent" id="create">
      <p className="mod-kicker">Create a Till</p>
      <h2>Open another spend account</h2>
      <p className="mod-lede">
        Each Till has its own balance, policy, and agent session. The agent never receives your wallet.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-[12px] text-white/70">Name</span>
          <input
            className="rounded-[4.27px] border border-white/15 bg-navy px-3 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div>
          <p className="text-[12px] text-white/70">Protection preset</p>
          <ul className="mt-2 grid gap-2">
            {POLICY_TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`w-full rounded-[4.27px] border px-3 py-2 text-left text-[14px] ${
                    preset === t.id ? 'border-cyan bg-cyan/10' : 'border-white/15'
                  }`}
                  onClick={() => setPreset(t.id)}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="ml-2 text-white/50">{t.why}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-white/50">
        Creating a Till requires a wallet signature. Setting the preset is a second signature after the mint receipt.
      </p>
      <div className="mt-5">
        <CyanButton
          disabled={!!till.busy}
          onClick={() => {
            saveTillName('pending', name)
            void till.mint(name)
          }}
        >
          Create Till
        </CyanButton>
      </div>
      {created ? (
        <p className="mt-4 text-[14px] text-white/75">
          Till created on Aristotle.{' '}
          <a className="text-cyan underline" href={txUrl(till.lastTx)} target="_blank" rel="noreferrer">
            View transaction
          </a>
          {till.tokenId != null ? ` · ${loadTillName(till.tokenId)} is now selected.` : ''} Write the {POLICY_TEMPLATES.find((t) => t.id === preset)?.name} policy next.
        </p>
      ) : null}
    </section>
  )
}
