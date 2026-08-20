import { txUrl } from '../../lib/chain'

export function ProofRow({
  ok,
  label,
  hash,
  detail,
  amount,
  asset,
  network = 'Aristotle',
  provider,
  status,
}: {
  ok: boolean
  label: string
  hash?: string
  detail?: string
  amount?: string
  asset?: string
  network?: string
  provider?: string
  status?: string
}) {
  const short = hash ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3 last:border-0">
      <div>
        <p className="text-[14px] text-white">
          <span className={ok ? 'text-cyan' : 'text-white/35'}>{ok ? '✓' : '○'}</span> {label}
        </p>
        {amount ? (
          <p className="mt-1 font-mono text-[12px] text-white/70">
            {amount}
            {asset ? ` ${asset}` : ''}
            {provider ? ` · ${provider}` : ''} · {network}
            {status ? ` · ${status}` : ''}
          </p>
        ) : null}
        {detail ? <p className="mt-1 text-[12px] text-white/50">{detail}</p> : null}
      </div>
      {hash ? (
        <a
          className="font-mono text-[11px] text-cyan underline-offset-2 hover:underline"
          href={txUrl(hash)}
          target="_blank"
          rel="noreferrer"
        >
          View on ChainScan ↗ {short}
        </a>
      ) : (
        <span className="font-mono text-[11px] text-white/30">waiting</span>
      )}
    </div>
  )
}
