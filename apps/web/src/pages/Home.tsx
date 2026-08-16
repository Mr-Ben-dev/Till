import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CyanButton } from '../components/CyanButton'
import { FlowDiagram } from '../components/FlowDiagram'
import { LayerBoard, LayerScene, LAYERS } from '../components/LayerBoard'
import { OgMark } from '../components/OgMark'
import { ProductAccordion } from '../components/ProductAccordion'
import { SiteFooter } from '../components/SiteFooter'
import { SmoothScroll } from '../components/SmoothScroll'

gsap.registerPlugin(ScrollTrigger)

const MARQUEE = [
  'Aristotle 16661',
  'Hard policy',
  'TEE glm-5.2',
  'Before you pay',
  'Storage proof',
  'ERC-8004',
  'Cannot empty you',
]

const WORDS =
  'The model proposes. The vault decides. Spend is capped, TEE-bound, and proven on Aristotle, not described in a dashboard.'

const PROOFS = [
  {
    tag: 'x402',
    date: '08.20.26',
    title: 'v3 AgentToll safety paid in USDC.e on 16661',
    href: 'https://chainscan.0g.ai/tx/0x58731e432ae12ba2ed3d428fe834d40c28c838cf599ea87aa254d4091b1a37a1',
  },
  {
    tag: 'x402',
    date: '08.20.26',
    title: 'v3 api402x oracle-staleness paid on 16661',
    href: 'https://chainscan.0g.ai/tx/0x3994a707a4c370a45fa98f39261c3ce1560af62656b45eda4ec64959b52315e3',
  },
  {
    tag: 'x402',
    date: '08.20.26',
    title: 'v3 token-risk bytecode paid on 16661',
    href: 'https://chainscan.0g.ai/tx/0x637d9ca7d4ecf39bb256ee0aae0d62be9ea4cb4e4ca857499e9e3da916c4679f',
  },
  {
    tag: 'Storage',
    date: '08.20.26',
    title: 'v3 mission packet anchored on Aristotle',
    href: 'https://chainscan.0g.ai/tx/0xefbe1b3d29564f19bed969d4737f9182fd80f30553f80acc09adb5617a0a5415',
  },
]

export function HomePage() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      gsap.from('[data-hero]', {
        opacity: 0,
        y: reduce ? 0 : 28,
        duration: reduce ? 0 : 1,
        stagger: 0.08,
        ease: 'expo.out',
      })
      if (reduce) return
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 86%' },
        })
      })
      const chars = gsap.utils.toArray<HTMLElement>('[data-scrub] span')
      gsap.fromTo(
        chars,
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.02,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-scrub]',
            start: 'top 75%',
            end: 'top 28%',
            scrub: true,
          },
        }
      )
      const pin = document.querySelector<HTMLElement>('[data-hscroll]')
      const track = document.querySelector<HTMLElement>('[data-htrack]')
      if (pin && track && window.matchMedia('(min-width: 900px)').matches) {
        const distance = () => track.scrollWidth - pin.clientWidth
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        })
      }
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <SmoothScroll>
      <main ref={root} className="landing w-full max-w-full overflow-x-hidden bg-navy">
        <section className="relative flex min-h-[100dvh] flex-col items-center px-5 pb-6 pt-24 text-center md:px-10">
          <h1 data-hero className="hero-h1 mx-auto max-w-[62rem] font-bold text-white">
            Give an agent a Till.
            <br />
            It cannot empty you.
          </h1>
          <p data-hero className="hero-sub mx-auto mt-4 max-w-[661px] text-white">
            Give it a Till so it can buy the resources it needs to finish useful work — without ever receiving your wallet.
          </p>
          <div data-hero className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <CyanButton to="/till">Open a Till</CyanButton>
            <CyanButton href="#layers" variant="ghost">
              The five layers
            </CyanButton>
          </div>
          <figure data-hero className="hero-visual relative mt-6 flex min-h-0 w-full max-w-[1400px] flex-1 flex-col">
            <FlowDiagram />
          </figure>
        </section>

        <section className="flex items-center justify-center gap-4 border-y border-white/10 px-5 py-5">
          <OgMark />
          <p className="font-mono text-[12px] tracking-[0.16em] text-white/60">Aristotle 16661</p>
        </section>

        <div className="overflow-hidden py-3.5">
          <div className="marquee-track flex w-max gap-16 whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.28em] text-white/50">
            {[...MARQUEE, ...MARQUEE].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        <section id="layers" className="bg-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <div className="mx-auto max-w-[1400px]">
            <h2 className="max-w-3xl text-[clamp(2rem,3.4vw,3.15rem)] font-bold leading-[1.08] tracking-tight">
              A Till is a drawer of permissions, not a wallet you hand over.
            </h2>
            <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-ink/70">
              You own the vault. Policy gates the spend. 0G Compute binds the digest. The agent
              never holds the key.
            </p>
            <div data-reveal className="mt-14">
              <LayerBoard />
            </div>
          </div>
        </section>

        <section data-hscroll className="relative hidden bg-navy md:block">
          <div data-htrack className="flex h-[100dvh] w-max items-stretch">
            {LAYERS.map((layer) => (
              <article key={layer.name} className="flex h-full w-[72vw] items-center gap-16 px-16">
                <div className="w-[42%] shrink-0">
                  <LayerScene kind={layer.scene} />
                </div>
                <div className="max-w-xl">
                  <p className="text-[15px] font-medium text-cyan">{layer.name}</p>
                  <h3 className="mt-3 text-[clamp(1.8rem,3vw,2.8rem)] font-bold leading-tight text-white">
                    {layer.title}
                  </h3>
                  <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-white/75">{layer.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="bg-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <div data-reveal className="mx-auto max-w-[720px]">
            <h2 className="text-[clamp(2rem,3.4vw,3.15rem)] font-bold leading-[1.08] tracking-tight">
              Connect. Create. Fund. Run. Prove.
            </h2>
            <p className="mt-5 max-w-[55ch] text-[17px] leading-relaxed text-ink/70">
              One operator flow. Every button waits for a receipt. CAN and CANNOT come from
              preview() on-chain.
            </p>
            <div className="mt-10">
              <ProductAccordion />
            </div>
          </div>
        </section>

        <section className="bg-navy px-5 py-24 md:px-10 md:py-36">
          <p
            data-scrub
            className="mx-auto max-w-5xl text-center text-[clamp(1.5rem,3.2vw,2.7rem)] font-bold leading-snug tracking-tight text-white"
          >
            {WORDS.split(' ').map((w, i) => (
              <span key={i} className="inline-block pr-[0.35em]">
                {w}
              </span>
            ))}
          </p>
        </section>

        <section className="bg-paper px-5 py-28 text-ink md:px-10 md:py-36">
          <div className="mx-auto max-w-[1400px]">
            <h2 className="max-w-3xl text-[clamp(2rem,3.4vw,3.15rem)] font-bold leading-[1.08]">
              Live hashes on Aristotle. Not a mood board.
            </h2>
            <ul className="mt-12 grid grid-flow-dense gap-px bg-ink/10 md:grid-cols-2 lg:grid-cols-4">
              {PROOFS.map((p) => (
                <li key={p.href} className="bg-paper">
                  <a href={p.href} className="group block p-6" rel="noreferrer">
                    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
                      <span>{p.tag}</span>
                      <span>{p.date}</span>
                    </div>
                    <h3 className="mt-4 text-[1.2rem] font-bold leading-snug group-hover:text-cyan">{p.title}</h3>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-cyan px-5 py-24 text-ink md:px-10 md:py-32">
          <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <h2 className="max-w-3xl text-[clamp(2.2rem,4.2vw,3.8rem)] font-bold leading-[1.05] tracking-tight">
              Open a Till. Keep the vault.
            </h2>
            <CyanButton to="/till" variant="ink">
              Open a Till
            </CyanButton>
          </div>
        </section>

        <SiteFooter />
      </main>
    </SmoothScroll>
  )
}
