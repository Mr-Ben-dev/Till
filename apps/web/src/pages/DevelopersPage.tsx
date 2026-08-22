import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { API } from '../lib/chain'
import { CyanButton } from '../components/CyanButton'
import { DevDiagram, OG_BADGES } from '../components/app/DevDiagram'
import { Notice } from '../components/app/Notice'

const READ = ['till.read', 'till.policy.read', 'till.mission.create', 'till.activity.read', 'till.proof.read', 'till.session.read']
const EXEC = ['till.mission.execute']
const RISK = ['till.session.revoke']

const MCP_URL = 'https://till-api.onrender.com/mcp'
const WEB = 'https://till-0g.vercel.app'

function cursorDeepLink() {
  const config = btoa(JSON.stringify({ url: MCP_URL }))
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=till&config=${encodeURIComponent(config)}`
}

const PROMPTS = [
  { kind: 'READ', text: 'List my Tills and show which one has an active autonomous session.' },
  { kind: 'SAFE', text: 'Compile an Investigate job for 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Do not execute anything.' },
  { kind: 'MUTATING', text: 'Run a Review mission for the pasted Solidity and stay under the Till policy. Only if autonomous execution is enabled.' },
  { kind: 'READ', text: 'Show me why a 5 0G spend would be blocked.' },
  { kind: 'READ', text: 'Show me the complete proof path for the latest work, including ChainScan links.' },
  { kind: 'MUTATING', text: 'Revoke the active autonomous session. If you cannot sign, open the Till agents page instead.' },
]

export function DevelopersPage({ till }: { till: TillState }) {
  const [params] = useSearchParams()
  const oauth = Boolean(params.get('redirect_uri') || params.get('client_id'))
  const [scopes, setScopes] = useState<string[]>([...READ])
  const [high, setHigh] = useState(false)
  const [token, setToken] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nonce = useMemo(() => crypto.randomUUID(), [])
  const exp = Math.floor(Date.now() / 1000) + 86400
  const allScopes = [...scopes, ...(high ? RISK : [])]

  const issue = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!till.address || till.tokenId == null) throw new Error('Connect and create a Till first.')
      const wanted = high ? [...scopes, ...RISK] : scopes
      const msgRes = await fetch(
        `${API}/v1/mcp/message?owner=${till.address}&tokenId=${till.tokenId}&scopes=${encodeURIComponent(wanted.join(' '))}&nonce=${nonce}&exp=${exp}&high=${high ? '1' : '0'}`,
      )
      const msgJson = (await msgRes.json()) as { message: string }
      const eth = window.ethereum as { request: (a: { method: string; params: string[] }) => Promise<string> } | undefined
      if (!eth) throw new Error('No injected wallet to sign the MCP grant.')
      const signature = String(await eth.request({ method: 'personal_sign', params: [msgJson.message, till.address] }))
      if (oauth) {
        const cons = await fetch(`${API}/oauth/consent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: till.address,
            tokenId: till.tokenId.toString(),
            scopes: wanted,
            nonce,
            exp,
            signature,
            allowHighRisk: high,
            codeChallenge: params.get('code_challenge'),
            redirectUri: params.get('redirect_uri'),
            clientId: params.get('client_id'),
            resource: params.get('resource') || MCP_URL,
          }),
        })
        const consJson = (await cons.json()) as { code?: string; error?: string }
        if (!cons.ok) throw new Error(consJson.error || 'consent failed')
        const redirect = new URL(String(params.get('redirect_uri')))
        redirect.searchParams.set('code', String(consJson.code))
        if (params.get('state')) redirect.searchParams.set('state', String(params.get('state')))
        window.location.assign(redirect.toString())
        return
      }
      const issued = await fetch(`${API}/v1/mcp/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: till.address,
          tokenId: till.tokenId.toString(),
          scopes: wanted,
          nonce,
          exp,
          signature,
          allowHighRisk: high,
        }),
      })
      const json = (await issued.json()) as { token?: string; error?: string }
      if (!issued.ok) throw new Error(json.error || 'issue failed')
      setToken(String(json.token))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const cursorJson = token
    ? JSON.stringify(
        { mcpServers: { till: { url: MCP_URL, headers: { Authorization: `Bearer ${token}` } } } },
        null,
        2,
      )
    : JSON.stringify({ mcpServers: { till: { url: MCP_URL } } }, null, 2)

  return (
    <main className="app-page">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted">Developers</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Give your agents a Till.</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] text-white/65">
        Let agents use bounded money, buy paid services, and execute on 0G without receiving the owner&apos;s wallet.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {OG_BADGES.map((b) => (
          <a key={b.label} className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-cyan hover:text-cyan" href={b.href} target="_blank" rel="noreferrer">
            {b.label}
          </a>
        ))}
      </div>
      <div className="mt-10">
        <DevDiagram />
      </div>

      {oauth && (
        <Notice
          tone="info"
          title="Authorize Till MCP"
          body="This Cursor/Claude client wants a scoped Till token. It will not receive your private key."
        />
      )}
      {err && <div className="mt-6"><Notice tone="danger" title="Stopped" body={err} /></div>}

      <section className="mt-10 rounded-[4.27px] border border-white/10 p-6">
        <h2 className="text-[1.3rem] font-bold">Add Till to your agent</h2>
        <p className="mt-2 text-[14px] text-white/60">
          MCP never receives DEPLOYER_PRIVATE_KEY, the owner key, or the session key. High-risk scopes are off unless you check them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...READ, ...EXEC].map((s) => (
            <label key={s} className="flex items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={scopes.includes(s)}
                onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))}
              />
              {s}
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-[13px] text-danger">
          <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} />
          Allow high-risk scope till.session.revoke (still requires the owner wallet in the app)
        </label>
        <p className="mt-3 font-mono text-[11px] text-white/40">Selected: {allScopes.join(' ')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <CyanButton disabled={busy || !till.authenticated} onClick={() => void issue()}>
            {oauth ? 'Authorize client' : 'Create MCP token'}
          </CyanButton>
          <CyanButton variant="ghost" href={cursorDeepLink()}>
            Add to Cursor
          </CyanButton>
        </div>
        {token ? (
          <pre className="mt-4 overflow-x-auto rounded-[4.27px] bg-black/40 p-4 text-[11px] text-cyan/90">{token}</pre>
        ) : null}
      </section>

      <section className="mt-10 grid gap-8">
        <article>
          <h2 className="text-[1.2rem] font-bold">1. Install</h2>
          <pre className="mt-3 overflow-x-auto rounded-[4.27px] bg-black/40 p-4 text-[12px]">{`npm install till-0g-sdk
npx -y till-0g-mcp`}</pre>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">2. Connect</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-white/60">Open {WEB} and connect the owner wallet. MCP and the SDK receive a scoped token, never that key.</p>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">3. Create Till</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-white/60">Mint on {WEB}/till. This is an owner-wallet transaction on Aristotle 16661.</p>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">4. Configure policy</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-white/60">Write Conservative, Balanced, or Custom. The UI updates only after the on-chain receipt.</p>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">5. Authorize agent</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-white/60">Create a device-local session, authorize it on that Till, and fund agent gas. The session key never leaves the browser.</p>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">6. Run a mission</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-white/60">Paste a contract. The agent selects Safety, Market, and Contract checks under the cap. Quote first if you only want a price.</p>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">7. Read proof</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-white/60">Every real tx has a human label and View on ChainScan. Technical hashes stay collapsed.</p>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">8. MCP</h2>
          <p className="mt-2 text-[14px] text-white/60">Remote Streamable HTTP: {MCP_URL}</p>
          <p className="mt-2 text-[13px] text-white/50">OAuth 2.1: GET /.well-known/oauth-protected-resource and /.well-known/oauth-authorization-server. Bearer header only — never a query string.</p>
          <h3 className="mt-4 text-[15px] font-semibold">Cursor · remote</h3>
          <p className="mt-2 text-[12px] text-white/40">Project file .cursor/mcp.json · user file ~/.cursor/mcp.json</p>
          <pre className="mt-2 overflow-x-auto rounded-[4.27px] bg-black/40 p-4 text-[12px]">{cursorJson}</pre>
          <h3 className="mt-4 text-[15px] font-semibold">Cursor · local stdio</h3>
          <pre className="mt-2 overflow-x-auto rounded-[4.27px] bg-black/40 p-4 text-[12px]">{`{
  "mcpServers": {
    "till": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "till-0g-mcp"],
      "env": {
        "TILL_ACCESS_TOKEN": "\${env:TILL_ACCESS_TOKEN}",
        "TILL_API_URL": "https://till-api.onrender.com"
      }
    }
  }
}`}</pre>
          <h3 className="mt-4 text-[15px] font-semibold">Claude Code</h3>
          <pre className="mt-2 overflow-x-auto rounded-[4.27px] bg-black/40 p-4 text-[12px]">{`claude mcp add --transport http till ${MCP_URL}
claude mcp add --transport http till ${MCP_URL} --header "Authorization: Bearer YOUR_TOKEN"
claude mcp add --transport stdio till --env TILL_ACCESS_TOKEN=YOUR_TOKEN -- npx -y till-0g-mcp`}</pre>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">9. SDK</h2>
          <pre className="mt-3 overflow-x-auto rounded-[4.27px] bg-black/40 p-4 text-[12px]">{`import { createClient } from 'till-0g-sdk'
const till = createClient({ apiUrl: 'https://till-api.onrender.com', token: process.env.TILL_ACCESS_TOKEN })
const quote = await till.quoteMission('Should I deposit into this protocol? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')`}</pre>
        </article>
        <article>
          <h2 className="text-[1.2rem] font-bold">10. Examples</h2>
          <p className="mt-2 text-[13px] text-white/50">Paste into Cursor or Claude. READ does not spend. SAFE quotes. MUTATING can execute or open revoke in the app.</p>
          <ul className="mt-3 grid gap-3">
            {PROMPTS.map((p) => (
              <li key={p.text} className="rounded-[4.27px] border border-white/10 p-4">
                <p className="font-mono text-[11px] text-cyan">{p.kind}</p>
                <p className="mt-2 text-[14px]">{p.text}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}
