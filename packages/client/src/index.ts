export type TillClientOptions = {
  apiUrl: string
  token: string
}

export class TillError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TillError'
    this.status = status
  }
}

async function req(apiUrl: string, token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* raw */
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'error' in body ? String((body as { error: string }).error) : text || `${res.status}`
    throw new TillError(msg, res.status)
  }
  return body
}

export function createClient(opts: TillClientOptions) {
  if (!opts.apiUrl || /localhost|127\.0\.0\.1/i.test(opts.apiUrl) && process.env.TILL_ALLOW_LOCALHOST !== '1') {
    if (!opts.apiUrl) throw new TillError('apiUrl required')
  }
  const apiUrl = opts.apiUrl
  const token = opts.token
  if (!token) throw new TillError('token required — create one at /developers. Never pass a private key.')
  if (/privatekey|0x[a-f0-9]{64}/i.test(token)) throw new TillError('private keys are forbidden')

  const mcp = (name: string, args: Record<string, string> = {}) =>
    req(apiUrl, token, '/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    })

  return {
    apiUrl,
    async listTills() {
      return req(apiUrl, token, '/v1/tills')
    },
    async getTill(id: string) {
      return req(apiUrl, token, `/v1/tills/${id}`)
    },
    async getPolicy(tokenId?: string) {
      return mcp('till_get_policy', tokenId ? { tokenId } : {})
    },
    async createMission(subject: string) {
      return mcp('till_create_mission', { subject })
    },
    async quoteMission(subject: string) {
      return mcp('till_quote_mission', { subject })
    },
    async runMission(subject: string, tokenId?: string) {
      return mcp('till_run_mission', { subject, ...(tokenId ? { tokenId } : {}) })
    },
    async getMission(subject: string) {
      return mcp('till_get_mission', { subject })
    },
    async getActivity() {
      return mcp('till_get_activity', {})
    },
    async getProof(tx: string) {
      return req(apiUrl, token, `/v1/verify?tx=${encodeURIComponent(tx)}`)
    },
    async getSession() {
      return mcp('till_get_session', {})
    },
    async revokeSession() {
      return mcp('till_revoke_session', {})
    },
    mcpConfig(name = 'till') {
      return { mcpServers: { [name]: { url: `${apiUrl}/mcp`, headers: { Authorization: `Bearer ${token}` } } } }
    },
  }
}

export function connect(opts: TillClientOptions) {
  return createClient(opts)
}
