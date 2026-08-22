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
import { USES } from '../lib/serviceLabels'
import { PROOFS as DOC_PROOFS } from '../lib/docsTruth'

gsap.registerPlugin(ScrollTrigger)

const MARQUEE = [
  'Aristotle 16661',
  'Bounded Till',
  'Private compute',
  'Work Desk',
  '0G Compute',
  'TEE verified',
  'Cannot empty you',
]

const WORDS =
  'Tell your agent what you need done. Give it a bounded Till. It finishes the work. You get the result and proof.'

const HOW = ['Owner', 'Till', 'Policy', 'Session', '0G Compute', 'Result', '0G Storage', 'Proof']

const PROOFS = [
  {
    tag: 'Investigate',
    date: '08.22.26',
    title: 'PacketAnchored Till 2 — session signer, glm-5.2 TEE',
    href: `https://chainscan.0g.ai/tx/${DOC_PROOFS.workInvestigateAnchor}`,
  },
  {
    tag: 'Review',
    date: '08.22.26',
    title: 'AI-assisted review stored on Aristotle — not a certified audit',
    href: `https://chainscan.0g.ai/tx/${DOC_PROOFS.workReviewAnchor}`,
  },
  {
    tag: 'Storage',
    date: '08.22.26',
    title: '0G Storage flow for Investigate packet',
    href: `https://chainscan.0g.ai/tx/${DOC_PROOFS.workInvestigateFlow}`,
  },
  {
    tag: 'Verify',
    date: '08.22.26',
    title: 'Reconstruct proof from the hash — on-chain wins',
    href: `https://till-0g.vercel.app/verify?tx=${DOC_PROOFS.workInvestigateAnchor}`,
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
            It finishes the work.
            <br />
            It cannot empty you.
          </h1>
          <p data-hero className="hero-sub mx-auto mt-4 max-w-[661px] text-white">
            Tell your agent what you need done. Give it a bounded Till. It uses 0G private intelligence to finish the
            job. You get the result and proof.
          </p>
          <div data-hero className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <CyanButton to="/tills">Open a Till</CyanButton>
            <CyanButton to="/developers" variant="ghost">
              Developers
            </CyanButton>
            <CyanButton href="#before" variant="ghost">
              Work Desk
            </CyanButton>
          </div>
          <ol data-hero className="og-rail mx-auto mt-8 max-w-[1400px]" aria-label="How Till works">
            {HOW.map((n, i) => (
              <li key={n} className="og-rail__node is-ok">
                <span className="og-rail__dot" />
                <span className="og-rail__label">{n}</span>
                {i < HOW.length - 1 ? <span className="og-rail__line" aria-hidden /> : null}
              </li>
            ))}
          </ol>
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

        <section id="before" className="bg-paper px-5 py-24 text-ink md:px-10 md:py-32">
          <div className="mx-auto max-w-[1400px]">
            <p className="font-mono text-[11px] tracking-[0.18em] text-ink/45">Work Desk</p>
            <h2 className="mt-3 max-w-3xl text-[clamp(2rem,3.4vw,3.15rem)] font-bold leading-[1.08] tracking-tight">
              Ask for a result. The agent finishes it inside your policy.
            </h2>
            <p className="mt-4 max-w-[58ch] text-[16px] text-ink/70">
              Investigate, review, research, or compare. AUTO picks a live TeeML model. The agent finishes the work
              inside your native-0G policy. You keep the vault.
            </p>
            <dl className="mission-strip">
              <div>
                <dt>Spent</dt>
                <dd>0 vault 0G</dd>
              </div>
              <div>
                <dt>Cap</dt>
                <dd>TillPolicy</dd>
              </div>
              <div>
                <dt>Work</dt>
                <dd>Investigate · Review · Research · Compare</dd>
              </div>
              <div>
                <dt>TEE</dt>
                <dd>glm-5.2</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>
                  <a className="text-cyan" href={`https://chainscan.0g.ai/tx/${DOC_PROOFS.workInvestigateAnchor}`}>
                    Anchor ↗
                  </a>
                </dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>
                  <a className="text-cyan" href={`https://chainscan.0g.ai/tx/${DOC_PROOFS.workInvestigateAnchor}`}>
                    Proof ↗
                  </a>
                </dd>
              </div>
              <div>
                <dt>Compute</dt>
                <dd>
                  <a className="text-cyan" href="https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview">
                    0G Compute ↗
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-10 font-mono text-[11px] tracking-[0.16em] text-ink/45">What can I use Till for?</p>
            <ul className="uses-grid">
              {USES.map((u) => (
                <li key={u.label}>
                  <a className="block rounded-[4.27px] border border-ink/10 p-5 hover:border-cyan" href="/tills">
                    <p className="font-semibold">{u.label}</p>
                    <p className="mt-1 text-[14px] text-ink/60">{u.body}</p>
                  </a>
                </li>
              ))}
              <li>
                <a className="block rounded-[4.27px] border border-ink/10 p-5 hover:border-cyan" href="/till/mission">
                  <p className="font-semibold">Review this</p>
                  <p className="mt-1 text-[14px] text-ink/60">AI-assisted review. Not a certified audit.</p>
                </a>
              </li>
              <li>
                <a className="block rounded-[4.27px] border border-ink/10 p-5 hover:border-cyan" href="/till/agent">
                  <p className="font-semibold">For an autonomous agent</p>
                  <p className="mt-1 text-[14px] text-ink/60">Bounded session. No owner wallet.</p>
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section id="layers" className="bg-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <div className="mx-auto max-w-[1400px]">
            <h2 className="max-w-3xl text-[clamp(2rem,3.4vw,3.15rem)] font-bold leading-[1.08] tracking-tight">
              A Till is a bounded work account, not a wallet you hand over.
            </h2>
            <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-ink/70">
              You own the vault. TillPolicy gates native 0G. 0G Compute writes the private result. Storage proves the
              packet. The session cannot withdraw, change policy, or spend another Till.
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
            <CyanButton to="/tills" variant="ink">
              Open a Till
            </CyanButton>
          </div>
        </section>

        <SiteFooter />
      </main>
    </SmoothScroll>
  )
}
