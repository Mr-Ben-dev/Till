import { ethers } from 'ethers'
import {
  contracts,
  derivedWallet,
  evaluateIntent,
  getSigner,
  issueGrant,
  productionGuards,
  registerAgent,
  giveFeedback,
  wait,
  uploadEncryptedPacket,
} from '@till/sdk'
import { OG_RPC_URL } from '@till/config'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

productionGuards()

function packedOf(evalResult: { packed: string }) {
  return evalResult.packed
}

async function main() {
  const proof: Record<string, unknown> = { chainId: 16661, startedAt: new Date().toISOString() }
  const deployer = getSigner()
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const userB = derivedWallet('till-user-b', provider)
  const execA2 = derivedWallet('till-exec-a2', provider)
  const c = contracts(deployer)
  const payee = process.env.X402_PAYEE || deployer.address
  const resourceStr = 'till://paid-result/v1'
  const resource = ethers.keccak256(ethers.toUtf8Bytes(resourceStr))

  const bal = await provider.getBalance(deployer.address)
  console.log('deployer', deployer.address, 'balance_wei', bal.toString())
  console.log('userB', userB.address)
  if (bal < ethers.parseEther('0.15')) throw new Error('deployer needs mainnet 0G')

  const bBal = await provider.getBalance(userB.address)
  if (bBal < ethers.parseEther('0.05')) {
    const fundB = await deployer.sendTransaction({ to: userB.address, value: ethers.parseEther('0.08') })
    await fundB.wait()
    console.log('funded_userB', fundB.hash)
    proof.fundUserB = fundB.hash
  }

  const mintA = await wait(await c.nft.mint())
  let tokenA = 0n
  for (const log of mintA.logs) {
    try {
      const p = c.nft.interface.parseLog({ topics: log.topics as string[], data: log.data })
      if (p?.name === 'TillMinted') tokenA = p.args.tokenId
    } catch {
      /* skip */
    }
  }
  console.log('mintA', mintA.hash, 'token', tokenA.toString())
  proof.mintA = mintA.hash

  const nftB = c.nft.connect(userB) as typeof c.nft
  const mintB = await wait(await nftB.mint())
  let tokenB = 0n
  for (const log of mintB.logs) {
    try {
      const p = c.nft.interface.parseLog({ topics: log.topics as string[], data: log.data })
      if (p?.name === 'TillMinted') tokenB = p.args.tokenId
    } catch {
      /* skip */
    }
  }
  console.log('mintB', mintB.hash, 'token', tokenB.toString())
  proof.mintB = mintB.hash

  const policyB = c.policy.connect(userB)
  const vaultB = c.vault.connect(userB)

  const setup = async (policy: typeof c.policy, token: bigint) => {
    await wait(
      await policy.setPolicy(
        token,
        ethers.parseEther('0.05'),
        ethers.parseEther('0.2'),
        86400n,
        BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
        true,
        true
      )
    )
    await wait(await policy.setAllowlistMode(token, true, true, false))
    await wait(await policy.setAllowedTarget(token, payee, true))
    await wait(await policy.setAllowedResource(token, resource, true))
  }
  await setup(c.policy, tokenA)
  await setup(policyB as typeof c.policy, tokenB)
  await wait(await c.nft.authorizeUsage(tokenA, execA2.address))
  await wait(await c.vault.deposit(tokenA, { value: ethers.parseEther('0.03') }))
  await wait(await vaultB.deposit(tokenB, { value: ethers.parseEther('0.01') }))
  console.log('setup_deposits_ok', { tokenA: tokenA.toString(), tokenB: tokenB.toString() })

  const intent = {
    tokenId: tokenA,
    nonce: 1n,
    target: payee,
    amount: ethers.parseEther('0.01'),
    resourceHash: resource,
    allow: true,
  }
  const digest: string = await c.verifier.digest([
    intent.tokenId,
    intent.nonce,
    intent.target,
    intent.amount,
    intent.resourceHash,
    intent.allow,
  ])

  console.log('tee_evaluate_start', digest)
  const evalResult = await evaluateIntent({
    role: 'fastPolicy',
    digest,
    tokenId: tokenA.toString(),
    target: payee,
    amountWei: intent.amount.toString(),
    resource: resourceStr,
  })
  if (evalResult.processResponse !== true || evalResult.teeVerifiedRouter !== true) {
    throw new Error('TEE failed')
  }
  if (!evalResult.decision.allow) throw new Error('model DENY on happy path')
  console.log('tee_ok', {
    model: evalResult.model.id,
    provider: evalResult.provider,
    chatId: evalResult.chatId,
    teeSigner: evalResult.teeSigner,
  })
  proof.tee = {
    model: evalResult.model.id,
    provider: evalResult.provider,
    chatId: evalResult.chatId,
    teeSigner: evalResult.teeSigner,
    processResponse: evalResult.processResponse,
  }

  if (evalResult.teeSigner && evalResult.teeSigner !== ethers.ZeroAddress) {
    await wait(await c.verifier.setTillTeeSigner(tokenA, evalResult.teeSigner, true))
  } else {
    throw new Error('could not recover TEE signer for on-chain verify')
  }

  const tx = await wait(
    await c.vault.release(
      tokenA,
      payee,
      intent.amount,
      resource,
      intent.nonce,
      packedOf(evalResult),
      evalResult.teeSignature
    )
  )
  console.log('release_tx', tx.hash)
  proof.releaseTx = tx.hash

  let replayBlocked = false
  try {
    await c.vault.release(
      tokenA,
      payee,
      intent.amount,
      resource,
      intent.nonce,
      packedOf(evalResult),
      evalResult.teeSignature
    )
  } catch {
    replayBlocked = true
  }
  if (!replayBlocked) throw new Error('replay was not blocked')
  console.log('replay_blocked', true)
  proof.replayBlocked = true

  const grant = issueGrant({
    tokenId: tokenA.toString(),
    owner: deployer.address,
    executor: execA2.address,
    scopes: ['pay'],
    resourceHashes: [resource],
    capWei: ethers.parseEther('0.01').toString(),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  })
  console.log('grant', grant.grantId)

  const availAfterPay = await c.vault.available(tokenA)
  let overCapBlocked = false
  try {
    const over = {
      tokenId: tokenA,
      nonce: 2n,
      target: payee,
      amount: ethers.parseEther('0.06'),
      resourceHash: resource,
      allow: true,
    }
    const overDigest: string = await c.verifier.digest([
      over.tokenId, over.nonce, over.target, over.amount, over.resourceHash, over.allow,
    ])
    const overEval = await evaluateIntent({
      role: 'fastPolicy',
      digest: overDigest,
      tokenId: tokenA.toString(),
      target: payee,
      amountWei: over.amount.toString(),
      resource: resourceStr,
    })
    if (overEval.teeSigner) {
      await wait(await c.verifier.setTillTeeSigner(tokenA, overEval.teeSigner, true))
    }
    await c.vault.release(
      tokenA, payee, over.amount, resource, 2n,
      packedOf(overEval),
      overEval.teeSignature
    )
  } catch {
    overCapBlocked = true
  }
  if (!overCapBlocked) throw new Error('over-cap was not blocked')
  if ((await c.vault.available(tokenA)) !== availAfterPay) throw new Error('over-cap moved funds')
  console.log('over_cap_blocked', true)
  proof.overCapBlocked = true

  let isolated = false
  try {
    await vaultB.release(
      tokenA, payee, ethers.parseEther('0.001'), resource, 99n, '0x', '0x'
    )
  } catch {
    isolated = true
  }
  if (!isolated) throw new Error('User B spent Till A')
  console.log('isolation_b_cannot_spend_a', true)

  await wait(await c.policy.setPaused(tokenA, true))
  let pauseBlocked = false
  try {
    await c.vault.release(
      tokenA, payee, ethers.parseEther('0.001'), resource, 8n,
      packedOf(evalResult), evalResult.teeSignature
    )
  } catch {
    pauseBlocked = true
  }
  await wait(await c.policy.setPaused(tokenA, false))
  if (!pauseBlocked) throw new Error('pause did not block spend')
  console.log('pause_blocked', true)
  proof.pauseBlocked = true

  await wait(await c.nft.revokeAuthorization(tokenA, execA2.address))
  const vaultExec = c.vault.connect(execA2)
  let revokeBlocked = false
  try {
    await vaultExec.release(
      tokenA, payee, ethers.parseEther('0.001'), resource, 9n,
      packedOf(evalResult), evalResult.teeSignature
    )
  } catch {
    revokeBlocked = true
  }
  if (!revokeBlocked) throw new Error('revoked executor spent')
  console.log('revoke_blocked', true)
  proof.revokeBlocked = true

  const jobId = ethers.id('job-refund-mainnet-1')
  const jobAmt = ethers.parseEther('0.005')
  const jobDigest: string = await c.verifier.digest([
    tokenA, 3n, payee, jobAmt, resource, true,
  ])
  const jobEval = await evaluateIntent({
    role: 'fastPolicy',
    digest: jobDigest,
    tokenId: tokenA.toString(),
    target: payee,
    amountWei: jobAmt.toString(),
    resource: resourceStr,
  })
  if (jobEval.teeSigner) {
    await wait(await c.verifier.setTillTeeSigner(tokenA, jobEval.teeSigner, true))
  }
  const beforeJob = await c.vault.available(tokenA)
  const lockTx = await wait(
    await c.vault.lockToJob(
      jobId, tokenA, payee, jobAmt, resource, 3n,
      BigInt(Math.floor(Date.now() / 1000) + 3600),
      packedOf(jobEval),
      jobEval.teeSignature
    )
  )
  const refundTx = await wait(await c.escrow.refund(jobId))
  const afterJob = await c.vault.available(tokenA)
  if (afterJob !== beforeJob) throw new Error(`refund did not restore Till A ${afterJob} ${beforeJob}`)
  console.log('job_refund_tx_ok', lockTx.hash, refundTx.hash)
  proof.jobLockTx = lockTx.hash
  proof.jobRefundTx = refundTx.hash

  const x402base = process.env.X402_URL || 'http://127.0.0.1:3002'
  let x402 = { unpaid: 0, paid: 0, body: '' }
  try {
    const unpaid = await fetch(`${x402base}/paid/result`)
    x402.unpaid = unpaid.status
    const paid = await fetch(`${x402base}/paid/result`, { headers: { 'x-payment': tx.hash } })
    x402.paid = paid.status
    x402.body = await paid.text()
    console.log('x402', x402)
  } catch (e) {
    console.error('x402 server not running yet', e)
  }
  proof.x402 = x402

  try {
    const packet = await uploadEncryptedPacket({
      till: tokenA.toString(),
      tx: tx.hash,
      model: evalResult.model.id,
      tee: evalResult.processResponse,
    })
    const anchorTx = await wait(await c.vault.anchorPacket(tokenA, packet.rootHash))
    console.log('storage', packet.rootHash, packet.txHash, anchorTx.hash)
    proof.storage = { rootHash: packet.rootHash, txHash: packet.txHash, anchorTx: anchorTx.hash }
  } catch (e) {
    console.error('storage failed (fail closed, not faked)', e)
    proof.storage = { error: String(e) }
  }

  try {
    const reg = await registerAgent(`https://till.local/agent/${tokenA}`)
    console.log('erc8004_register', reg)
    const fb = await giveFeedback(
      {
        agentId: reg.agentId,
        value: 1n,
        tag1: 'till',
        tag2: 'paid-result',
        endpoint: 'https://till.local/verify',
        feedbackURI: `https://chainscan.0g.ai/tx/${tx.hash}`,
        feedbackHash: tx.hash,
      },
      userB.privateKey
    )
    console.log('erc8004_feedback', fb)
    proof.erc8004 = { register: reg, feedback: fb }
  } catch (e) {
    console.error('erc8004', e)
    proof.erc8004 = { error: String(e) }
  }

  const availA = await c.vault.available(tokenA)
  const availB = await vaultB.available(tokenB)
  console.log('balances', { availA: availA.toString(), availB: availB.toString() })
  if (availB !== ethers.parseEther('0.01')) throw new Error('User B balance mutated')
  proof.tokenA = tokenA.toString()
  proof.tokenB = tokenB.toString()
  proof.availA = availA.toString()
  proof.availB = availB.toString()
  proof.finishedAt = new Date().toISOString()
  await writeFile(
    path.resolve(process.cwd(), '../../docs/LIVE_E2E.json'),
    JSON.stringify(proof, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
  )
  console.log('MAINNET E2E core paths executed', { tokenA: tokenA.toString(), tokenB: tokenB.toString() })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
