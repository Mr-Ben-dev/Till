import { NavLink } from 'react-router-dom'
import { OgMark } from './OgMark'
import { TillMark } from './TillMark'

const COLS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Open a Till', to: '/till' },
      { label: 'Agents', to: '/agents' },
      { label: 'Jobs', to: '/jobs' },
      { label: 'Activity', to: '/activity' },
      { label: 'Verify', to: '/verify' },
    ],
  },
  {
    title: 'On Aristotle',
    links: [
      { label: 'Vault', href: 'https://chainscan.0g.ai/address/0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB' },
      { label: 'Policy', href: 'https://chainscan.0g.ai/address/0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c' },
      { label: 'Verifier', href: 'https://chainscan.0g.ai/address/0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1' },
      { label: 'Job escrow', href: 'https://chainscan.0g.ai/address/0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9' },
      { label: 'Agent NFT', href: 'https://chainscan.0g.ai/address/0x730e7c02D1C238D98aD38AFED98a7CBA980901bF' },
    ],
  },
  {
    title: 'Not faked',
    links: [
      { label: 'DA (BLOCKED)', href: 'https://docs.0g.ai' },
      { label: 'Sealed iTransfer (BLOCKED)', href: 'https://docs.0g.ai' },
      { label: 'Validation Registry (BLOCKED)', href: 'https://github.com/erc-8004/erc-8004-contracts/issues/98' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="grid grid-cols-1 border-t border-cyan/20 md:grid-cols-4">
        {COLS.map((col) => (
          <div key={col.title} className="border-t border-cyan/20 md:border-t-0 md:border-l">
            <p className="foot-head">{col.title}</p>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <NavLink to={l.to} className="foot-link">
                      {l.label}
                    </NavLink>
                  ) : (
                    <a href={l.href} className="foot-link" rel="noreferrer">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="border-t border-cyan/20 md:border-t-0 md:border-l">
          <p className="foot-head">Chain</p>
          <ul>
            <li>
              <span className="foot-link is-static">Aristotle 16661</span>
            </li>
            <li>
              <a className="foot-link" href="https://evmrpc.0g.ai">
                evmrpc.0g.ai
              </a>
            </li>
            <li>
              <a className="foot-link" href="https://chainscan.0g.ai">
                chainscan.0g.ai
              </a>
            </li>
            <li>
              <a className="foot-link" href="https://github.com/Mr-Ben-dev/TILL">
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-cyan/20 px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <TillMark className="h-8 w-8" />
          <span className="text-[13px] font-bold tracking-[0.18em]">TILL</span>
        </div>
        <a href="https://chainscan.0g.ai" className="flex items-center gap-3" rel="noreferrer">
          <OgMark />
        </a>
      </div>
      <p className="px-6 py-6 font-mono text-[11px] tracking-[0.14em] text-white/45 md:px-8">
        Till on 0G Aristotle. DA, sealed iTransfer, Validation Registry: BLOCKED, not faked.
      </p>
    </footer>
  )
}
