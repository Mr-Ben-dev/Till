import { tillClient } from './_env.mjs'

const till = tillClient()
const listed = await till.listTills()
console.log(JSON.stringify(listed, null, 2))
console.log('Mint a new Till with the owner wallet in the app: https://till-0g.vercel.app/till')
console.log('The SDK never holds a private key, so it cannot mint for you.')
