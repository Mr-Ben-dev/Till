import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { LayerScene, LAYERS } from './LayerBoard'

const STOPS = [
  { scene: LAYERS[0].scene, name: 'You', sub: 'owner vault' },
  { scene: LAYERS[1].scene, name: 'Policy', sub: 'hard cap' },
  { scene: LAYERS[2].scene, name: 'Till', sub: 'spend drawer' },
  { scene: LAYERS[3].scene, name: '0G', sub: 'TEE bind' },
  { scene: LAYERS[4].scene, name: 'Brief', sub: 'report' },
] as const

export function FlowDiagram() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      gsap.from('[data-stop]', {
        opacity: 0,
        y: reduce ? 0 : 18,
        duration: reduce ? 0 : 0.7,
        stagger: 0.08,
        ease: 'expo.out',
      })
      const packet = root.current?.querySelector<HTMLElement>('[data-packet]')
      const rail = root.current?.querySelector<HTMLElement>('[data-rail]')
      if (!packet || !rail || reduce) return
      const travel = () => Math.max(0, rail.clientWidth - packet.offsetWidth)
      gsap.fromTo(
        packet,
        { x: 0 },
        {
          x: () => travel(),
          duration: 4.8,
          ease: 'none',
          repeat: -1,
          repeatDelay: 0.35,
        }
      )
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="spend-path" role="img" aria-label="Spend path from owner vault to paid receipt on 0G">
      <div className="spend-path__rail" data-rail>
        <span className="spend-path__packet" data-packet />
      </div>
      <ol className="spend-path__stops">
        {STOPS.map((stop) => (
          <li key={stop.name} data-stop className="spend-stop">
            <LayerScene kind={stop.scene} />
            <p className="mt-3 text-[15px] font-semibold text-white">{stop.name}</p>
            <p className="font-mono text-[11px] tracking-[0.12em] text-white/50">{stop.sub}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
// leave this
