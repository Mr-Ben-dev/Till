import { createClient } from '../dist/index.js'
const till = createClient({ apiUrl: process.env.TILL_API_URL || 'https://till-api.onrender.com', token: process.env.TILL_ACCESS_TOKEN })
console.log(JSON.stringify(await till.getSession(), null, 2))
