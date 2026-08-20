import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { ethers } from 'ethers'

export const READ_SCOPES = [
  'till.read',
  'till.policy.read',
  'till.mission.create',
  'till.activity.read',
  'till.proof.read',
  'till.session.read',
] as const

export const EXECUTE_SCOPES = ['till.mission.execute'] as const

export const HIGH_RISK_SCOPES = ['till.policy.write', 'till.session.revoke', 'till.withdraw'] as const

export const ALL_SCOPES = [...READ_SCOPES, ...EXECUTE_SCOPES, ...HIGH_RISK_SCOPES] as const

export type Scope = (typeof ALL_SCOPES)[number]

export const API_PUBLIC = process.env.TILL_API_PUBLIC_URL || 'https://till-api.onrender.com'
export const WEB_PUBLIC = process.env.TILL_WEB_PUBLIC_URL || 'https://till-0g.vercel.app'
export const MCP_RESOURCE = `${API_PUBLIC}/mcp`

const codes = new Map<
  string,
  {
    owner: string
    tokenId: string
    scopes: string[]
    challenge: string
    redirectUri: string
    clientId: string
    resource: string
    exp: number
  }
>()

const clients = new Map<string, { redirectUris: string[]; created: number }>()

function secret() {
  const s = process.env.TILL_MCP_JWT_SECRET
  if (!s || s.length < 16) return null
  return s
}

export function mcpConfigured() {
  return Boolean(secret())
}

function b64url(buf: Buffer | string) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  return b.toString('base64url')
}

export function signAccessToken(claims: {
  sub: string
  tokenId: string
  scopes: string[]
  exp: number
}) {
  const key = secret()
  if (!key) throw new Error('TILL_MCP_JWT_SECRET is not configured')
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      iss: API_PUBLIC,
      aud: MCP_RESOURCE,
      sub: ethers.getAddress(claims.sub),
      till: claims.tokenId,
      scopes: claims.scopes,
      iat: Math.floor(Date.now() / 1000),
      exp: claims.exp,
    }),
  )
  const sig = b64url(createHmac('sha256', key).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${sig}`
}

export function verifyAccessToken(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid token')
  const [h, p, s] = parts
  const key = secret()
  if (!key) throw new Error('TILL_MCP_JWT_SECRET is not configured')
  const expected = b64url(createHmac('sha256', key).update(`${h}.${p}`).digest())
  const a = Uint8Array.from(Buffer.from(s))
  const b = Uint8Array.from(Buffer.from(expected))
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('invalid token')
  const body = JSON.parse(Buffer.from(p, 'base64url').toString()) as {
    iss: string
    aud: string
    sub: string
    till: string
    scopes: string[]
    exp: number
  }
  if (body.iss !== API_PUBLIC) throw new Error('invalid issuer')
  if (body.aud !== MCP_RESOURCE) throw new Error('invalid audience')
  if (body.exp < Math.floor(Date.now() / 1000)) throw new Error('expired token')
  return body
}

export function parseScopes(raw: string | string[] | undefined, allowHighRisk: boolean) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
  const requested = list.length ? list : [...READ_SCOPES]
  const out: string[] = []
  for (const s of requested) {
    if (!(ALL_SCOPES as readonly string[]).includes(s)) continue
    if ((HIGH_RISK_SCOPES as readonly string[]).includes(s) && !allowHighRisk) continue
    out.push(s)
  }
  return out.length ? out : [...READ_SCOPES]
}

export function issueMessage(opts: {
  owner: string
  tokenId: string
  scopes: string[]
  nonce: string
  exp: number
}) {
  return [
    'Till MCP access',
    `URI: ${MCP_RESOURCE}`,
    `Owner: ${ethers.getAddress(opts.owner)}`,
    `Till: ${opts.tokenId}`,
    `Scopes: ${opts.scopes.join(' ')}`,
    `Expires: ${opts.exp}`,
    `Nonce: ${opts.nonce}`,
    'This token is not a wallet key. It cannot withdraw or change policy unless those scopes are listed and later signed on-chain by the owner.',
  ].join('\n')
}

export function issueFromSignature(opts: {
  owner: string
  tokenId: string
  scopes: string[]
  nonce: string
  exp: number
  signature: string
  allowHighRisk: boolean
}) {
  const scopes = parseScopes(opts.scopes, opts.allowHighRisk)
  const message = issueMessage({ ...opts, scopes })
  const recovered = ethers.verifyMessage(message, opts.signature)
  if (recovered.toLowerCase() !== ethers.getAddress(opts.owner).toLowerCase()) {
    throw new Error('signature does not match owner')
  }
  const ttl = Math.min(Math.max(opts.exp, Math.floor(Date.now() / 1000) + 60), Math.floor(Date.now() / 1000) + 86400)
  return {
    token: signAccessToken({ sub: opts.owner, tokenId: opts.tokenId, scopes, exp: ttl }),
    scopes,
    exp: ttl,
    resource: MCP_RESOURCE,
    message,
  }
}

export function requireScope(token: ReturnType<typeof verifyAccessToken>, scope: string) {
  if (!token.scopes.includes(scope)) {
    const err = new Error(`missing scope ${scope}`)
    ;(err as Error & { status: number }).status = 403
    throw err
  }
}

export function rejectPrivateKeyPayload(body: unknown) {
  const blob = JSON.stringify(body ?? {}).toLowerCase()
  if (
    blob.includes('privatekey') ||
    blob.includes('private_key') ||
    blob.includes('deployer_private') ||
    /0x[a-f0-9]{64}/.test(blob)
  ) {
    const err = new Error('private keys are forbidden on MCP')
    ;(err as Error & { status: number }).status = 400
    throw err
  }
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [API_PUBLIC],
    bearer_methods_supported: ['header'],
    scopes_supported: ALL_SCOPES,
    resource_documentation: `${WEB_PUBLIC}/developers`,
  }
}

export function authorizationServerMetadata() {
  return {
    issuer: API_PUBLIC,
    authorization_endpoint: `${WEB_PUBLIC}/developers/oauth`,
    token_endpoint: `${API_PUBLIC}/oauth/token`,
    registration_endpoint: `${API_PUBLIC}/oauth/register`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint: `${API_PUBLIC}/oauth/revoke`,
  }
}

export function registerClient(body: { redirect_uris?: string[]; client_name?: string }) {
  const redirectUris = (body.redirect_uris || []).filter((u) => {
    try {
      const x = new URL(u)
      return x.protocol === 'https:' || x.hostname === '127.0.0.1' || x.hostname === 'localhost'
    } catch {
      return false
    }
  })
  if (!redirectUris.length) throw new Error('redirect_uris required')
  const clientId = `till_${randomBytes(12).toString('hex')}`
  clients.set(clientId, { redirectUris, created: Date.now() })
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    client_name: body.client_name || 'Till MCP client',
  }
}

export function storeAuthCode(opts: {
  owner: string
  tokenId: string
  scopes: string[]
  codeChallenge: string
  redirectUri: string
  clientId: string
  resource: string
}) {
  if (opts.resource && opts.resource !== MCP_RESOURCE) throw new Error('resource must be the Till MCP URI')
  const code = randomBytes(24).toString('hex')
  codes.set(code, {
    owner: ethers.getAddress(opts.owner),
    tokenId: opts.tokenId,
    scopes: opts.scopes,
    challenge: opts.codeChallenge,
    redirectUri: opts.redirectUri,
    clientId: opts.clientId,
    resource: MCP_RESOURCE,
    exp: Date.now() + 5 * 60 * 1000,
  })
  return code
}

export function exchangeCode(opts: { code: string; codeVerifier: string; redirectUri: string; clientId: string }) {
  const row = codes.get(opts.code)
  if (!row) throw new Error('invalid code')
  codes.delete(opts.code)
  if (row.exp < Date.now()) throw new Error('code expired')
  if (row.redirectUri !== opts.redirectUri) throw new Error('redirect_uri mismatch')
  if (row.clientId !== opts.clientId) throw new Error('client_id mismatch')
  const hashed = b64url(createHash('sha256').update(opts.codeVerifier).digest())
  if (hashed !== row.challenge) throw new Error('pkce failed')
  const exp = Math.floor(Date.now() / 1000) + 86400
  const access = signAccessToken({ sub: row.owner, tokenId: row.tokenId, scopes: row.scopes, exp })
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: 86400,
    scope: row.scopes.join(' '),
    resource: MCP_RESOURCE,
  }
}

export function wwwAuthenticate() {
  return `Bearer realm="Till", resource_metadata="${API_PUBLIC}/.well-known/oauth-protected-resource"`
}

export function bearerFrom(header?: string) {
  if (!header) return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}
