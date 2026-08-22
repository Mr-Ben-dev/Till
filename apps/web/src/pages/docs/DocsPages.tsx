import type { ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { TillState } from '../../hooks/useTill'
import { CyanButton } from '../../components/CyanButton'
import { ArchDiagram, Boundaries, MoneyFlow } from '../../components/docs/ArchSvg'
import { CopyBlock } from '../../components/docs/CopyBlock'
import { McpIssuer } from '../../components/docs/McpIssuer'
import { OG_BADGES } from '../../components/app/DevDiagram'
import {
  ADDR,
  API,
  CHAIN_ID,
  CREATE_TX,
  EXPLORER,
  GITHUB,
  HUB_SWAP,
  INTERFACES,
  MCP_URL,
  MISSION_CAP_USD,
  NPM_MCP,
  NPM_MCP_VER,
  NPM_SDK,
  NPM_SDK_VER,
  PROOFS,
  ROLES,
  SCOPES_EXEC,
  SCOPES_READ,
  SCOPES_RISK,
  TOOLS,
  WEB,
  addrUrl,
  txUrl,
} from '../../lib/docsTruth'

function Page({ kicker, title, lede, children }: { kicker: string; title: string; lede: string; children: ReactNode }) {
  return (
    <article className="docs-article">
      <p className="docs-kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="docs-lede">{lede}</p>
      {children}
    </article>
  )
}

export function DocsOverview() {
  return (
    <Page
      kicker="Till"
      title="Give your agents a Till."
      lede="Bounded money for autonomous agents. Real work on 0G. No owner wallet access."
    >
      <div className="docs-cta">
        <CyanButton to="/developers/quickstart">5 minute quickstart</CyanButton>
        <CyanButton to="/developers/sdk" variant="ghost">
          Build with SDK
        </CyanButton>
        <CyanButton to="/developers/mcp" variant="ghost">
          Connect with MCP
        </CyanButton>
        <CyanButton href={txUrl(PROOFS.agentToll)} variant="ghost">
          View Mainnet proof
        </CyanButton>
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {OG_BADGES.map((b) => (
          <a key={b.label} className="docs-badge" href={b.href} target="_blank" rel="noreferrer">
            {b.label}
          </a>
        ))}
      </div>
      <ArchDiagram />
      <h2>Why Till exists</h2>
      <p>
        An autonomous agent needs money to buy work. The user must never hand it their wallet. A Till is a permissioned
        spend account on 0G Aristotle ({CHAIN_ID}): you fund it, you set the policy, you authorize a device-local session.
        The agent can buy approved work. It cannot withdraw, change policy, or spend another Till.
      </p>
      <h2>Four mission families</h2>
      <p>
        Before You Pay, Before You Trust, Research For Me, and Review This. Compute is the work. x402 is optional
        procurement. Only SETTLED SKUs execute. Quoted SKUs stay in Developers until a real Aristotle settlement tx
        exists.
      </p>
      <h2>Money rails</h2>
      <p>
        TillPolicy controls native 0G in the vault. USDC.e x402 uses a per-mission session drawer and EIP-3009. The APP
        path never uses the operator key. MCP execute is a labeled operator rail. USDC.e is not TillPolicy-controlled.
      </p>
      <MoneyFlow />
      <h2>Security boundaries</h2>
      <Boundaries />
    </Page>
  )
}

export function DocsQuickstart() {
  return (
    <Page kicker="Getting started" title="Quick start" lede="Create a Till, set policy, enable a session, then quote before you spend.">
      <ol className="docs-steps">
        <li>
          <strong>Open the app.</strong> {WEB}. Connect the owner wallet on Aristotle {CHAIN_ID}.
        </li>
        <li>
          <strong>Create a Till</strong> at {WEB}/till. Mint is an owner-wallet transaction.
        </li>
        <li>
          <strong>Write a protection policy</strong> (Conservative, Balanced, or Custom). The UI waits for the receipt.
        </li>
        <li>
          <strong>Fund</strong> native 0G into the Till. Swap USDC.e on{' '}
          <a href={HUB_SWAP}>0G Hub</a> if the mission quotes USDC.e.
        </li>
        <li>
          <strong>Authorize a session</strong> and fund agent gas. The session key stays in this browser.
        </li>
        <li>
          <strong>Run Before You Pay.</strong> Quote first. Execute only with a READY session if you want no owner
          signature on the storage proof.
        </li>
      </ol>
      <CopyBlock
        label="Install"
        value={`npm install ${NPM_SDK}\nnpx -y ${NPM_MCP}`}
      />
      <p className="text-[13px] text-white/45">
        MCP and the SDK receive a scoped token from /developers/mcp. Never the owner private key.
      </p>
    </Page>
  )
}

export function DocsCore() {
  return (
    <Page
      kicker="Core concepts"
      title="Till, policy, session, mission"
      lede="Plain English first. On-chain fields stay expandable in the app."
    >
      <h2>Till</h2>
      <p>
        An ERC-721 service account (TillAgentNFT) with a vault. You can have more than one. None of them are special.
        My Tills shows ACTIVE, BALANCE, POLICY, AGENT, STATUS for the selected instance.
      </p>
      <h2>Protection policy</h2>
      <p>
        On-chain: max per purchase and rolling cap in native 0G, session expiry, pause. Application: ${MISSION_CAP_USD.toFixed(2)}{' '}
        USDC.e session-drawer cap (not TillPolicy).
        USDC.e mission cap for Before You Pay. Allowed services (Safety · Market · Contract) are selected by the agent
        from live x402 quotes, not stored as an on-chain enum.
      </p>
      <h2>Owner vs autonomous</h2>
      <p>
        Owner signs connect, mint, fund vault 0G, policy, authorizeUsage, gas, revoke, withdraw, pause, setTillTeeSigner,
        and funding the session drawer with USDC.e. APP mission payments are EIP-3009 signed by the authorized session EOA.
        The operator key is never used on that path. MCP <code>till_run_mission</code> is a labeled operator rail.
        Storage <code>anchorPacket</code> is signed by the device-local session when gas is available.
      </p>
      <h2>Grants</h2>
      <p>ERC-7857 authorizeUsage on that Till. Cross-Till isolation is enforced on-chain. MCP uses a JWT grant, not a key.</p>
      <h2>x402 / Compute / Storage / 8004</h2>
      <p>
        Discovery and quote against live sellers. Settlement in USDC.e on Aristotle via Herald. Policy TEE {ROLES.fastPolicy}{' '}
        with processResponse. Brief writer {ROLES.defaultPolicy} TeeML. Encrypted packet on 0G Storage, vault-anchored.
        ERC-8004 Identity and Reputation are live. Validation Registry is not claimed.
      </p>
    </Page>
  )
}

export function DocsMcp() {
  const till = useOutletContext<TillState>()
  const prompts = [
    { kind: 'READ ONLY', text: 'List my Tills and show their balances, policy status, and session status.' },
    { kind: 'READ ONLY', text: 'Quote a Before You Pay mission for this contract. Do not spend anything. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { kind: 'SAFE MUTATION', text: 'Run a Before You Pay mission for this contract using the active Till session and stay within the existing policy.' },
    { kind: 'READ ONLY', text: 'Show me the complete proof for the latest mission.' },
    { kind: 'READ ONLY', text: 'Explain exactly why the last transaction was blocked.' },
    { kind: 'HIGH RISK', text: 'Revoke the active autonomous session. If you cannot sign, open the Till agent page instead.' },
  ]
  return (
    <Page
      kicker="MCP"
      title="Connect any agent"
      lede="Till works with MCP-compatible agents. Verified paths: Cursor, Claude Code, Streamable HTTP, and local stdio. Claude.ai desktop and generic OpenAI-compatible agents are not claimed until tested."
    >
      <McpIssuer till={till} />
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <Link className="docs-card" to="/developers/cursor">
          <strong>Cursor</strong>
          <p>Deep link plus mcp.json. Verified install path.</p>
        </Link>
        <Link className="docs-card" to="/developers/claude">
          <strong>Claude Code</strong>
          <p>HTTP and stdio commands below. Verified.</p>
        </Link>
        <div className="docs-card">
          <strong>Claude</strong>
          <p>Claude.ai desktop is listed for MCP clients. Not claimed until tested on this stack.</p>
        </div>
        <div className="docs-card">
          <strong>Custom agents</strong>
          <p>POST {MCP_URL} with Bearer. Protocol 2025-11-25.</p>
        </div>
        <div className="docs-card">
          <strong>Other MCP clients</strong>
          <p>
            Any client that speaks Streamable HTTP or stdio. Use <code>npx -y {NPM_MCP}</code> with TILL_ACCESS_TOKEN.
          </p>
        </div>
      </div>
      <h2>Transports</h2>
      <p>
        Remote: POST {MCP_URL} (JSON-RPC, protocol 2025-11-25). Local: <code>npx -y {NPM_MCP}</code> with TILL_ACCESS_TOKEN.
        GET /mcp without a token returns 401 and WWW-Authenticate for OAuth discovery.
      </p>
      <CopyBlock
        label="Claude Code"
        value={`claude mcp add --transport http till ${MCP_URL}
claude mcp add --transport http till ${MCP_URL} --header "Authorization: Bearer YOUR_TOKEN"
claude mcp add --transport stdio till --env TILL_ACCESS_TOKEN=YOUR_TOKEN -- npx -y ${NPM_MCP}`}
      />
      <h2>Example prompts</h2>
      <ul className="docs-prompts">
        {prompts.map((p) => (
          <li key={p.text}>
            <p className="font-mono text-[11px] text-cyan">{p.kind}</p>
            <CopyBlock value={p.text} />
          </li>
        ))}
      </ul>
      <h2>Tools</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Spend</th>
              <th>Scope</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((t) => (
              <tr key={t.name}>
                <td>
                  <code>{t.name}</code>
                </td>
                <td>{t.spend ? 'yes if READY' : 'no'}</td>
                <td>
                  <code>{t.scope}</code>
                </td>
                <td>{t.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Default scopes: {SCOPES_READ.join(' ')} plus optional {SCOPES_EXEC[0]}. High-risk, not silent:{' '}
        {SCOPES_RISK.join(' ')}. till_run_mission refuses unless session status is READY. MCP does not hold the session
        key, so it does not fake Storage anchor. till_revoke_session does not sign. It returns {WEB}/till/agent.
      </p>
    </Page>
  )
}

export function DocsSdk() {
  return (
    <Page kicker="SDK" title={`${NPM_SDK}@${NPM_SDK_VER}`} lede="HTTP client. No private-key handling. Browser and Node 20+.">
      <p>
        npm:{' '}
        <a href={`https://www.npmjs.com/package/${NPM_SDK}`} target="_blank" rel="noreferrer">
          {NPM_SDK}
        </a>{' '}
        · stdio:{' '}
        <a href={`https://www.npmjs.com/package/${NPM_MCP}`} target="_blank" rel="noreferrer">
          {NPM_MCP}@{NPM_MCP_VER}
        </a>{' '}
        · source {GITHUB}
      </p>
      <CopyBlock
        label="TypeScript"
        value={`import { createClient } from '${NPM_SDK}'
const till = createClient({ apiUrl: '${API}', token: process.env.TILL_ACCESS_TOKEN })
const listed = await till.listTills()
const policy = await till.getPolicy()
const quote = await till.quoteMission('Should I deposit into this protocol? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const session = await till.getSession()
// till.runMission(subject) requires till.mission.execute AND a READY on-chain session
const proof = await till.getProof('0x…')`}
      />
      <p>
        createClient rejects missing tokens, localhost API URLs (unless TILL_ALLOW_LOCALHOST=1), and 64-byte hex private
        keys. Examples live in packages/client/examples (01-07). Mint stays in the app. The SDK cannot hold a key.
      </p>
    </Page>
  )
}

export function DocsReference() {
  const contracts = [
    { name: 'TillAgentNFT', addr: ADDR.nft, purpose: 'Till identity, authorizeUsage', tx: CREATE_TX.nft },
    { name: 'TillPolicy', addr: ADDR.policy, purpose: 'Caps, pause, session expiry', tx: CREATE_TX.policy },
    { name: 'TillVerifier', addr: ADDR.verifier, purpose: 'TEE digest bind', tx: CREATE_TX.verifier },
    { name: 'TillVault', addr: ADDR.vault, purpose: 'Deposit, release, anchorPacket', tx: CREATE_TX.vault },
    { name: 'TillJobEscrow', addr: ADDR.escrow, purpose: 'Lock / settle / refund jobs', tx: CREATE_TX.escrow },
  ]
  return (
    <Page kicker="Reference" title="Contracts, API, chain" lede={`Aristotle ${CHAIN_ID}. Production v3 only.`}>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Purpose</th>
              <th>Explorer</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.addr}>
                <td>{c.name}</td>
                <td>{c.purpose}</td>
                <td>
                  <a href={addrUrl(c.addr)}>{c.addr.slice(0, 10)}…</a>
                  {' · '}
                  <a href={txUrl(c.tx)}>create tx</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>ERC-7857 live IDs on TillAgentNFT</h2>
      <ul>
        {INTERFACES.map((i) => (
          <li key={i.id}>
            <code>{i.id}</code> {i.name} - {i.result ? 'true' : 'false'}
          </li>
        ))}
      </ul>
      <h2>API</h2>
      <ul>
        <li>
          GET {API}/health, chainId 16661, simulate false
        </li>
        <li>POST {MCP_URL} (JSON-RPC)</li>
        <li>GET {API}/.well-known/oauth-protected-resource</li>
        <li>GET {API}/.well-known/oauth-authorization-server</li>
        <li>GET {API}/v1/tills (Bearer JWT)</li>
        <li>
          GET {WEB}/verify (no wallet)
        </li>
      </ul>
      <p>
        USDC.e {ADDR.usdce} · Herald payTo {ADDR.heraldPayTo} · Payment Layer {ADDR.paymentLayer} (Compute billing, not
        Till user funds) · Explorer {EXPLORER}
      </p>
    </Page>
  )
}

export function DocsSecurity() {
  return (
    <Page kicker="Proof & security" title="What is live. What is not." lede="Every claim below has a production or ChainScan link. Limitations are listed, not hidden.">
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>0G Chain</td>
              <td>LIVE</td>
              <td>
                <a href={`${API}/health`}>/health 16661</a>
              </td>
            </tr>
            <tr>
              <td>ERC-7857</td>
              <td>VERIFIED</td>
              <td>
                <a href={addrUrl(ADDR.nft)}>supportsInterface</a>
              </td>
            </tr>
            <tr>
              <td>0G Compute / TEE</td>
              <td>LIVE</td>
              <td>
                {ROLES.fastPolicy} processResponse · catalog 29
              </td>
            </tr>
            <tr>
              <td>x402</td>
              <td>LIVE</td>
              <td>
                <a href={txUrl(PROOFS.agentToll)}>AgentToll</a> · <a href={txUrl(PROOFS.api402x)}>api402x</a> ·{' '}
                <a href={txUrl(PROOFS.tokenRisk)}>token-risk</a>
              </td>
            </tr>
            <tr>
              <td>0G Storage</td>
              <td>LIVE</td>
              <td>
                <a href={txUrl(PROOFS.storageFlow)}>flow</a> · <a href={txUrl(PROOFS.storageAnchor)}>anchor</a>
              </td>
            </tr>
            <tr>
              <td>Session executor</td>
              <td>LIVE</td>
              <td>
                <a href={txUrl(PROOFS.sessionAnchor)}>anchorPacket by session key</a>
              </td>
            </tr>
            <tr>
              <td>ERC-8004</td>
              <td>LIVE Identity + Reputation</td>
              <td>
                <a href={txUrl(PROOFS.erc8004Identity)}>register</a> · Validation Registry absent
              </td>
            </tr>
            <tr>
              <td>MCP</td>
              <td>LIVE</td>
              <td>
                initialize 2025-11-25 · 401 without Bearer
              </td>
            </tr>
            <tr>
              <td>SDK</td>
              <td>LIVE</td>
              <td>
                <a href={`https://www.npmjs.com/package/${NPM_SDK}`}>
                  {NPM_SDK}@{NPM_SDK_VER}
                </a>
              </td>
            </tr>
            <tr>
              <td>Jobs</td>
              <td>LIVE</td>
              <td>
                <a href={txUrl(PROOFS.jobSettle)}>settle</a> · <a href={txUrl(PROOFS.jobRefund)}>refund</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2>Limitations</h2>
      <ul>
        <li>DAEntrance has no code on Aristotle 16661. Not used. Not faked.</li>
        <li>Foundation sealed iTransfer / AgenticID attestor not claimed. IERC7857Cloneable ID is implemented; sealed iTransferFrom is blocked on-chain.</li>
        <li>ERC-8004 Validation Registry is absent on 0G. Identity + Reputation only.</li>
        <li>x402 Before You Pay settles USDC.e on 16661 via Herald. Foreign-network 402s are skipped, not paid.</li>
        <li>MCP cannot upload the session private key, so it cannot Storage-anchor. Revoke is owner-wallet only.</li>
        <li>Hosted OAuth DCR clients are in-memory on Render. Prefer a signed token from this docs site after a dyno restart.</li>
        <li>MetaMask Blockaid currently BLOCKs till-0g.vercel.app. Confirm the URL, then connect. Custom domain is the durable fix.</li>
      </ul>
      <p>
        Last recorded Foundry run (2026-08-20): 69/69 unit + fuzz 256 + invariant 64×1280 + reentrancy. forge was not on
        PATH in the documentation pass; do not treat a missing local binary as a new failure.
      </p>
      <Link className="text-cyan" to="/verify">
        Open Verify
      </Link>
    </Page>
  )
}

export function DocsArchitecture() {
  return (
    <Page kicker="Architecture" title="How Till is wired" lede="Owner funds a Till. Policy bounds spend. Session executes. Agent never holds the wallet.">
      <ArchDiagram />
      <MoneyFlow />
      <Boundaries />
    </Page>
  )
}

export function DocsProof() {
  return (
    <Page kicker="Proof" title="Mainnet receipts" lede="Paste a hash on Verify. These are recorded production transactions, not placeholders.">
      <ul>
        <li>
          <a href={txUrl(PROOFS.agentToll)}>AgentToll x402</a>
        </li>
        <li>
          <a href={txUrl(PROOFS.api402x)}>api402x x402</a>
        </li>
        <li>
          <a href={txUrl(PROOFS.tokenRisk)}>token-risk x402</a>
        </li>
        <li>
          <a href={txUrl(PROOFS.storageAnchor)}>Storage anchor</a>
        </li>
        <li>
          <a href={txUrl(PROOFS.sessionAnchor)}>Session executor anchorPacket</a>
        </li>
      </ul>
      <CyanButton to="/verify">Open Verify</CyanButton>
    </Page>
  )
}

export function DocsContracts() {
  return <DocsReference />
}

export function DocsCursor() {
  return (
    <Page kicker="Cursor" title="Install Till in Cursor" lede="Verified: Streamable HTTP MCP with a scoped Bearer token from this site.">
      <ol className="docs-steps">
        <li>Open Connect any agent and create a scoped MCP token.</li>
        <li>Copy the setup prompt into the agent, or paste mcp.json.</li>
        <li>Confirm tools/list then till_list. Do not spend yet.</li>
      </ol>
      <CyanButton to="/developers/mcp">Create scoped MCP token</CyanButton>
    </Page>
  )
}

export function DocsClaude() {
  return (
    <Page kicker="Claude Code" title="Install Till in Claude Code" lede="Verified HTTP and stdio commands. Claude.ai desktop is not claimed until tested.">
      <CopyBlock
        label="Claude Code"
        value={`claude mcp add --transport http till ${MCP_URL}
claude mcp add --transport http till ${MCP_URL} --header "Authorization: Bearer YOUR_TOKEN"
claude mcp add --transport stdio till --env TILL_ACCESS_TOKEN=YOUR_TOKEN -- npx -y ${NPM_MCP}`}
      />
      <CyanButton to="/developers/mcp">Create scoped MCP token</CyanButton>
    </Page>
  )
}
