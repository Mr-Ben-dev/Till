import { tillClient } from './_env.mjs'

const till = tillClient()
console.log(JSON.stringify(till.mcpConfig(), null, 2))
console.log('Remote MCP: POST https://till-api.onrender.com/mcp')
console.log('Stdio: npx -y till-0g-mcp  (TILL_ACCESS_TOKEN in env)')
