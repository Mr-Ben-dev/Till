import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ethers } from 'ethers'
import { packTeeAttestation } from '@till/sdk'

const ANVIL_KEY_A = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const ANVIL_KEY_B = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const ANVIL_KEY_EXEC = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
const TEE_PK = '0x00000000000000000000000000000000000000000000000000000000000a11ce'
const RPC = 'http://127.0.0.1:8546'
const FOUNDRY = process.env.USERPROFILE
  ? `${process.env.USERPROFILE}\\.foundry\\bin`
  : `${process.env.HOME}/.foundry/bin`

function run(cmd: string, args: string[], cwd: string, extraEnv?: Record<string, string>) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...extraEnv },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => {
      out += d
      process.stdout.write(d)
    })
    child.stderr.on('data', (d) => {
      err += d
      process.stderr.write(d)
    })
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} ${args.join(' ')} failed: ${err}`))
    })
  })
}

const NFT_ABI = [
  'function mint() returns (uint256)',
  'function authorizeUsage(uint256,address)',
  'function isUsageAuthorized(uint256,address) view returns (bool)',
  'event TillMinted(address indexed owner, uint256 indexed tokenId)',
]
const POLICY_ABI = [
  'function setPolicy(uint256,uint128,uint128,uint64,uint64,bool,bool)',
  'function setAllowlistMode(uint256,bool,bool,bool)',
  'function setAllowedTarget(uint256,address,bool)',
  'function setAllowedResource(uint256,bytes32,bool)',
]
const VERIFIER_ABI = [
  'function digest((uint256,uint256,address,uint256,bytes32,bool)) view returns (bytes32)',
  'function setTillTeeSigner(uint256,address,bool)',
]
const VAULT_ABI = [
  'function deposit(uint256) payable',
  'function available(uint256) view returns (uint256)',
  'function locked(uint256) view returns (uint256)',
  'function release(uint256,address,uint256,bytes32,uint256,bytes,bytes)',
  'function lockToJob(bytes32,uint256,address,uint256,bytes32,uint256,uint64,bytes,bytes)',
  'function withdraw(uint256,uint256)',
]
const ESCROW_ABI = ['function refund(bytes32)', 'function settle(bytes32)']

async function attestation(
  verifier: ethers.Contract,
  tokenId: bigint,
  nonce: bigint,
  target: string,
  amount: bigint,
  resourceHash: string
) {
  const digest: string = await verifier.digest([tokenId, nonce, target, amount, resourceHash, true])
  const json = `{"allow":true,"intent_digest":"${digest}"}`
  const respHash = createHash('sha256').update(json, 'utf8').digest('hex')
  const signedText = `1111111111111111111111111111111111111111111111111111111111111111:${respHash}`
  const tee = new ethers.Wallet(TEE_PK)
  const sig = await tee.signMessage(signedText)
  return { response: packTeeAttestation(json, json, signedText), sig }
}

async function main() {
  const contractsDir = path.resolve(process.cwd(), '../../packages/contracts')
  const anvilBin = path.join(FOUNDRY, 'anvil.exe')
  const forgeBin = path.join(FOUNDRY, 'forge.exe')
  const anvil = spawn(anvilBin, ['-p', '8546', '--silent'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  try {
    await mkdir(path.join(contractsDir, 'deployments'), { recursive: true })
    await run(
      forgeBin,
      [
        'script',
        'script/DeployTill.s.sol:DeployTill',
        '--rpc-url',
        RPC,
        '--broadcast',
        '--private-key',
        ANVIL_KEY_A,
      ],
      contractsDir,
      { DEPLOYER_PRIVATE_KEY: ANVIL_KEY_A }
    )
    const deployed = JSON.parse(await readFile(path.join(contractsDir, 'deployments/31337.json'), 'utf8')) as {
      TillAgentNFT: string
      TillPolicy: string
      TillVerifier: string
      TillVault: string
      TillJobEscrow: string
    }
    const provider = new ethers.JsonRpcProvider(RPC)
    const userA = new ethers.Wallet(ANVIL_KEY_A, provider)
    const userB = new ethers.Wallet(ANVIL_KEY_B, provider)
    const execA1 = new ethers.Wallet(ANVIL_KEY_EXEC, provider)
    const tee = new ethers.Wallet(TEE_PK)
    const payee = ethers.Wallet.createRandom().connect(provider)

    const nftA = new ethers.Contract(deployed.TillAgentNFT, NFT_ABI, userA)
    const nftB = nftA.connect(userB) as ethers.Contract
    const policyA = new ethers.Contract(deployed.TillPolicy, POLICY_ABI, userA)
    const policyB = policyA.connect(userB) as ethers.Contract
    const verifierA = new ethers.Contract(deployed.TillVerifier, VERIFIER_ABI, userA)
    const verifierB = verifierA.connect(userB) as ethers.Contract
    const vaultA = new ethers.Contract(deployed.TillVault, VAULT_ABI, userA)
    const vaultB = vaultA.connect(userB) as ethers.Contract
    const vaultExec = vaultA.connect(execA1) as ethers.Contract
    const escrowA = new ethers.Contract(deployed.TillJobEscrow, ESCROW_ABI, userA)

    const mintA = await (await nftA.mint()).wait()
    const mintB = await (await nftB.mint()).wait()
    const tokenA = nftA.interface.parseLog({
      topics: mintA!.logs[mintA!.logs.length - 1].topics as string[],
      data: mintA!.logs[mintA!.logs.length - 1].data,
    })?.args?.tokenId as bigint
    // parse TillMinted more reliably
    let tA = 1n
    let tB = 2n
    for (const log of mintA!.logs) {
      try {
        const p = nftA.interface.parseLog({ topics: log.topics as string[], data: log.data })
        if (p?.name === 'TillMinted') tA = p.args.tokenId
      } catch {
        /* skip */
      }
    }
    for (const log of mintB!.logs) {
      try {
        const p = nftA.interface.parseLog({ topics: log.topics as string[], data: log.data })
        if (p?.name === 'TillMinted') tB = p.args.tokenId
      } catch {
        /* skip */
      }
    }

    const resource = ethers.keccak256(ethers.toUtf8Bytes('till://paid-result/v1'))
    const cfg = async (policy: ethers.Contract, verifier: ethers.Contract, token: bigint, owner: ethers.Wallet) => {
      await (await policy.setPolicy(token, ethers.parseEther('1'), ethers.parseEther('5'), 86400, Math.floor(Date.now() / 1000) + 86400 * 30, true, true)).wait()
      await (await policy.setAllowlistMode(token, true, true, false)).wait()
      await (await policy.setAllowedTarget(token, payee.address, true)).wait()
      await (await policy.setAllowedResource(token, resource, true)).wait()
      await (await verifier.setTillTeeSigner(token, tee.address, true)).wait()
    }
    await cfg(policyA, verifierA, tA, userA)
    await cfg(policyB, verifierB, tB, userB)
    await (await nftA.authorizeUsage(tA, execA1.address)).wait()
    await (await vaultA.deposit(tA, { value: ethers.parseEther('5') })).wait()
    await (await vaultB.deposit(tB, { value: ethers.parseEther('5') })).wait()

    const att = await attestation(verifierA, tA, 1n, payee.address, ethers.parseEther('0.2'), resource)
    await (await vaultExec.release(tA, payee.address, ethers.parseEther('0.2'), resource, 1, att.response, att.sig)).wait()

    const attB = await attestation(verifierA, tB, 1n, payee.address, ethers.parseEther('0.1'), resource)
    let cross = false
    try {
      await vaultExec.release(tB, payee.address, ethers.parseEther('0.1'), resource, 1, attB.response, attB.sig)
      cross = true
    } catch {
      cross = false
    }
    if (cross) throw new Error('isolation failed: execA spent Till B')

    const jobId = ethers.id('job-fail-local')
    const attJ = await attestation(verifierA, tA, 2n, payee.address, ethers.parseEther('0.3'), resource)
    const availBefore = await vaultA.available(tA)
    await (
      await vaultExec.lockToJob(
        jobId,
        tA,
        payee.address,
        ethers.parseEther('0.3'),
        resource,
        2,
        Math.floor(Date.now() / 1000) + 3600,
        attJ.response,
        attJ.sig
      )
    ).wait()
    await (await escrowA.refund(jobId)).wait()
    const availAfter = await vaultA.available(tA)
    if (availAfter !== availBefore) throw new Error(`refund mismatch ${availAfter} vs ${availBefore}`)

    console.log('LOCAL E2E PASS', { tA: tA.toString(), tB: tB.toString(), deployed })
  } finally {
    anvil.kill()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
