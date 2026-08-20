import { tillClient } from './_env.mjs'

const till = tillClient()
const tx = process.argv[2]
if (!tx) {
  console.error('Usage: node 06-proof.mjs <txHash>')
  process.exit(1)
}
console.log(JSON.stringify(await till.getProof(tx), null, 2))
