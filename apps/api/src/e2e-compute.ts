import { evaluateIntent, fetchCatalog, productionGuards, selectForRole } from '@till/sdk'

productionGuards()

async function main() {
  const catalog = await fetchCatalog(true)
  console.log('catalog_count', catalog.data.length)
  for (const role of ['fastPolicy', 'defaultPolicy', 'highRisk', 'jobSemantic'] as const) {
    const m = await selectForRole(role)
    console.log('role', role, m.id, m.verifiability, 'providers', m.provider_count)
  }

  const digest =
    '0x1111111111111111111111111111111111111111111111111111111111111111'
  const result = await evaluateIntent({
    role: 'defaultPolicy',
    digest,
    tokenId: '1',
    target: '0x0000000000000000000000000000000000000001',
    amountWei: '10000000000000000',
    resource: 'till://paid-result/v1',
  })
  console.log({
    model: result.model.id,
    allow: result.decision.allow,
    teeVerifiedRouter: result.teeVerifiedRouter,
    processResponse: result.processResponse,
    provider: result.provider,
    chatId: result.chatId,
    teeSigner: result.teeSigner,
  })
  if (result.teeVerifiedRouter !== true || result.processResponse !== true) {
    throw new Error('TEE path failed')
  }
  console.log('COMPUTE_TEE_E2E PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
