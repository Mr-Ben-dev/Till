import type { PipelineStep } from '../../hooks/useTill'
import { txUrl } from '../../lib/chain'

const NODES = [
  { key: 'plan', title: '0G Aristotle', body: 'Mission starts on chain 16661' },
  { key: 'budget', title: 'Policy', body: 'Spend checked against this Till' },
  { key: 'tee', title: '0G Compute', body: 'Private model selected' },
  { key: 'tee2', title: 'TEE', body: 'Decision verified in hardware', from: 'tee' },
  { key: 'buy1', title: 'x402', body: 'Paid intel on Herald' },
  { key: 'result', title: 'Private analysis', body: 'BUY / HOLD / AVOID' },
  { key: 'storage', title: '0G Storage', body: 'Evidence anchored' },
  { key: 'proof', title: 'Proof', body: 'Receipt on Aristotle' },
] as const

function stateOf(steps: PipelineStep[], key: string): PipelineStep['state'] {
  const mapped = key === 'tee2' ? 'tee' : key
  return steps.find((s) => s.key === mapped)?.state ?? 'idle'
}

export function OgRail({
  steps,
  tech,
}: {
  steps: PipelineStep[]
  tech?: Record<string, string>
}) {
  return (
    <ol className="og-pipe" aria-label="0G pipeline">
      {NODES.map((n) => {
        const st = stateOf(steps, n.key)
        const model = n.key === 'tee' ? tech?.model : ''
        const hash =
          n.key === 'storage'
            ? tech?.anchorTx || tech?.flowTx
            : n.key === 'proof'
              ? tech?.buy1
              : n.key === 'buy1'
                ? tech?.buy1
                : ''
        return (
          <li key={n.key} className={`og-pipe__node is-${st}`}>
            <span className="og-pipe__pulse" aria-hidden />
            <p className="og-pipe__title">{n.title}</p>
            <p className="og-pipe__body">{n.body}</p>
            {model ? <p className="og-pipe__meta">{model}</p> : null}
            {hash ? (
              <a className="og-pipe__link" href={txUrl(hash)} target="_blank" rel="noreferrer">
                View proof
              </a>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
