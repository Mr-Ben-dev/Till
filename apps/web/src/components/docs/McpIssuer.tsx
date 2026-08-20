import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { TillState } from '../../hooks/useTill'
import { API } from '../../lib/chain'
import {
  MCP_URL,
  SCOPES_EXEC,
  SCOPES_READ,
  SCOPES_RISK,
  setupPrompt,
} from '../../lib/docsTruth'
import { CyanButton } from '../CyanButton'
import { Notice } from '../app/Notice'
import { CopyBlock } from './CopyBlock'

export function McpIssuer({ till }: { till: TillState }) {
  const [params] = useSearchParams()
  const oauth = Boolean(params.get('redirect_uri') || params.get('client_id'))
  const [scopes, setScopes] = useState<string[]>([...SCOPES_READ])
  const [high, setHigh] = useState(false)
  const [exec, setExec] = useState(false)
  const [token, setToken] = useState('')
  const [shown, setShown] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nonce = useMemo(() => crypto.randomUUID(), [])
  const exp = Math.floor(Date.now() / 1000) + 3600
  const wanted = [...scopes, ...(exec ? SCOPES_EXEC : []), ...(high ? ['till.session.revoke'] : [])]

  const issue = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!till.address || till.tokenId == null) throw new Error('Connect and create a Till first.')
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
        if (params.get('state')) redirect.searchParams.set('state', params.get('state')!)
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
      setShown(true)
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
    <section className="docs-card">
      <h2>Install Till in your agent</h2>
      <p>
        MCP never receives DEPLOYER_PRIVATE_KEY, the owner key, or the session key. Tokens expire in one hour.
        High-risk scopes stay off unless you check them.
      </p>
      {oauth && (
        <Notice tone="info" title="Authorize Till MCP" body="This client wants a scoped token. It will not receive your private key." />
      )}
      {err && <Notice tone="danger" title="Stopped" body={err} />}
      <div className="mt-4 flex flex-wrap gap-2">
        {[...SCOPES_READ].map((s) => (
          <label key={s} className="flex items-center gap-2 text-[12px] text-white/70">
            <input type="checkbox" checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
            {s}
          </label>
        ))}
        <label className="flex items-center gap-2 text-[12px] text-white/70">
          <input type="checkbox" checked={exec} onChange={(e) => setExec(e.target.checked)} />
          till.mission.execute
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13px] text-danger">
        <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} />
        Allow high-risk till.session.revoke (owner wallet still required in the app). {SCOPES_RISK.filter((s) => s !== 'till.session.revoke').join(', ')} are never issued here.
      </label>
      <p className="mt-3 font-mono text-[11px] text-white/40">Selected: {wanted.join(' ')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <CyanButton disabled={busy || !till.authenticated} onClick={() => void issue()}>
          {oauth ? 'Authorize client' : 'Create scoped MCP token'}
        </CyanButton>
        <CyanButton
          variant="ghost"
          href={`cursor://anysphere.cursor-deeplink/mcp/install?name=till&config=${encodeURIComponent(btoa(JSON.stringify({ url: MCP_URL })))}`}
        >
          Add to Cursor
        </CyanButton>
      </div>
      {token && shown ? (
        <div className="mt-6 grid gap-4">
          <Notice
            tone="info"
            title="Shown once in this session"
            body="Expires in 1 hour. Copy the setup prompt, then hide the token. Never commit it."
          />
          <CopyBlock label="Scoped token" value={token} />
          <CopyBlock label="Copy setup prompt" value={setupPrompt(token)} />
          <CopyBlock label="Cursor mcp.json with this token" value={cursorJson} />
          <button type="button" className="text-left text-[13px] text-white/50 underline" onClick={() => setShown(false)}>
            Hide token from this page
          </button>
        </div>
      ) : token ? (
        <p className="mt-4 text-[13px] text-white/45">Token hidden. Issue a new one if you still need it.</p>
      ) : (
        <CopyBlock label="Cursor mcp.json (authorize in the app)" value={cursorJson} />
      )}
    </section>
  )
}
