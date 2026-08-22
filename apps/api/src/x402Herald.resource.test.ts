import assert from 'node:assert/strict'
import test from 'node:test'
import { describeHerald402Failure, sellerResourceUrl, withDestinationResource } from './x402Herald.js'

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

test('dest-native 8453 402 is classified as Herald router dest-proxy failure', () => {
  const msg = describeHerald402Failure({
    error: 'invalid_payload: contract call failed: unable to call contract: execution reverted',
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '3000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0xe55359021a6a22d8385b827405991c56075f56f8',
      },
    ],
  })
  assert.ok(msg && msg.includes('FAILED_HERALD_ROUTER'))
  assert.ok(
    describeHerald402Failure({
      error: 'invalid_exact_evm_insufficient_balance',
      accepts: [
        {
          network: 'eip155:8453',
          payTo: '0xE606AE66542D4F1A56AA551841db41e3ECd26816',
        },
      ],
    })?.includes('FAILED_HERALD_ROUTER')
  )
  assert.ok(
    describeHerald402Failure({
      error: 'invalid_payload: contract call failed: unable to call contract: execution reverted',
      resource: { url: DEST },
    })?.includes('FAILED_HERALD_ROUTER')
  )
  assert.equal(
    describeHerald402Failure({
      error: 'execution reverted',
      accepts: [
        {
          network: 'eip155:16661',
          payTo: '0x686Ca1f3BAf7F7Df3334f2f1A65AE314ee9CDb29',
        },
      ],
    }),
    null
  )
})
