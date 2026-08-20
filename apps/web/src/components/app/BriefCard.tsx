import type { BriefDoc } from '../../lib/api'

const TONE: Record<string, string> = {
  BUY: 'border-cyan/50 bg-cyan/10 text-cyan',
  HOLD: 'border-white/25 bg-white/5 text-white',
  AVOID: 'border-danger/50 bg-danger/10 text-danger',
}

export function BriefCard({
  brief,
  model,
  trust,
  spentUsd,
  remainingUsd,
  sources,
}: {
  brief: BriefDoc
  model?: string
  trust?: string
  spentUsd?: number
  remainingUsd?: number
  sources?: { seller: string; sku: string; usd: number }[]
}) {
  const verdict = brief.verdict ?? 'HOLD'
  return (
    <article className="mt-6 rounded-[4.27px] border border-cyan/40 bg-cyan/5 p-6">
      <p className="font-mono text-[11px] tracking-[0.16em] text-cyan">VERDICT</p>
      <p className={`mt-3 inline-block rounded-[4.27px] border px-3 py-1 font-mono text-[22px] font-bold tracking-[0.12em] ${TONE[verdict] ?? TONE.HOLD}`}>
        {verdict}
      </p>
      <h2 className="mt-4 text-[1.35rem] font-bold leading-tight text-white">{brief.title}</h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-white/80">{brief.summary}</p>
      {brief.findings.length > 0 && (
        <div className="mt-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Key findings</p>
          <ul className="mt-2 grid gap-2">
            {brief.findings.map((f) => (
              <li key={f} className="text-[14px] leading-relaxed text-white/80">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {brief.risks.length > 0 && (
        <div className="mt-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Risks</p>
          <ul className="mt-2 grid gap-2">
            {brief.risks.map((r) => (
              <li key={r} className="text-[14px] leading-relaxed text-white/70">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-5 text-[14px] text-white/80">
        Confidence <span className="font-mono text-cyan">{brief.confidence ?? 'medium'}</span>
      </p>
      {sources && sources.length > 0 && (
        <p className="mt-3 text-[13px] text-white/60">
          Purchased sources:{' '}
          {sources.map((s) => `${s.seller} ${s.sku} $${s.usd.toFixed(3)}`).join(' · ')}
        </p>
      )}
      {spentUsd != null && remainingUsd != null && (
        <p className="mt-2 font-mono text-[13px] text-cyan">
          Spent ${spentUsd.toFixed(3)} · remaining ${remainingUsd.toFixed(3)}
        </p>
      )}
      {brief.next_action && <p className="mt-5 text-[14px] text-cyan">Next: {brief.next_action}</p>}
      <p className="mt-4 font-mono text-[11px] text-white/45">
        {brief.subject}
        {model ? ` · ${model}` : ''}
        {trust ? ` · ${trust}` : ''}
      </p>
    </article>
  )
}
// leave this
