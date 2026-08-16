import type { ReactNode } from 'react'

export function Notice({
  tone = 'info',
  title,
  body,
  action,
}: {
  tone?: 'info' | 'danger' | 'ok' | 'block'
  title: string
  body?: string
  action?: ReactNode
}) {
  const border =
    tone === 'danger' || tone === 'block'
      ? 'border-danger/35 bg-danger/10'
      : tone === 'ok'
        ? 'border-cyan/30 bg-cyan/10'
        : 'border-white/15 bg-white/[0.04]'
  const color = tone === 'danger' || tone === 'block' ? 'text-danger' : tone === 'ok' ? 'text-cyan' : 'text-white'
  return (
    <div className={`rounded-[4.27px] border px-4 py-3 ${border}`}>
      <p className={`text-[15px] font-semibold ${color}`}>{title}</p>
      {body ? <p className="mt-1 text-[14px] leading-relaxed text-white/70">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
