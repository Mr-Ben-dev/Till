import { memo, useEffect, useRef } from 'react'

export type LedgerVariant = 'hero' | 'tower' | 'fan' | 'arch' | 'wide'

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * amt)
  const g = Math.round(((n >> 8) & 255) * amt)
  const b = Math.round((n & 255) * amt)
  return `rgb(${r},${g},${b})`
}

function sheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  depth: number,
  thick: number,
  fill: string
) {
  const dx = depth
  const dy = depth * 0.38
  ctx.lineJoin = 'miter'
  ctx.lineWidth = 1.05
  ctx.strokeStyle = '#0A1A24'

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w + dx, y - dy)
  ctx.lineTo(x + dx, y - dy)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + thick)
  ctx.lineTo(x, y + thick)
  ctx.closePath()
  ctx.fillStyle = shade(fill, 0.78)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + w, y)
  ctx.lineTo(x + w + dx, y - dy)
  ctx.lineTo(x + w + dx, y - dy + thick)
  ctx.lineTo(x + w, y + thick)
  ctx.closePath()
  ctx.fillStyle = shade(fill, 0.62)
  ctx.fill()
  ctx.stroke()
}

function stack(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  count: number,
  t: number,
  mx: number,
  my: number,
  opts: { w: number; gap: number; depth: number; thick: number; fill: string; drift: number }
) {
  for (let i = count - 1; i >= 0; i--) {
    const wave = Math.sin(t * 0.85 + i * 0.32 + opts.drift) * 5.5
    const x = ox + i * 2.4 + mx * (10 + i * 0.8) + wave * 0.2
    const y = oy + i * opts.gap + my * (8 + i * 0.5) + wave
    sheet(ctx, x, y, opts.w - i * 1.1, opts.depth, opts.thick, opts.fill)
  }
}

export const LedgerField = memo(function LedgerField({
  variant = 'hero',
  className = '',
  fill = '#00BDE9',
}: {
  variant?: LedgerVariant
  className?: string
  fill?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let t = 0
    const mouse = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = (e.clientX - r.left) / r.width - 0.5
      mouse.y = (e.clientY - r.top) / r.height - 0.5
    }
    canvas.addEventListener('pointermove', onMove)

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, width * dpr)
      canvas.height = Math.max(1, height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const paint = () => {
      if (!reduce) t += 0.011
      const { width, height } = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, width, height)
      const mx = mouse.x
      const my = mouse.y
      if (variant === 'hero' || variant === 'wide') {
        const clusters = 5
        for (let c = 0; c < clusters; c++) {
          const cx = (width / clusters) * c + width * 0.02
          const cy = height * 0.34 + (c % 2) * height * 0.05
          stack(ctx, cx, cy, 12 + (c % 3), t, mx, my, {
            w: Math.min(240, width * 0.2),
            gap: 14,
            depth: 38,
            thick: 9,
            fill,
            drift: c * 1.15,
          })
        }
      } else if (variant === 'tower') {
        stack(ctx, width * 0.18, height * 0.12, 20, t, mx, my, {
          w: width * 0.52,
          gap: height * 0.038,
          depth: 42,
          thick: 8,
          fill,
          drift: 0.4,
        })
      } else if (variant === 'fan') {
        ctx.save()
        ctx.translate(width * 0.28, height * 0.55)
        for (let i = 0; i < 12; i++) {
          ctx.save()
          ctx.rotate(-0.42 + i * 0.075 + Math.sin(t + i * 0.2) * 0.018)
          sheet(ctx, 0, -i * 2, width * 0.55, 36, 9, fill)
          ctx.restore()
        }
        ctx.restore()
      } else {
        for (let i = 0; i < 12; i++) {
          const x = width * 0.08 + i * (width * 0.05)
          const y = height * 0.38 + Math.sin(i * 0.55 + t) * 16 + i * 7
          sheet(ctx, x, y, width * 0.46, 32, 9, fill)
        }
      }
      if (!reduce) raf = requestAnimationFrame(paint)
    }
    paint()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
    }
  }, [variant, fill])

  return <canvas ref={ref} className={className} aria-hidden />
})
// note
