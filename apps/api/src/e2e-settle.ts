import { ethers } from 'ethers'
import { contracts, evaluateIntent, getSigner, productionGuards, wait } from '@till/sdk'
import { OG_RPC_URL } from '@till/config'

productionGuards()

async function main() {
  const deployer = getSigner()
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const c = contracts(deployer)
  const payee = process.env.X402_PAYEE || deployer.address
  const resourceStr = 'till://paid-result/v1'
  const resource = ethers.keccak256(ethers.toUtf8Bytes(resourceStr))
  const tokenA = 1n
  const nonce = 4n
  const amount = ethers.parseEther('0.001')
  const jobId = ethers.id('job-settle-mainnet-1')

  const used = await c.vault.usedNonces(tokenA, nonce)
  if (used) throw new Error('nonce 4 already used')
  const existing = await c.escrow.jobs(jobId)
  if (existing.amount !== 0n) throw new Error('job-settle-mainnet-1 already opened')

  const digest: string = await c.verifier.digest([tokenA, nonce, payee, amount, resource, true])
  console.log('settle_tee_start', digest)
  const evalResult = await evaluateIntent({
    role: 'fastPolicy',
    digest,
    tokenId: tokenA.toString(),
    target: payee,
    amountWei: amount.toString(),
    resource: resourceStr,
  })
  if (evalResult.processResponse !== true || evalResult.teeVerifiedRouter !== true) {
    throw new Error('TEE failed for settle')
  }
  if (evalResult.teeSigner && evalResult.teeSigner !== ethers.ZeroAddress) {
    await wait(await c.verifier.setTillTeeSigner(tokenA, evalResult.teeSigner, true))
  }
  const before = await c.vault.available(tokenA)
  const lockTx = await wait(
    await c.vault.lockToJob(
      jobId,
      tokenA,
      payee,
      amount,
      resource,
      nonce,
      BigInt(Math.floor(Date.now() / 1000) + 3600),
      evalResult.packed,
      evalResult.teeSignature
    )
  )
  const settleTx = await wait(await c.escrow.settle(jobId))
  const after = await c.vault.available(tokenA)
  if (after !== before - amount) throw new Error(`settle did not consume lock ${before} ${after}`)
  const job = await c.escrow.jobs(jobId)
  if (!job.settled) throw new Error('job not marked settled')
  console.log(
    JSON.stringify(
      {
        ok: true,
        tokenId: tokenA.toString(),
        jobId,
        lockTx: lockTx.hash,
        settleTx: settleTx.hash,
        amount: amount.toString(),
        model: evalResult.model.id,
        processResponse: evalResult.processResponse,
        before: before.toString(),
        after: after.toString(),
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
