import { tillClient } from './_env.mjs'

const till = tillClient()
console.log(JSON.stringify({ apiUrl: till.apiUrl, mcp: till.mcpConfig() }, null, 2))
