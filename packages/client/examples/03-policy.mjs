import { tillClient } from './_env.mjs'

const till = tillClient()
console.log(JSON.stringify(await till.getPolicy(), null, 2))
