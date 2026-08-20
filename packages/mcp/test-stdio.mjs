import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'stdio.js')
const child = spawn(process.execPath, [bin], {
  env: { ...process.env, TILL_API_URL: 'https://till-api.onrender.com', TILL_ACCESS_TOKEN: '' },
  stdio: ['pipe', 'pipe', 'pipe'],
})

let out = ''
child.stdout.setEncoding('utf8')
const timer = setTimeout(() => {
  child.kill()
  console.error('stdio timeout')
  console.error(out)
  process.exit(1)
}, 25_000)

child.stdout.on('data', (d) => {
  out += d
  const line = out.trim().split('\n').find((l) => l.startsWith('{'))
  if (!line) return
  clearTimeout(timer)
  const msg = JSON.parse(line)
  if (msg.result?.serverInfo?.name !== 'till') {
    console.error(msg)
    child.kill()
    process.exit(1)
  }
  console.log('stdio ndjson initialize ok')
  child.kill()
  process.exit(0)
})

child.stdin.write(
  `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'till-test', version: '0' } } })}\n`,
)
