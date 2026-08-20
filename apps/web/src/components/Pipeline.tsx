import type { PipelineStep } from '../hooks/useTill'
import { txUrl } from '../lib/chain'

export function Pipeline({ steps, tech }: { steps: PipelineStep[]; tech: Record<string, string> }) {
  return (
    <div className="mt-8">
      <ol className="pipe">
        {steps.map((s) => (
          <li key={s.key} className={`pipe__row is-${s.state}`}>
            <span className="pipe__label">{s.label}</span>
            <span className="pipe__state">
              {s.state === 'ok'
                ? 'confirmed'
                : s.state === 'fail'
                  ? 'blocked'
                  : s.state === 'skip'
                    ? 'skipped'
                    : s.state === 'wait'
                      ? 'waiting'
                      : 'idle'}
            </span>
            <span className="pipe__detail">{s.detail ?? ''}</span>
          </li>
        ))}
      </ol>
      {tech.model ? (
        <p className="mt-4 text-[14px] text-white/70">
          0G selected the appropriate trusted model for this request.
          <span className="ml-2 font-mono text-cyan">{tech.model}</span>
        </p>
      ) : null}
      {Object.keys(tech).length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-[12px] text-muted">Technical details</summary>
          <dl className="mt-4 grid gap-2 font-mono text-[11px] text-white/70">
            {Object.entries(tech).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="break-all">
                  {k.toLowerCase().includes('tx') || k === 'digest' || k.startsWith('buy') ? (
                    k.toLowerCase().includes('tx') || k.startsWith('buy') ? (
                      <a href={txUrl(v)} className="text-cyan underline">
                        {v}
                      </a>
                    ) : (
                      v
                    )
                  ) : (
                    v
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  )
}
