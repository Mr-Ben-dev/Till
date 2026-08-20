import type { ReactNode } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

function Arrow() {
  return <ArrowRight size={16} weight="regular" aria-hidden />
}

export function CyanButton({
  to,
  href,
  onClick,
  children,
  variant = 'solid',
  type = 'button',
  className = '',
  disabled = false,
}: {
  to?: string
  href?: string
  onClick?: () => void
  children: ReactNode
  variant?: 'solid' | 'ghost' | 'ink'
  type?: 'button' | 'submit'
  className?: string
  disabled?: boolean
}) {
  const cls = `btn-till --${variant} ${disabled ? 'is-disabled' : ''} ${className}`.trim()
  const inner = (
    <>
      <span className="btn-till__label">{children}</span>
      <span className="btn-till__well">
        <span className="btn-till__icon --1">
          <Arrow />
        </span>
        <span className="btn-till__icon --2">
          <Arrow />
        </span>
      </span>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  )
}
// ok
