import assert from 'node:assert/strict'
import test from 'node:test'
import { sellerResourceUrl, withDestinationResource } from './x402Herald.js'

const DEST = 'https://agenttoll.app/api/base/safety/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ROUTER = 'https://router.heraldprotocol.xyz/route/x402?url=' + encodeURIComponent(DEST)

test('seller resource is destination, not Herald router', () => {
  assert.equal(sellerResourceUrl(DEST, { url: DEST }), DEST)
  assert.equal(sellerResourceUrl(DEST, { url: ROUTER }), DEST)
  assert.equal(sellerResourceUrl(DEST, { url: '' }), DEST)
})

test('PAYMENT-SIGNATURE resource.url is rewritten off the router', () => {
  const fixed = withDestinationResource({ resource: { url: ROUTER }, x402Version: 2 }, DEST)
  assert.equal(fixed.resource?.url, DEST)
})
