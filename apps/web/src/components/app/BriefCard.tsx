import { humanCheck } from '../../lib/serviceLabels'
import { ProofRow } from './ProofRow'
import type { BriefDoc } from '../../lib/api'

const TONE: Record<string, string> = {
  BUY: 'border-cyan/50 bg-cyan/10 text-cyan',
  HOLD: 'border-white/25 bg-white/5 text-white',
  AVOID: 'border-danger/50 bg-danger/10 text-danger',
  TRUST: 'border-cyan/50 bg-cyan/10 text-cyan',
  CAUTION: 'border-white/25 bg-white/5 text-white',
  DONT: 'border-danger/50 bg-danger/10 text-danger',
  CLEAR: 'border-cyan/50 bg-cyan/10 text-cyan',
  ISSUES: 'border-danger/50 bg-danger/10 text-danger',
}

export function BriefCard({
  brief,
  model,
  trust,
  remainingUsd,
  sources,
  tee,
  storageTx,
  explorerNote = 'Verified on 0G Aristotle',
}: {
  brief: BriefDoc
  model?: string
  trust?: string
  spentUsd?: number
  remainingUsd?: number
  sources?: { seller: string; sku: string; usd: number; tx?: string }[]
  tee?: boolean
  storageTx?: string
  explorerNote?: string
}) {
  const verdict = brief.verdict ?? 'HOLD'
  const why = brief.risks.length ? brief.risks : brief.findings
  return (
    <article className="mt-6 overflow-hidden rounded-[4.27px] border border-white/15">
      <div className={`border-b px-6 py-6 ${TONE[verdict] ?? TONE.HOLD}`}>
        <p className="font-mono text-[11px] tracking-[0.18em]">VERDICT</p>
        <h2 className="mt-2 font-mono text-[clamp(2.2rem,5vw,3.4rem)] font-bold tracking-[0.08em]">{verdict}</h2>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-white/85">{brief.title}</p>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-2">
        <section>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">Why</p>
          <ol className="mt-3 grid gap-2">
            {why.slice(0, 3).map((w, i) => (
              <li key={w} className="text-[14px] leading-relaxed text-white/80">
                {i + 1}. {w}
              </li>
            ))}
          </ol>
        </section>
        <section className="grid gap-3 text-[14px] text-white/75">
          <p>
            <span className="text-muted">Evidence</span>{' '}
            {sources?.length ? `${sources.length} paid checks` : 'Public Aristotle RPC + private Compute'}
          </p>
          <p>
            <span className="text-muted">Cost</span> native 0G Compute (Payment Layer operator) · vault not debited for tokens
          </p>
          {remainingUsd != null && (
            <p>
              <span className="text-muted">Budget remaining</span> ${remainingUsd.toFixed(3)}
            </p>
          )}
          <p className="font-mono text-[12px] text-cyan">
            0G proof · TEE {tee ? 'yes' : 'no'} · Storage {storageTx ? 'yes' : 'no'} · Aristotle yes
          </p>
        </section>
      </div>
      <div className="border-t border-white/10 px-6 py-4">
        <p className="mb-2 font-mono text-[11px] tracking-[0.16em] text-muted">{explorerNote}</p>
        {sources?.map((s) => {
          const h = humanCheck(s.seller, s.sku)
          return (
            <ProofRow
              key={s.seller + s.sku}
              ok
              label={h.title}
              detail={`${h.body} · ${h.provider} · $${s.usd.toFixed(3)}`}
              hash={s.tx}
            />
          )
        })}
        {storageTx ? <ProofRow ok label="Storage anchored" hash={storageTx} /> : null}
      </div>
      <details className="border-t border-white/10 px-6 py-4">
        <summary className="cursor-pointer text-[13px] text-white/55">Evidence, model, TEE, storage</summary>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-white/70">{brief.summary}</p>
        {brief.next_action ? <p className="mt-3 text-[14px] text-cyan">{brief.next_action}</p> : null}
        <p className="mt-4 font-mono text-[11px] text-white/40">
          {brief.subject}
          {model ? ` · ${model}` : ''}
          {trust ? ` · ${trust}` : ''}
        </p>
      </details>
    </article>
  )
}
