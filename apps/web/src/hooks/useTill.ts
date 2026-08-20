import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { saveTillName } from '../lib/tillMeta'
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
export type WritePhase = 'idle' | 'signing' | 'submitted' | 'waiting' | 'confirmed' | 'failed'

export type TillCard = {
  id: bigint
  available: bigint
  maxTxWei: bigint
  paused: boolean
  authorized: number
}

type AgentStore = { address: string; privateKey: string }

const PRODUCT_PATHS = ['/tills', '/till', '/agents', '/jobs', '/activity', '/verify']

function sameId(a: bigint | null, b: bigint | null) {
  return a != null && b != null && a.toString() === b.toString()
}

function asAddrList(v: unknown): string[] {
  if (v == null) return []
  try {
    return Array.from(v as Iterable<unknown>)
      .map((a) => String(a))
      .filter((a) => a.startsWith('0x'))
  } catch {
    return []
  }
}

function asBig(v: unknown): bigint {
  try {
    if (typeof v === 'bigint') return v
    if (v == null || v === '') return 0n
    return BigInt(v as string | number | bigint)
  } catch {
    return 0n
  }
}

function loadStoredTill(): string | null {
  try {
    return localStorage.getItem('till.selectedId')
  } catch {
    return null
  }
}

function saveStoredTill(id: bigint | null) {
  try {
    if (id == null) localStorage.removeItem('till.selectedId')
    else localStorage.setItem('till.selectedId', id.toString())
  } catch {
    /* ignore */
  }
}

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
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const onProduct = PRODUCT_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))
  const urlTill = params.get('tillId')
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
  const [writePhase, setWritePhase] = useState<WritePhase>('idle')
  const [lastWrite, setLastWrite] = useState('')
  const [modelNote, setModelNote] = useState('')
  const [agentSkipped, setAgentSkipped] = useState(false)
  const [lastBrief, setLastBrief] = useState<api.BriefDoc | null>(null)
  const [briefModel, setBriefModel] = useState('')
  const [briefTrust, setBriefTrust] = useState('')
  const [mission, setMission] = useState<api.MissionDiscover | null>(null)
  const [purchases, setPurchases] = useState<api.PurchaseRecord[]>([])
  const [usdceAtomic, setUsdceAtomic] = useState(0n)
  const [lastExecutor, setLastExecutor] = useState<'owner' | 'session' | ''>('')
  const [switching, setSwitching] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [loadedFor, setLoadedFor] = useState<bigint | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tillCards, setTillCards] = useState<TillCard[]>([])
  const genRef = useRef(0)
  const tokenIdRef = useRef<bigint | null>(null)
  tokenIdRef.current = tokenId
  const urlTillRef = useRef(urlTill)
  urlTillRef.current = urlTill
  const onProductRef = useRef(onProduct)
  onProductRef.current = onProduct
  const setParamsRef = useRef(setParams)
  setParamsRef.current = setParams
  const switchingRef = useRef(false)
  const loadedForRef = useRef<bigint | null>(null)
  const busyRef = useRef(false)

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

  const writeTillQuery = useCallback((id: bigint | null) => {
    if (!onProductRef.current) return
    const next = new URLSearchParams(window.location.search)
    if (id == null) next.delete('tillId')
    else next.set('tillId', id.toString())
    const cur = new URLSearchParams(window.location.search)
    if (next.toString() === cur.toString()) return
    setParamsRef.current(next, { replace: true })
  }, [])

  const clearTillScoped = useCallback(() => {
    setAvailable(0n)
    setLocked(0n)
    setAuthorized([])
    setPaused(false)
    setMaxTxWei(0n)
    setWindowBudgetWei(0n)
    setWindowSpentWei(0n)
    setSessionExpiresAt(0n)
    setAgentGas(0n)
    setMission(null)
    setPurchases([])
    setLastBrief(null)
    setLastDenial(null)
    setTech({})
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })))
    setPolicyTested(false)
    setAgentSkipped(false)
    setJobPhase('idle')
    setModelNote('')
    setBriefModel('')
    setBriefTrust('')
    setLastExecutor('')
  }, [])

  const selectTill = useCallback(
    (id: bigint) => {
      if (sameId(tokenIdRef.current, id) && sameId(loadedForRef.current, id) && !switchingRef.current) {
        writeTillQuery(id)
        return
      }
      genRef.current += 1
      switchingRef.current = true
      setSwitching(true)
      setLoadedFor(null)
      loadedForRef.current = null
      setLoadError('')
      setError('')
      setWritePhase('idle')
      clearTillScoped()
      tokenIdRef.current = id
      setTokenId(id)
      saveStoredTill(id)
      writeTillQuery(id)
    },
    [clearTillScoped, writeTillQuery],
  )

  const refresh = useCallback(async () => {
    if (!address) return
    const gen = genRef.current
    try {
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
      if (gen !== genRef.current) return
      const ids = logs
        .map((l) => {
          const parsed = nft.interface.parseLog({ topics: l.topics as string[], data: l.data })
          const raw = parsed?.args.tokenId
          return raw == null ? null : asBig(raw)
        })
        .filter((id): id is bigint => id != null && id > 0n)
      setTokenIds(ids)
      const wanted = tokenIdRef.current
      const urlWant = urlTillRef.current
      const inList = (id: bigint | null) => id != null && ids.some((i) => i.toString() === id.toString())
      let useId: bigint | null = null
      if (wanted != null && inList(wanted)) useId = ids.find((i) => i.toString() === wanted.toString()) ?? wanted
      else if (switchingRef.current && wanted != null) {
        useId = wanted
        if (!inList(wanted)) setLoadError(`Till #${wanted} is not on this wallet.`)
      } else if (urlWant) {
        const match = ids.find((i) => i.toString() === urlWant)
        if (match) useId = match
        else if (ids.length) {
          setLoadError(`Till #${urlWant} is not on this wallet. Showing your latest Till.`)
          useId = ids[ids.length - 1]
        } else {
          setLoadError(`Till #${urlWant} was not found for this wallet.`)
          useId = null
        }
      } else {
        const stored = loadStoredTill()
        const storedMatch = stored ? ids.find((i) => i.toString() === stored) : undefined
        useId = storedMatch ?? ids[ids.length - 1] ?? null
      }
      if (useId?.toString() !== tokenIdRef.current?.toString()) {
        tokenIdRef.current = useId
        setTokenId(useId)
        saveStoredTill(useId)
        writeTillQuery(useId)
      } else if (useId != null) {
        saveStoredTill(useId)
        writeTillQuery(useId)
      }
      if (ids.length) {
        const rows = await Promise.all(
          ids.map(async (id) => {
            try {
              const [avail, lockedAmt, auths, p] = await Promise.all([
                vault.available(id),
                vault.locked(id),
                nft.authorizedUsersOf(id),
                policy.policyOf(id),
              ])
              return {
                id,
                avail: asBig(avail),
                lockedAmt: asBig(lockedAmt),
                auths: asAddrList(auths),
                maxTxWei: asBig(p?.maxSpendPerTx),
                windowBudgetWei: asBig(p?.rollingWindowBudget),
                windowSpentWei: asBig(p?.windowSpent),
                sessionExpiresAt: asBig(p?.sessionExpiresAt),
                paused: Boolean(p?.paused),
                ok: true,
              }
            } catch {
              return {
                id,
                avail: 0n,
                lockedAmt: 0n,
                auths: [] as string[],
                maxTxWei: 0n,
                windowBudgetWei: 0n,
                windowSpentWei: 0n,
                sessionExpiresAt: 0n,
                paused: false,
                ok: false,
              }
            }
          }),
        )
        if (gen !== genRef.current) return
        setTillCards(
          rows.map((r) => ({
            id: r.id,
            available: r.avail,
            maxTxWei: r.maxTxWei,
            paused: r.paused,
            authorized: r.auths.length,
          })),
        )
        const row = useId != null ? rows.find((r) => r.id.toString() === useId.toString()) : undefined
        if (row && useId != null) {
          setAvailable(row.avail)
          setLocked(row.lockedAmt)
          setAuthorized(row.auths)
          setPaused(row.paused)
          setMaxTxWei(row.maxTxWei)
          setWindowBudgetWei(row.windowBudgetWei)
          setWindowSpentWei(row.windowSpentWei)
          setSessionExpiresAt(row.sessionExpiresAt)
          const stored = loadAgent(useId.toString())
          if (stored) setAgentGas(await provider.getBalance(stored.address))
          else setAgentGas(0n)
          if (gen !== genRef.current) return
          if (row.ok) setLoadError('')
          else setLoadError(`Till #${useId} could not be fully loaded from Aristotle.`)
          setPolicyTested(sessionStorage.getItem(`till.tested.${useId}`) === '1' || row.windowSpentWei > 0n)
          setAgentSkipped(sessionStorage.getItem(`till.skipAgent.${useId}`) === '1')
          setLoadedFor(useId)
          loadedForRef.current = useId
        } else {
          setAuthorized([])
          setLoadedFor(null)
          loadedForRef.current = null
        }
      } else {
        setTillCards([])
        setAuthorized([])
        setLoadedFor(null)
        loadedForRef.current = null
      }
      if (gen !== genRef.current) return
      setWalletBal(await provider.getBalance(address))
      try {
        const erc20 = new Contract(USDCE, ['function balanceOf(address) view returns (uint256)'], provider)
        const bal = await erc20.balanceOf(address)
        if (gen !== genRef.current) return
        setUsdceAtomic(asBig(bal))
      } catch {
        if (gen !== genRef.current) return
        setUsdceAtomic(0n)
      }
    } catch (e) {
      if (gen !== genRef.current) return
      const msg = decodeErr(e)
      setLoadError(msg)
      setError(msg)
      setAuthorized([])
    } finally {
      if (gen === genRef.current) {
        switchingRef.current = false
        setSwitching(false)
        setHydrated(true)
      }
    }
  }, [address, writeTillQuery])

  useEffect(() => {
    if (!authenticated || !wallet) {
      setAddress('')
      setChainId(null)
      setHydrated(false)
      setLoadedFor(null)
      setTokenId(null)
      tokenIdRef.current = null
      return
    }
    setAddress(wallet.address)
    const cid = wallet.chainId
    const n = typeof cid === 'string' && cid.includes(':') ? Number(cid.split(':')[1]) : Number(cid)
    setChainId(Number.isFinite(n) ? n : null)
  }, [wallet, authenticated])

  useEffect(() => {
    if (authenticated && address) void refresh().catch((e) => setError(decodeErr(e)))
  }, [authenticated, address, tokenId, refresh])

  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get('tillId')
      urlTillRef.current = id
      if (!id) return
      const match = tokenIds.find((x) => x.toString() === id)
      if (match != null && match !== tokenIdRef.current) selectTill(match)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [tokenIds, selectTill])

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

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(label)
      setError('')
      try {
        await fn()
        await refresh()
      } catch (e) {
        setError(decodeErr(e))
        setWritePhase((p) => (p === 'idle' || p === 'confirmed' ? p : 'failed'))
      } finally {
        busyRef.current = false
        setBusy('')
      }
    },
    [refresh]
  )

  const mint = (name = '') =>
    run('Creating Till', () =>
      withSigner(async (s) => {
        const { nft } = contractsOf(s)
        const tx = await nft.mint()
        const rec = await tx.wait()
        if (!rec) throw new Error('mint: no receipt')
        setLastTx(rec.hash)
        let newId: bigint | null = null
        for (const log of rec.logs) {
          try {
            const parsed = nft.interface.parseLog({ topics: log.topics as string[], data: log.data })
            if (parsed?.name === 'TillMinted') newId = parsed.args.tokenId as bigint
          } catch {
            /* ignore foreign logs */
          }
        }
        if (newId != null) {
          if (name.trim()) saveTillName(newId, name)
          selectTill(newId)
        }
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

  const setPolicy = (maxTx: string, windowBudget: string, sessionDays = 30) =>
    run('Writing policy', async () => {
      const id = tokenIdRef.current
      if (id == null) throw new Error('Create a Till first')
      setWritePhase('signing')
      setLastWrite('policy')
      setLastDenial(null)
      await withSigner(async (s) => {
        if (!sameId(tokenIdRef.current, id)) throw new Error('Till changed. Policy write cancelled.')
        const { policy } = contractsOf(s)
        const days = Math.min(Math.max(sessionDays, 1), 90)
        const session = BigInt(Math.floor(Date.now() / 1000) + 86400 * days)
        const tx = await policy.setPolicy(id, parseEther(maxTx), parseEther(windowBudget), 86400n, session, true, true)
        setWritePhase('submitted')
        setLastTx(tx.hash)
        setWritePhase('waiting')
        const rec = await tx.wait()
        if (!rec) throw new Error('policy: no receipt')
        if (!sameId(tokenIdRef.current, id)) return
        setLastTx(rec.hash)
        setWritePhase('confirmed')
      })
    })

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
      const id = tokenIdRef.current
      if (id == null) throw new Error('Create a Till first')
      setLastWrite('job')
      setLastDenial(null)
      setJobPhase('quote')
      setBusy('Preparing quote')
      await withSigner(async (s) => {
        if (!sameId(tokenIdRef.current, id)) throw new Error('Till changed. Job cancelled.')
        const c = contractsOf(s)
        const nonce = await nextNonce(c.vault, id)
        const amt = parseEther(amount)
        if (amt > available) throw new Error(`This Till only has ${formatEther(available)} 0G.`)
        const jobId = keccakId(`${jobLabel}-${Date.now()}`)
        const digest: string = await c.verifier.digest([id, nonce, payee, amt, resourceHash, true])
        const jobResource = JSON.stringify([
          {
            destination: payee,
            asset: '0G',
            amount,
            resource: RESOURCE,
            reason: `Job escrow lock (${jobLabel}). Seller is paid only after settle; otherwise this Till is refunded.`,
            grant: `till-job-${id.toString()}`,
            deadline: new Date(Date.now() + 3600_000).toISOString(),
          },
        ])
        const ev = await api.evaluateIntent({
          digest,
          tokenId: id.toString(),
          target: payee,
          amountWei: amt.toString(),
          resource: jobResource,
          role: 'jobSemantic',
        })
        if (!sameId(tokenIdRef.current, id)) throw new Error('Till changed. Job cancelled.')
        if (!api.isAllow(ev) || !ev.packed || !ev.teeSignature || !ev.teeSigner) {
          const why = api.decisionReason(ev, '0G Compute denied this job lock. No funds moved.')
          setJobPhase('failed')
          setLastDenial({
            amount: `${formatEther(amt)} 0G`,
            why,
            policy: true,
            tee: true,
            funds: true,
          })
          return
        }
        const already = await c.verifier.tillTeeSigners(id, ev.teeSigner)
        if (!already) {
          setBusy('Registering TEE signer')
          setWritePhase('signing')
          const signerTx = await c.verifier.setTillTeeSigner(id, ev.teeSigner, true)
          setWritePhase('submitted')
          await signerTx.wait()
        }
        if (!sameId(tokenIdRef.current, id)) throw new Error('Till changed. Job cancelled.')
        setJobPhase('lock')
        setBusy('Locking funds')
        setWritePhase('signing')
        const lockTx = await c.vault.lockToJob(
          jobId,
          id,
          payee,
          amt,
          resourceHash,
          nonce,
          BigInt(Math.floor(Date.now() / 1000) + 3600),
          ev.packed,
          ev.teeSignature
        )
        setWritePhase('submitted')
        setLastTx(lockTx.hash)
        setWritePhase('waiting')
        const lockRec = await lockTx.wait()
        if (!lockRec) throw new Error('Job lock did not confirm')
        setJobPhase('working')
        setBusy(mode === 'settle' ? 'Settling' : 'Refunding')
        setWritePhase('signing')
        const finTx = mode === 'settle' ? await c.escrow.settle(jobId) : await c.escrow.refund(jobId)
        setWritePhase('submitted')
        const fin = await finTx.wait()
        if (!fin) {
          setJobPhase('failed')
          throw new Error('Job did not finish on-chain')
        }
        if (!sameId(tokenIdRef.current, id)) return
        setLastTx(fin.hash)
        setWritePhase('confirmed')
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
    setTokenId: selectTill,
    selectTill,
    switching,
    hydrated,
    loadedFor,
    loadError,
    tillCards,
    tillReady: tokenId != null && loadedFor === tokenId && !switching,
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
    writePhase,
    lastWrite,
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
