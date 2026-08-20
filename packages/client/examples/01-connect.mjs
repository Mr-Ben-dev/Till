import { createClient } from '../dist/index.js'

const token = process.env.TILL_ACCESS_TOKEN
if (!token) {
  console.error('Set TILL_ACCESS_TOKEN from https://till-0g.vercel.app/developers')
  process.exit(1)
}
const till = createClient({ apiUrl: process.env.TILL_API_URL || 'https://till-api.onrender.com', token })
console.log(JSON.stringify(till.mcpConfig(), null, 2))
