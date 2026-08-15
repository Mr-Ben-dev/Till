type Variant = 'drawer' | 'fan' | 'rise' | 'lean'

export function StackGraphic({ variant = 'drawer', className = '' }: { variant?: Variant; className?: string }) {
  const offsets =
    variant === 'fan'
      ? [0, 6, 14, 24, 36]
      : variant === 'rise'
        ? [18, 12, 8, 4, 0]
        : variant === 'lean'
          ? [0, 3, 6, 9, 12]
          : [0, 2, 4, 6, 8]

  return (
    <svg viewBox="0 0 220 260" className={className} aria-hidden>
      {offsets.map((x, i) => {
        const y = 40 + i * 28
        const w = 140 - i * 4
        return (
          <g key={i} transform={`translate(${20 + x} ${y}) skewX(-18)`}>
            <rect width={w} height="18" rx="1.5" fill="#00BDE9" stroke="#0A1A24" strokeWidth="1.1" />
            <rect width={w} height="3" y="15" fill="#002032" opacity="0.18" />
          </g>
        )
      })}
    </svg>
  )
}
