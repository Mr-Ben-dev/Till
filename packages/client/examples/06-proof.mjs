import { createClient } from '../dist/index.js'
const till = createClient({ apiUrl: process.env.TILL_API_URL || 'https://till-api.onrender.com', token: process.env.TILL_ACCESS_TOKEN })
const tx = process.argv[2]
if (!tx) {
  console.error('Usage: node 06-proof.mjs <txHash>')
  process.exit(1)
}
console.log(JSON.stringify(await till.getProof(tx), null, 2))
