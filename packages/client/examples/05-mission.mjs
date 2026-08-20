import { createClient } from '../dist/index.js'
const till = createClient({ apiUrl: process.env.TILL_API_URL || 'https://till-api.onrender.com', token: process.env.TILL_ACCESS_TOKEN })
const subject = process.argv[2] || 'Should I deposit into this protocol? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
console.log(JSON.stringify(await till.quoteMission(subject), null, 2))
