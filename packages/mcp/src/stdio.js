#!/usr/bin/env node
/**
 * Till MCP stdio bridge.
 * Wire format: newline-delimited JSON-RPC (MCP spec). Content-Length inbound is accepted for older clients.
 * Env: TILL_ACCESS_TOKEN, TILL_API_URL
 * Never send a private key.
 */
const apiUrl = (process.env.TILL_API_URL || 'https://till-api.onrender.com').replace(/\/$/, '')
const token = process.env.TILL_ACCESS_TOKEN || ''

function write(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

async function send(msg) {
  if (/privatekey|0x[a-f0-9]{64}/i.test(JSON.stringify(msg))) {
    return {
      jsonrpc: '2.0',
      id: msg.id ?? null,
      error: { code: -32600, message: 'private keys are forbidden on MCP' },
    }
  }
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-11-25',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(msg) })
  if (res.status === 202 || res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32700, message: 'invalid JSON from MCP HTTP' } }
  }
}

async function handle(raw) {
  try {
    const msg = JSON.parse(raw)
    const out = await send(msg)
    if (out) write(out)
  } catch (e) {
    write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: String(e) } })
  }
}

let buffer = Buffer.alloc(0)
process.stdin.on('data', async (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  while (true) {
    if (buffer.length >= 14 && buffer.subarray(0, 14).toString('utf8').toLowerCase() === 'content-length') {
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
      await handle(body)
      continue
    }
    const nl = buffer.indexOf('\n')
    if (nl < 0) break
    const line = buffer.subarray(0, nl).toString('utf8').replace(/\r$/, '').trim()
    buffer = buffer.subarray(nl + 1)
    if (line) await handle(line)
  }
})

process.stdin.on('end', () => process.exit(0))
process.stderr.write('till-0g-mcp stdio ready\n')
