import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { BrowserProvider, Contract, JsonRpcProvider, Wallet, formatEther, id as keccakId, keccak256, parseEther, toUtf8Bytes, type Signer } from 'ethers'
import { ADDR, CHAIN_ID, DEFAULT_BRIEF_SUBJECT, HUB_SWAP, MINT_FROM_BLOCK, MISSION_CAP_USD, RESOURCE, RPC_URL, USDCE, ensureOgChain } from '../lib/chain'
import { ESCROW_ABI, NFT_ABI, POLICY_ABI, VAULT_ABI, VERIFIER_ABI } from '../lib/abi'
import { decodeErr } from '../lib/errors'
import type { Denial } from '../components/app/DenialCard'
import * as api from '../lib/api'

export type PipelineStep = {
  key: string
  label: string
  state: 'idle' | 'wait' | 'ok' | 'fail' | 'skip'
  detail?: string
}

const INITIAL_STEPS: PipelineStep[] = [
  { key: 'plan', label: 'Planning', state: 'idle' },
  { key: 'budget', label: '3 services selected', state: 'idle' },
  { key: 'tee', label: 'TEE verified', state: 'idle' },
  { key: 'buy1', label: 'Purchase 1', state: 'idle' },
  { key: 'buy2', label: 'Purchase 2', state: 'idle' },
  { key: 'buy3', label: 'Purchase 3', state: 'idle' },
  { key: 'result', label: 'Private synthesis', state: 'idle' },
  { key: 'storage', label: 'Storage anchored', state: 'idle' },
  { key: 'proof', label: 'Verdict', state: 'idle' },
]

export type JobPhase = 'idle' | 'quote' | 'lock' | 'working' | 'settle' | 'refunded' | 'failed'

type AgentStore = { address: string; privateKey: string }

function loadAgent(tokenId: string): AgentStore | null {
  const raw = localStorage.getItem(`till.agent.${tokenId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AgentStore
  } catch {
    return null
  }
}

export function useTill() {
  const { ready, authenticated, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const wallet =
    wallets.find((w) => w.walletClientType === 'metamask') ||
    wallets.find((w) => w.connectorType === 'injected') ||
    wallets[0]
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [tokenIds, setTokenIds] = useState<bigint[]>([])
  const [tokenId, setTokenId] = useState<bigint | null>(null)
  const [available, setAvailable] = useState(0n)
  const [locked, setLocked] = useState(0n)
  const [walletBal, setWalletBal] = useState(0n)
  const [authorized, setAuthorized] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const [payee, setPayee] = useState('0x220f5CeDDB65FD7b9D228c9495639Af58e61d1d7')
  const [priceWei, setPriceWei] = useState(parseEther('0.01'))
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS)
  const [lastTx, setLastTx] = useState('')
  const [tech, setTech] = useState<Record<string, string>>({})
  const [backend, setBackend] = useState<'ok' | 'down' | 'unknown'>('unknown')
  const [maxTxWei, setMaxTxWei] = useState(0n)
  const [windowBudgetWei, setWindowBudgetWei] = useState(0n)
  const [windowSpentWei, setWindowSpentWei] = useState(0n)
  const [sessionExpiresAt, setSessionExpiresAt] = useState(0n)
  const [agentGas, setAgentGas] = useState(0n)
  const [lastDenial, setLastDenial] = useState<Denial | null>(null)
  const [policyTested, setPolicyTested] = useState(false)
  const [jobPhase, setJobPhase] = useState<JobPhase>('idle')
  const [modelNote, setModelNote] = useState('')
  const [agentSkipped, setAgentSkipped] = useState(false)
  const [lastBrief, setLastBrief] = useState<api.BriefDoc | null>(null)
  const [briefModel, setBriefModel] = useState('')
  const [briefTrust, setBriefTrust] = useState('')
  const [mission, setMission] = useState<api.MissionDiscover | null>(null)
  const [purchases, setPurchases] = useState<api.PurchaseRecord[]>([])
  const [usdceAtomic, setUsdceAtomic] = useState(0n)
  const [lastExecutor, setLastExecutor] = useState<'owner' | 'session' | ''>('')

  const resourceHash = useMemo(() => keccak256(toUtf8Bytes(RESOURCE)), [])

  const withSigner = useCallback(async (fn: (s: Signer) => Promise<void>) => {
    if (!wallet) throw new Error('Connect a wallet first')
    const provider = await wallet.getEthereumProvider()
    await ensureOgChain(provider)
    const browser = new BrowserProvider(provider, CHAIN_ID)
    const signer = await browser.getSigner()
    setLastExecutor('owner')
    await fn(signer)
  }, [wallet])

  const sessionWallet = useCallback(() => {
    if (tokenId == null) return null
    const stored = loadAgent(tokenId.toString())
    if (!stored) return null
    const ok = authorized.some((a) => a.toLowerCase() === stored.address.toLowerCase())
    if (!ok || agentGas === 0n) return null
    return stored
  }, [tokenId, authorized, agentGas])

  const withExecutor = useCallback(
    async (fn: (s: Signer) => Promise<void>) => {
      const stored = sessionWallet()
      if (stored) {
        const w = new Wallet(stored.privateKey, new JsonRpcProvider(RPC_URL))
        setLastExecutor('session')
        await fn(w)
        return
      }
      await withSigner(fn)
    },
    [sessionWallet, withSigner]
  )

  const switchNetwork = () =>
    run('Switching to 0G Mainnet', async () => {
      if (!wallet) throw new Error('Connect a wallet first')
      const provider = await wallet.getEthereumProvider()
      await ensureOgChain(provider)
    })

  const contractsOf = (s: Signer) => ({
    nft: new Contract(ADDR.nft, NFT_ABI, s),
    policy: new Contract(ADDR.policy, POLICY_ABI, s),
    verifier: new Contract(ADDR.verifier, VERIFIER_ABI, s),
    vault: new Contract(ADDR.vault, VAULT_ABI, s),
    escrow: new Contract(ADDR.escrow, ESCROW_ABI, s),
  })

  const refresh = useCallback(async () => {
    if (!address) return
    const provider = new JsonRpcProvider(RPC_URL)
    const nft = new Contract(ADDR.nft, NFT_ABI, provider)
    const vault = new Contract(ADDR.vault, VAULT_ABI, provider)
    const policy = new Contract(ADDR.policy, POLICY_ABI, provider)
    const filter = nft.filters.TillMinted(address)
    let logs
    try {
      logs = await nft.queryFilter(filter, MINT_FROM_BLOCK)
    } catch {
      logs = await nft.queryFilter(filter, -50_000)
    }
    const ids = logs
      .map((l) => {
        const parsed = nft.interface.parseLog({ topics: l.topics as string[], data: l.data })
        return parsed?.args.tokenId as bigint
      })
      .filter(Boolean)
    setTokenIds(ids)
    const current = tokenId && ids.includes(tokenId) ? tokenId : ids[ids.length - 1] ?? null
    if (current !== tokenId) setTokenId(current)
    const useId = current
    if (useId != null) {
      setAvailable(await vault.available(useId))
      setLocked(await vault.locked(useId))
      setAuthorized(await nft.authorizedUsersOf(useId))
      const p = await policy.policyOf(useId)
      setPaused(Boolean(p.paused))
      setMaxTxWei(BigInt(p.maxSpendPerTx))
      setWindowBudgetWei(BigInt(p.rollingWindowBudget))
      setWindowSpentWei(BigInt(p.windowSpent))
      setSessionExpiresAt(BigInt(p.sessionExpiresAt))
      const stored = loadAgent(useId.toString())
      if (stored) setAgentGas(await provider.getBalance(stored.address))
      else setAgentGas(0n)
    }
    setWalletBal(await provider.getBalance(address))
    try {
      const erc20 = new Contract(USDCE, ['function balanceOf(address) view returns (uint256)'], provider)
      setUsdceAtomic(await erc20.balanceOf(address))
    } catch {
      setUsdceAtomic(0n)
    }
  }, [address, tokenId])

  useEffect(() => {
    if (!authenticated || !wallet) {
      setAddress('')
      setChainId(null)
      return
    }
    setAddress(wallet.address)
    const cid = wallet.chainId
    const n = typeof cid === 'string' && cid.includes(':') ? Number(cid.split(':')[1]) : Number(cid)
    setChainId(Number.isFinite(n) ? n : null)
  }, [wallet, authenticated])

  useEffect(() => {
    if (authenticated && address) void refresh().catch((e) => setError(decodeErr(e)))
  }, [authenticated, address, refresh])

  useEffect(() => {
    const ping = () => {
      api
        .apiHealth()
        .then((h) => setBackend(h.ok ? 'ok' : 'down'))
        .catch(() => setBackend('down'))
    }
    ping()
    const id = window.setInterval(ping, 12_000)
    api
      .publicConfig()
      .then((c) => {
        const cfg = c as {
          nft?: string
          vault?: string
          x402?: { payee?: string; priceWei?: string }
        }
        if (cfg.nft && cfg.nft.toLowerCase() !== ADDR.nft.toLowerCase()) {
          setError('Frontend and backend point at different Till contracts. Reload after the API restart.')
        }
        if (cfg.vault && cfg.vault.toLowerCase() !== ADDR.vault.toLowerCase()) {
          setError('Vault address mismatch between app and API.')
        }
        if (cfg.x402?.payee) setPayee(cfg.x402.payee)
        if (cfg.x402?.priceWei) setPriceWei(BigInt(cfg.x402.priceWei))
      })
      .catch(() => undefined)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (tokenId == null) return
    if (sessionStorage.getItem(`till.tested.${tokenId}`) === '1') setPolicyTested(true)
    if (sessionStorage.getItem(`till.skipAgent.${tokenId}`) === '1') setAgentSkipped(true)
  }, [tokenId])

  useEffect(() => {
    if (windowSpentWei > 0n) setPolicyTested(true)
  }, [windowSpentWei])

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label)
      setError('')
      try {
        await fn()
        await refresh()
      } catch (e) {
        setError(decodeErr(e))
      } finally {
        setBusy('')
      }
    },
    [refresh]
  )

  const mint = () =>
    run('Creating Till', () =>
      withSigner(async (s) => {
        const { nft } = contractsOf(s)
        const tx = await nft.mint()
        const rec = await tx.wait()
        if (!rec) throw new Error('mint: no receipt')
        setLastTx(rec.hash)
      })
    )

  const fund = (amount: string) =>
    run('Funding', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        const { vault } = contractsOf(s)
        const tx = await vault.deposit(tokenId, { value: parseEther(amount) })
        const rec = await tx.wait()
        if (!rec) throw new Error('deposit: no receipt')
        setLastTx(rec.hash)
      })
    )

  const setPolicy = (maxTx: string, windowBudget: string) =>
    run('Writing policy', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        const { policy } = contractsOf(s)
        const session = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30)
        let tx = await policy.setPolicy(tokenId, parseEther(maxTx), parseEther(windowBudget), 86400n, session, true, true)
        await tx.wait()
        tx = await policy.setAllowlistMode(tokenId, true, true, false)
        await tx.wait()
        tx = await policy.setAllowedTarget(tokenId, payee, true)
        await tx.wait()
        tx = await policy.setAllowedResource(tokenId, resourceHash, true)
        const rec = await tx.wait()
        if (!rec) throw new Error('policy: no receipt')
        setLastTx(rec.hash)
      })
    )

  const markTested = () => {
    setPolicyTested(true)
    if (tokenId != null) sessionStorage.setItem(`till.tested.${tokenId}`, '1')
  }

  const preview = async (amountWei: bigint, target = payee) => {
    if (tokenId == null) return { ok: false, reason: 'Create a Till first.' }
    const provider = new JsonRpcProvider(RPC_URL)
    const policy = new Contract(ADDR.policy, POLICY_ABI, provider)
    const vault = new Contract(ADDR.vault, VAULT_ABI, provider)
    const selector: string = await vault.RELEASE_SELECTOR()
    try {
      await policy.preview(tokenId, target, amountWei, resourceHash, selector)
      markTested()
      setLastDenial(null)
      return { ok: true, reason: 'Policy would allow this spend. TEE is still required.' }
    } catch (e) {
      let why = decodeErr(e)
      if (why.toLowerCase().includes('unknown custom error') || why.toLowerCase().includes('execution reverted')) {
        if (maxTxWei > 0n && amountWei > maxTxWei) {
          why = `Your limit is ${formatEther(maxTxWei)} 0G per transaction.`
        } else if (windowBudgetWei > 0n && amountWei + windowSpentWei > windowBudgetWei) {
          why = `This would exceed today's budget of ${formatEther(windowBudgetWei)} 0G.`
        } else {
          why = 'Policy blocked this spend. Funds stayed in the Till.'
        }
      }
      markTested()
      setLastDenial({
        amount: `${formatEther(amountWei)} 0G`,
        why,
        policy: false,
        tee: true,
        funds: true,
      })
      return { ok: false, reason: why }
    }
  }

  const testPolicy = (amountWei: bigint) => run('Testing policy', async () => { await preview(amountWei) })

  const attachAgent = () =>
    run('Authorizing agent', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        let stored = loadAgent(tokenId.toString())
        if (!stored) {
          const w = Wallet.createRandom()
          stored = { address: w.address, privateKey: w.privateKey }
          localStorage.setItem(`till.agent.${tokenId}`, JSON.stringify(stored))
        }
        const { nft } = contractsOf(s)
        const tx = await nft.authorizeUsage(tokenId, stored.address)
        const rec = await tx.wait()
        if (!rec) throw new Error('authorizeUsage: no receipt')
        setLastTx(rec.hash)
        await api.issueGrant({
          tokenId: tokenId.toString(),
          owner: address,
          executor: stored.address,
          scopes: ['pay', 'job'],
          resourceHashes: [resourceHash],
          capWei: priceWei.toString(),
          expiresAt: Math.floor(Date.now() / 1000) + 86400 * 7,
        })
      })
    )

  const fundAgentGas = (amount = '0.002') =>
    run('Sending agent gas', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        const stored = loadAgent(tokenId.toString())
        if (!stored) throw new Error('Create an agent first')
        const rec = await (await s.sendTransaction({ to: stored.address, value: parseEther(amount) })).wait()
        if (!rec) throw new Error('agent gas: no receipt')
        setLastTx(rec.hash)
      })
    )

  const revokeAgent = (exec: string) =>
    run('Revoking', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        const { nft } = contractsOf(s)
        const tx = await nft.revokeAuthorization(tokenId, exec)
        const rec = await tx.wait()
        if (!rec) throw new Error('revoke: no receipt')
        setLastTx(rec.hash)
      })
    )

  const pause = (v: boolean) =>
    run(v ? 'Pausing' : 'Unpausing', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        const rec = await (await contractsOf(s).policy.setPaused(tokenId, v)).wait()
        if (!rec) throw new Error('pause: no receipt')
        setLastTx(rec.hash)
      })
    )

  const withdraw = (amount: string) =>
    run('Withdrawing', () =>
      withSigner(async (s) => {
        if (tokenId == null) throw new Error('Create a Till first')
        const rec = await (await contractsOf(s).vault.withdraw(tokenId, parseEther(amount))).wait()
        if (!rec) throw new Error('withdraw: no receipt')
        setLastTx(rec.hash)
      })
    )

  const nextNonce = async (vault: Contract, id: bigint) => {
    for (let i = 1; i <= 96; i++) {
      const used: boolean = await vault.usedNonces(id, i)
      if (!used) return BigInt(i)
    }
    throw new Error('No free nonce in 1-96')
  }

  const patchStep = (key: string, patch: Partial<PipelineStep>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const payX402 = (subject = DEFAULT_BRIEF_SUBJECT) =>
    run('Running mission', async () => {
      if (tokenId == null) throw new Error('Create a Till first')
      if (backend !== 'ok') throw new Error('Payment and proof services are offline. You can still create, fund, and set policy.')
      setLastDenial(null)
      setModelNote('')
      setLastBrief(null)
      setBriefModel('')
      setBriefTrust('')
      setMission(null)
      setPurchases([])
      setSteps(INITIAL_STEPS.map((s) => ({ ...s, state: s.key === 'plan' ? 'wait' : 'idle' })))
      const found = await api.discoverMission(subject)
      setMission(found)
      const buyLabels = found.quotes.slice(0, 3).map((q, i) => ({
        key: `buy${i + 1}`,
        label: `${q.seller} ${q.sku}`,
      }))
      setSteps((prev) =>
        prev.map((s) => {
          const named = buyLabels.find((b) => b.key === s.key)
          return named ? { ...s, label: named.label } : s
        })
      )
      patchStep('plan', { state: 'ok', detail: found.plan[0] })
      patchStep('budget', {
        state: 'ok',
        detail: `$${found.totalUsd.toFixed(3)} quoted · $${found.capUsd.toFixed(2)} cap`,
      })
      if (found.totalUsd > found.capUsd) {
        setLastDenial({
          amount: `$${found.totalUsd} USDC.e`,
          why: `Quote exceeds the $${found.capUsd} cap. $0 spent.`,
          policy: false,
          tee: true,
          funds: true,
        })
        throw new Error(`Quote exceeds the $${found.capUsd} cap. $0 spent.`)
      }
      patchStep('tee', { state: 'wait', detail: '0G is evaluating the purchase privately' })
      const result = await api.runMission({
        subject,
        tokenId: tokenId.toString(),
        owner: address,
      })
      if (!result.ok) {
        patchStep('tee', { state: 'fail', detail: result.over?.reason || result.error })
        setLastDenial({
          amount: `$${found.totalUsd} USDC.e`,
          why: result.over?.reason || result.error || 'Mission blocked',
          policy: true,
          tee: false,
          funds: true,
        })
        throw new Error(result.over?.reason || result.error || 'Mission blocked')
      }
      const ev = result.eval
      setModelNote(ev?.model?.id ?? '')
      setTech({
        model: ev?.model?.id ?? '',
        provider: ev?.provider ?? '',
        tee: String(ev?.processResponse),
        processResponse: String(ev?.processResponse),
        verify_tee: String(ev?.teeVerifiedRouter),
        chatId: ev?.chatId ?? '',
        digest: result.digest ?? '',
        spentUsd: String(result.spentUsd ?? found.totalUsd),
      })
      const teeOk = ev?.processResponse === true && ev?.teeVerifiedRouter === true
      patchStep('tee', {
        state: teeOk ? 'ok' : 'fail',
        detail: `${ev?.model?.id ?? ''} processResponse=${String(ev?.processResponse)}`,
      })
      const bought = result.purchases ?? []
      setPurchases(bought)
      ;[0, 1, 2].forEach((i) => {
        const p = bought[i]
        patchStep(`buy${i + 1}`, {
          state: p ? (p.status === 200 ? 'ok' : 'fail') : found.quotes[i] ? 'fail' : 'skip',
          detail: p ? `$${p.quote.amountUsd} ${p.seller} ${p.ogTx ?? ''}` : found.quotes[i] ? 'missing' : 'not needed',
        })
      })
      if (!result.brief?.title) {
        patchStep('result', { state: 'fail', detail: 'No verdict' })
        throw new Error('Purchases settled, but the verdict was not returned. Nothing extra was invented.')
      }
      setLastBrief(result.brief)
      setBriefModel(result.briefModel ?? '')
      setBriefTrust(result.trust ?? 'private')
      patchStep('result', {
        state: 'ok',
        detail: `${result.brief.verdict ?? 'HOLD'} · $${(result.spentUsd ?? found.totalUsd).toFixed(3)} spent`,
      })
      const proofTx = bought[0]?.ogTx
      if (!proofTx) throw new Error('Missing 0G settlement hash')
      setLastTx(proofTx)
      await withExecutor(async (s) => {
        const c = contractsOf(s)
        try {
          patchStep('storage', { state: 'wait' })
          const packet = await api.uploadPacket({
            till: tokenId.toString(),
            tx: proofTx,
            model: result.briefModel || ev?.model?.id,
            tee: result.briefProcessResponse === true || ev?.processResponse === true,
            brief: result.brief,
          })
          const anc = await (await c.vault.anchorPacket(tokenId, packet.rootHash)).wait()
          patchStep('storage', {
            state: 'ok',
            detail: `root ${packet.rootHash} flow ${packet.txHash} anchor ${anc?.hash ?? ''}`,
          })
          setTech((t) => ({
            ...t,
            storageRoot: packet.rootHash,
            flowTx: packet.txHash,
            anchorTx: anc?.hash ?? '',
            briefModel: result.briefModel ?? '',
            briefChatId: result.briefChatId ?? '',
            briefTee: String(result.briefProcessResponse),
            subject,
            buy1: bought[0]?.ogTx ?? '',
            buy2: bought[1]?.ogTx ?? '',
            buy3: bought[2]?.ogTx ?? '',
            remainingUsd: String(result.remainingUsd ?? ''),
          }))
          await api.storeReceipt(proofTx, { tokenId: tokenId.toString(), digest: result.digest, purchases: bought, brief: result.brief })
          patchStep('proof', { state: 'ok', detail: proofTx })
        } catch (e) {
          patchStep('storage', { state: 'fail', detail: decodeErr(e) })
          patchStep('proof', { state: 'fail', detail: decodeErr(e) })
        }
      })
    })

  const tryOverBudget = () =>
    run('Testing over-budget spend', async () => {
      const res = await api.overBudget(5)
      setLastDenial({
        amount: `$${res.requestedUsd} USDC.e`,
        why: res.reason,
        policy: false,
        tee: true,
        funds: true,
      })
    })

  const lockJob = (jobLabel: string, amount: string, mode: 'settle' | 'refund') =>
    run(mode === 'settle' ? 'Settling job' : 'Refunding job', async () => {
      if (tokenId == null) throw new Error('Create a Till first')
      setJobPhase('quote')
      await withSigner(async (s) => {
        const c = contractsOf(s)
        const nonce = await nextNonce(c.vault, tokenId)
        const amt = parseEther(amount)
        const jobId = keccakId(`${jobLabel}-${Date.now()}`)
        const digest: string = await c.verifier.digest([tokenId, nonce, payee, amt, resourceHash, true])
        const ev = await api.evaluateIntent({
          digest,
          tokenId: tokenId.toString(),
          target: payee,
          amountWei: amt.toString(),
          resource: RESOURCE,
          role: 'fastPolicy',
        })
        if (!api.isAllow(ev) || !ev.packed || !ev.teeSignature || !ev.teeSigner) {
          setJobPhase('failed')
          setLastDenial({
            amount: `${formatEther(amt)} 0G`,
            why: ev.error || '0G Compute did not allow this job.',
            policy: true,
            tee: false,
            funds: true,
          })
          throw new Error(ev.error || '0G Compute did not allow this job.')
        }
        await (await c.verifier.setTillTeeSigner(tokenId, ev.teeSigner, true)).wait()
        setJobPhase('lock')
        const lockRec = await (
          await c.vault.lockToJob(
            jobId,
            tokenId,
            payee,
            amt,
            resourceHash,
            nonce,
            BigInt(Math.floor(Date.now() / 1000) + 3600),
            ev.packed,
            ev.teeSignature
          )
        ).wait()
        if (!lockRec) throw new Error('Job lock did not confirm')
        setJobPhase('working')
        const fin =
          mode === 'settle'
            ? await (await c.escrow.settle(jobId)).wait()
            : await (await c.escrow.refund(jobId)).wait()
        if (!fin) {
          setJobPhase('failed')
          throw new Error('Job did not finish on-chain')
        }
        setLastTx(fin.hash)
        setJobPhase(mode === 'settle' ? 'settle' : 'refunded')
        setTech({
          jobId,
          lockTx: lockRec.hash,
          finishTx: fin.hash,
          mode,
          amount: `${amount} 0G`,
          destination: mode === 'settle' ? payee : 'back to this Till',
          model: ev.model?.id ?? '',
        })
      })
    })

  const register8004 = (uri: string) =>
    run('Registering ERC-8004', () =>
      withSigner(async (s) => {
        const identity = new Contract(ADDR.identity, ['function register(string) returns (uint256)'], s)
        const rec = await (await identity.register(uri)).wait()
        if (!rec) throw new Error('register: no receipt')
        setLastTx(rec.hash)
      })
    )

  return {
    ready,
    authenticated,
    login,
    logout,
    address,
    chainId,
    wrongNetwork: Boolean(authenticated && chainId != null && chainId !== CHAIN_ID),
    busy,
    error,
    setError,
    tokenIds,
    tokenId,
    setTokenId,
    available,
    locked,
    walletBal,
    authorized,
    paused,
    payee,
    priceWei,
    resourceHash,
    steps,
    lastTx,
    tech,
    backend,
    mint,
    fund,
    setPolicy,
    preview,
    testPolicy,
    attachAgent,
    agentOf: tokenId != null ? loadAgent(tokenId.toString()) : null,
    revokeAgent,
    pause,
    withdraw,
    payX402,
    tryOverBudget,
    lockJob,
    register8004,
    refresh,
    RESOURCE,
    switchNetwork,
    fundAgentGas,
    maxTxWei,
    windowBudgetWei,
    windowSpentWei,
    sessionExpiresAt,
    agentGas,
    lastDenial,
    policyTested,
    jobPhase,
    modelNote,
    agentSkipped,
    lastBrief,
    briefModel,
    briefTrust,
    mission,
    purchases,
    skipAgent: () => {
      setAgentSkipped(true)
      if (tokenId != null) sessionStorage.setItem(`till.skipAgent.${tokenId}`, '1')
    },
    hasPolicy: maxTxWei > 0n,
    executionMode: sessionWallet() ? 'autonomous' : 'owner',
    lastExecutor,
    usdceAtomic,
    usdceUsd: Number(usdceAtomic) / 1e6,
    missionCapUsd: MISSION_CAP_USD,
    hubSwap: HUB_SWAP,
  }
}

export type TillState = ReturnType<typeof useTill>
