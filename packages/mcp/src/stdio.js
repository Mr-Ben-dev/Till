#!/usr/bin/env node
/**
 * Till MCP stdio bridge. Content-Length framed JSON-RPC.
 * Env: TILL_ACCESS_TOKEN, TILL_API_URL
 * Never send a private key.
 */
const apiUrl = (process.env.TILL_API_URL || 'https://till-api.onrender.com').replace(/\/$/, '')
const token = process.env.TILL_ACCESS_TOKEN || ''

function write(msg) {
  const json = JSON.stringify(msg)
  const buf = Buffer.from(json, 'utf8')
  process.stdout.write(`Content-Length: ${buf.length}\r\n\r\n`)
  process.stdout.write(buf)
}

async function send(msg) {
  if (/privatekey|0x[a-f0-9]{64}/i.test(JSON.stringify(msg))) {
    return {
      jsonrpc: '2.0',
      id: msg.id ?? null,
      error: { code: -32600, message: 'private keys are forbidden on MCP' },
    }
  }
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(msg) })
  if (res.status === 204) return null
  return res.json()
}

let buffer = Buffer.alloc(0)
process.stdin.on('data', async (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd < 0) break
    const header = buffer.subarray(0, headerEnd).toString('utf8')
    const match = header.match(/Content-Length:\s*(\d+)/i)
    if (!match) {
      buffer = buffer.subarray(headerEnd + 4)
      continue
    }
    const len = Number(match[1])
    const start = headerEnd + 4
    if (buffer.length < start + len) break
    const body = buffer.subarray(start, start + len).toString('utf8')
    buffer = buffer.subarray(start + len)
    try {
      const msg = JSON.parse(body)
      const out = await send(msg)
      if (out) write(out)
    } catch (e) {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: String(e) } })
    }
  }
})

process.stdin.on('end', () => process.exit(0))
