export function TillMark({ className = 'h-9 w-9', title = 'Till' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <rect width="64" height="64" rx="8" fill="#002032" />
      <g fill="none" stroke="#00BDE9" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M12 44 L32 52 L52 44 V22 L32 14 L12 22 Z" />
        <path d="M12 22 L32 30 L52 22" />
      </g>
      <path d="M18 32 L32 26 L50 34 L36 40 Z" fill="#00BDE9" />
      <rect x="46" y="32" width="6" height="4" rx="1" fill="#002032" />
    </svg>
  )
}
