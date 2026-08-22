import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { saveTillName } from '../lib/tillMeta'
import { BrowserProvider, Contract, JsonRpcProvider, Wallet, formatEther, id as keccakId, keccak256, parseEther, parseUnits, toUtf8Bytes, type Signer, type TransactionResponse } from 'ethers'
import { ADDR, CHAIN_ID, DEFAULT_BRIEF_SUBJECT, HUB_SWAP, MINT_FROM_BLOCK, MISSION_CAP_USD, RESOURCE, RPC_URL, USDCE, ensureOgChain } from '../lib/chain'
import { ESCROW_ABI, NFT_ABI, POLICY_ABI, VAULT_ABI, VERIFIER_ABI } from '../lib/abi'
import { decodeErr } from '../lib/errors'
import type { Denial } from '../components/app/DenialCard'
import type { SignKind } from '../lib/signCopy'
import * as api from '../lib/api'
import { signExactEip3009 } from '../lib/eip3009'

export type PipelineStep = {
  key: string
  label: string
  state: 'idle' | 'wait' | 'ok' | 'fail' | 'skip'
  detail?: string
}

const INITIAL_STEPS: PipelineStep[] = [
  { key: 'plan', label: 'Compile', state: 'idle' },
  { key: 'budget', label: 'Quote', state: 'idle' },
  { key: 'drawer', label: 'Session drawer', state: 'idle' },
  { key: 'tee', label: '0G Compute', state: 'idle' },
  { key: 'buy1', label: 'Procurement', state: 'idle' },
  { key: 'buy2', label: 'Procurement', state: 'idle' },
  { key: 'buy3', label: 'Procurement', state: 'idle' },
  { key: 'result', label: 'Result', state: 'idle' },
  { key: 'storage', label: 'Storage', state: 'idle' },
  { key: 'sweep', label: 'Sweep leftover USDC.e', state: 'idle' },
  { key: 'proof', label: 'Proof', state: 'idle' },
]

export type JobPhase = 'idle' | 'quote' | 'quoted' | 'lock' | 'working' | 'settle' | 'refunded' | 'failed'

type JobHold = {
  tillId: bigint
  jobId: string
  amt: bigint
  amountLabel: string
  nonce: bigint
  packed: string
  teeSignature: string
  teeSigner: string
  label: string
  model: string
  lockTx?: string
}
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
  const [signKind, setSignKind] = useState<SignKind>('')
  const [jobNeedsTee, setJobNeedsTee] = useState(false)
  const [modelNote, setModelNote] = useState('')
  const [agentSkipped, setAgentSkipped] = useState(false)
  const [lastBrief, setLastBrief] = useState<api.BriefDoc | null>(null)
  const [briefModel, setBriefModel] = useState('')
  const [briefTrust, setBriefTrust] = useState('')
  const [mission, setMission] = useState<api.MissionDiscover | null>(null)
  const [purchases, setPurchases] = useState<api.PurchaseRecord[]>([])
  const [usdceAtomic, setUsdceAtomic] = useState(0n)
  const [drawerUsdceAtomic, setDrawerUsdceAtomic] = useState(0n)
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
  const jobHoldRef = useRef<JobHold | null>(null)

  const resourceHash = useMemo(() => keccak256(toUtf8Bytes(RESOURCE)), [])

  const withSigner = useCallback(async (fn: (s: Signer) => Promise<void>) => {
    if (!wallet) throw new Error('Connect a wallet first')
    const provider = await wallet.getEthereumProvider()
    await ensureOgChain(provider)
    const browser = new BrowserProvider(provider)
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
      setSignKind('owner')
      setLastWrite('network')
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
    setJobNeedsTee(false)
    jobHoldRef.current = null
    setSignKind('')
    setLastWrite('')
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
          if (stored) {
            setAgentGas(await provider.getBalance(stored.address))
            try {
              const erc20 = new Contract(USDCE, ['function balanceOf(address) view returns (uint256)'], provider)
              const dbal = await erc20.balanceOf(stored.address)
              if (gen !== genRef.current) return
              setDrawerUsdceAtomic(asBig(dbal))
            } catch {
              if (gen !== genRef.current) return
              setDrawerUsdceAtomic(0n)
            }
          } else {
            setAgentGas(0n)
            setDrawerUsdceAtomic(0n)
          }
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

  const waitReceipt = async (hash: string) => {
    const p = new JsonRpcProvider(RPC_URL)
    for (let i = 0; i < 90; i++) {
      const rec = await p.getTransactionReceipt(hash)
      if (rec) {
        if (rec.status === 0) throw new Error('Transaction reverted on Aristotle.')
        return rec
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('No Aristotle receipt yet. Do not click again — check the explorer.')
  }

  const trackOwnerTx = async (name: string, send: () => Promise<TransactionResponse>) => {
    setSignKind('owner')
    setLastWrite(name)
    setWritePhase('signing')
    const tx = await send()
    setWritePhase('submitted')
    setLastTx(tx.hash)
    setWritePhase('waiting')
    const rec = await waitReceipt(tx.hash)
    setLastTx(rec.hash)
    setWritePhase('confirmed')
    return rec
  }

  const mint = (name = '') =>
    run('Creating Till', () =>
      withSigner(async (s) => {
        const { nft } = contractsOf(s)
        const rec = await trackOwnerTx('mint', () => nft.mint())
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
        const id = tokenIdRef.current
        if (id == null) throw new Error('Create a Till first')
        const { vault } = contractsOf(s)
        await trackOwnerTx('fund', () => vault.deposit(id, { value: parseEther(amount) }))
      })
    )

  const setPolicy = (maxTx: string, windowBudget: string, sessionDays = 30) =>
    run('Writing policy', async () => {
      const id = tokenIdRef.current
      if (id == null) throw new Error('Create a Till first')
      setLastDenial(null)
      await withSigner(async (s) => {
        if (!sameId(tokenIdRef.current, id)) throw new Error('Till changed. Policy write cancelled.')
        const { policy } = contractsOf(s)
        const days = Math.min(Math.max(sessionDays, 1), 90)
        const session = BigInt(Math.floor(Date.now() / 1000) + 86400 * days)
        await trackOwnerTx('policy', () =>
          policy.setPolicy(id, parseEther(maxTx), parseEther(windowBudget), 86400n, session, true, true)
        )
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
        const id = tokenIdRef.current
        if (id == null) throw new Error('Create a Till first')
        let stored = loadAgent(id.toString())
        if (!stored) {
          const w = Wallet.createRandom()
          stored = { address: w.address, privateKey: w.privateKey }
          localStorage.setItem(`till.agent.${id}`, JSON.stringify(stored))
        }
        const { nft } = contractsOf(s)
        await trackOwnerTx('authorize', () => nft.authorizeUsage(id, stored.address))
        await api.issueGrant({
          tokenId: id.toString(),
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
        const id = tokenIdRef.current
        if (id == null) throw new Error('Create a Till first')
        const stored = loadAgent(id.toString())
        if (!stored) throw new Error('Create an agent first')
        await trackOwnerTx('gas', () => s.sendTransaction({ to: stored.address, value: parseEther(amount) }))
      })
    )

  const revokeAgent = (exec: string) =>
    run('Revoking', () =>
      withSigner(async (s) => {
        const id = tokenIdRef.current
        if (id == null) throw new Error('Create a Till first')
        const { nft } = contractsOf(s)
        await trackOwnerTx('revoke', () => nft.revokeAuthorization(id, exec))
      })
    )

  const pause = (v: boolean) =>
    run(v ? 'Pausing' : 'Unpausing', () =>
      withSigner(async (s) => {
        const id = tokenIdRef.current
        if (id == null) throw new Error('Create a Till first')
        await trackOwnerTx('pause', () => contractsOf(s).policy.setPaused(id, v))
      })
    )

  const withdraw = (amount: string) =>
    run('Withdrawing', () =>
      withSigner(async (s) => {
        const id = tokenIdRef.current
        if (id == null) throw new Error('Create a Till first')
        await trackOwnerTx('withdraw', () => contractsOf(s).vault.withdraw(id, parseEther(amount)))
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

  const payX402 = (subject = DEFAULT_BRIEF_SUBJECT, extras?: { family?: string; artifact?: string }) =>
    run('Running mission', async () => {
      if (tokenId == null) throw new Error('Create a Till first')
      if (backend !== 'ok') throw new Error('Payment and proof services are offline. You can still create, fund, and set policy.')
      const stored = tokenId != null ? loadAgent(tokenId.toString()) : null
      const sessionOk =
        stored && authorized.some((a) => a.toLowerCase() === stored.address.toLowerCase())
      if (!sessionOk || !stored) {
        throw new Error('Authorize a device-local session first. APP missions are signed by the session EOA, never the owner or operator key.')
      }
      setSignKind('auto')
      setLastWrite('mission')
      setLastDenial(null)
      setModelNote('')
      setLastBrief(null)
      setBriefModel('')
      setBriefTrust('')
      setMission(null)
      setPurchases([])
      setSteps(INITIAL_STEPS.map((s) => ({ ...s, state: s.key === 'plan' ? 'wait' : 'idle' })))
      const found = await api.discoverMission(subject, extras?.family, extras?.artifact)
      setMission(found)
      if (found.compiled && found.compiled.ok === false) {
        throw new Error(found.compiled.ask || found.compiled.refuse || 'Mission needs more information')
      }
      const buyLabels = (found.quotes ?? []).slice(0, 3).map((q, i) => ({
        key: `buy${i + 1}`,
        label: `${q.seller} ${q.sku}`,
      }))
      setSteps((prev) =>
        prev.map((s) => {
          const named = buyLabels.find((b) => b.key === s.key)
          return named ? { ...s, label: named.label } : s
        })
      )
      patchStep('plan', { state: 'ok', detail: found.familyLabel || found.plan[0] })
      patchStep('budget', {
        state: 'ok',
        detail: `$${(found.totalUsd ?? 0).toFixed(3)} quoted · $${found.capUsd.toFixed(2)} drawer max`,
      })
      if ((found.totalUsd ?? 0) > found.capUsd) {
        setLastDenial({
          amount: `$${found.totalUsd} USDC.e`,
          why: `Quote exceeds the $${found.capUsd} session-drawer cap. $0 spent.`,
          policy: false,
          tee: true,
          funds: true,
        })
        throw new Error(`Quote exceeds the $${found.capUsd} cap. $0 spent.`)
      }
      const erc20 = new Contract(
        USDCE,
        ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'],
        new JsonRpcProvider(RPC_URL)
      )
      const quoteAtomic = BigInt(found.totalAtomic || '0')
      let drawer = asBig(await erc20.balanceOf(stored.address))
      const hardMax = parseUnits('0.5', 6)
      if (drawer > hardMax) {
        patchStep('drawer', { state: 'fail', detail: 'Drawer over $0.50. Sweep first.' })
        throw new Error('Session drawer exceeds the $0.50 hard max. Sweep leftover USDC.e to the owner, then retry.')
      }
      const slack = quoteAtomic > 20_000n ? (quoteAtomic * 5n) / 100n : 20_000n
      if (quoteAtomic > 0n && drawer > quoteAtomic + slack) {
        patchStep('drawer', { state: 'wait', detail: 'Sweeping leftover USDC.e before this mission' })
        const w0 = new Wallet(stored.privateKey, new JsonRpcProvider(RPC_URL))
        const token0 = new Contract(USDCE, ['function transfer(address,uint256) returns (bool)'], w0)
        const tx0 = await token0.transfer(address, drawer)
        await tx0.wait()
        drawer = 0n
      }
      if (quoteAtomic > 0n && drawer < quoteAtomic) {
        patchStep('drawer', { state: 'wait', detail: 'Funding this mission\'s session drawer from your wallet' })
        const need = quoteAtomic - drawer
        await withSigner(async (s) => {
          const token = new Contract(USDCE, ['function transfer(address,uint256) returns (bool)'], s)
          await trackOwnerTx('fund-drawer', () => token.transfer(stored.address, need) as Promise<TransactionResponse>)
        })
        drawer = asBig(await erc20.balanceOf(stored.address))
      }
      if (quoteAtomic > 0n && drawer < quoteAtomic) {
        throw new Error('Session drawer still underfunded after transfer.')
      }
      patchStep('drawer', {
        state: 'ok',
        detail: `Session drawer ${(Number(drawer) / 1e6).toFixed(3)} USDC.e · not TillPolicy`,
      })
      const payments = []
      for (const acc of found.accepts ?? []) {
        if (!acc.accept || !acc.resourceUrl) {
          if (quoteAtomic > 0n) throw new Error(acc.error || 'Missing Herald accept for a quoted SKU')
          continue
        }
        payments.push(
          await signExactEip3009({
            privateKey: stored.privateKey,
            from: stored.address,
            accept: acc.accept,
            resourceUrl: acc.resourceUrl,
          })
        )
      }
      patchStep('tee', { state: 'wait', detail: '0G is evaluating the purchase privately' })
      const result = await api.runMission({
        subject,
        tokenId: tokenId.toString(),
        owner: address,
        family: extras?.family || found.family,
        artifact: extras?.artifact,
        session: stored.address,
        payments,
        rail: 'session',
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
        rail: result.rail ?? 'session',
        signer: stored.address,
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
          detail: p
            ? `$${p.quote.amountUsd} ${p.seller} from ${p.payer ?? stored.address}`
            : found.quotes[i]
              ? 'missing'
              : 'not needed',
        })
      })
      if (!result.brief?.title) {
        patchStep('result', { state: 'fail', detail: 'No result' })
        throw new Error('Mission finished without a result. Nothing extra was invented.')
      }
      setLastBrief(result.brief)
      setBriefModel(result.briefModel ?? '')
      setBriefTrust(result.trust ?? 'private')
      patchStep('result', {
        state: 'ok',
        detail: `${result.brief.verdict ?? 'HOLD'} · $${(result.spentUsd ?? found.totalUsd).toFixed(3)} spent`,
      })
      const proofTx = bought[0]?.ogTx
      await withExecutor(async (s) => {
        const c = contractsOf(s)
        try {
          if (proofTx) {
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
            await api.storeReceipt(proofTx, {
              tokenId: tokenId.toString(),
              digest: result.digest,
              purchases: bought,
              brief: result.brief,
              family: result.family,
              session: stored.address,
              rail: 'session',
            })
            setLastTx(proofTx)
            patchStep('proof', { state: 'ok', detail: proofTx })
          } else {
            patchStep('storage', { state: 'skip', detail: 'Compute-only mission — no x402 hash to anchor yet' })
            patchStep('proof', { state: 'ok', detail: 'Compute attestation is the proof for this family' })
          }
        } catch (e) {
          patchStep('storage', { state: 'fail', detail: decodeErr(e) })
          patchStep('proof', { state: 'fail', detail: decodeErr(e) })
        }
      })
      try {
        patchStep('sweep', { state: 'wait', detail: 'Sweep leftover USDC.e to owner before any revoke' })
        const left = asBig(await erc20.balanceOf(stored.address))
        if (left > 0n) {
          const w = new Wallet(stored.privateKey, new JsonRpcProvider(RPC_URL))
          const token = new Contract(USDCE, ['function transfer(address,uint256) returns (bool)'], w)
          const tx = await token.transfer(address, left)
          const rec = await tx.wait()
          patchStep('sweep', { state: 'ok', detail: rec?.hash ?? tx.hash })
          setTech((t) => ({ ...t, sweepTx: rec?.hash ?? tx.hash }))
        } else {
          patchStep('sweep', { state: 'ok', detail: 'Drawer empty' })
        }
      } catch (e) {
        patchStep('sweep', { state: 'fail', detail: decodeErr(e) })
        throw new Error(`Sweep failed. Do not revoke yet. ${decodeErr(e)}`)
      }
    })

  const sweepDrawer = () =>
    run('Sweeping session USDC.e', async () => {
      if (tokenId == null) throw new Error('Create a Till first')
      const stored = loadAgent(tokenId.toString())
      if (!stored) throw new Error('No session on this device')
      const provider = new JsonRpcProvider(RPC_URL)
      const erc20 = new Contract(USDCE, ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'], provider)
      const left = asBig(await erc20.balanceOf(stored.address))
      if (left === 0n) return
      const w = new Wallet(stored.privateKey, provider)
      const token = new Contract(USDCE, ['function transfer(address,uint256) returns (bool)'], w)
      const tx = await token.transfer(address, left)
      await tx.wait()
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

  const quoteJob = (jobLabel: string, amount: string) =>
    run('Preparing quote', async () => {
      const id = tokenIdRef.current
      if (id == null) throw new Error('Create a Till first')
      setSignKind('')
      setLastWrite('job-quote')
      setLastDenial(null)
      setJobPhase('quote')
      const provider = new JsonRpcProvider(RPC_URL)
      const vault = new Contract(ADDR.vault, VAULT_ABI, provider)
      const verifier = new Contract(ADDR.verifier, VERIFIER_ABI, provider)
      const nonce = await nextNonce(vault, id)
      const amt = parseEther(amount)
      const avail: bigint = await vault.available(id)
      if (amt > avail) throw new Error(`This Till only has ${formatEther(avail)} 0G.`)
      const jobId = keccakId(`${jobLabel}-${Date.now()}`)
      const digest: string = await verifier.digest([id, nonce, payee, amt, resourceHash, true])
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
        jobHoldRef.current = null
        setJobNeedsTee(false)
        setLastDenial({
          amount: `${formatEther(amt)} 0G`,
          why,
          policy: true,
          tee: true,
          funds: true,
        })
        return
      }
      const already: boolean = await verifier.tillTeeSigners(id, ev.teeSigner)
      jobHoldRef.current = {
        tillId: id,
        jobId,
        amt,
        amountLabel: amount,
        nonce,
        packed: ev.packed,
        teeSignature: ev.teeSignature,
        teeSigner: ev.teeSigner,
        label: jobLabel,
        model: ev.model?.id ?? '',
      }
      setJobNeedsTee(!already)
      setJobPhase('quoted')
    })

  const registerJobTee = () =>
    run('Registering TEE signer', async () => {
      const hold = jobHoldRef.current
      if (!hold) throw new Error('Get a quote first.')
      await withSigner(async (s) => {
        if (!sameId(tokenIdRef.current, hold.tillId)) throw new Error('Till changed. Job cancelled.')
        await trackOwnerTx('job-tee', () => contractsOf(s).verifier.setTillTeeSigner(hold.tillId, hold.teeSigner, true))
        setJobNeedsTee(false)
      })
    })

  const lockQuotedJob = () =>
    run('Locking funds', async () => {
      const hold = jobHoldRef.current
      if (!hold) throw new Error('Get a quote first.')
      if (jobNeedsTee) throw new Error('Register the TEE signer first. That is one owner signature.')
      await withSigner(async (s) => {
        if (!sameId(tokenIdRef.current, hold.tillId)) throw new Error('Till changed. Job cancelled.')
        setJobPhase('lock')
        const rec = await trackOwnerTx('job-lock', () =>
          contractsOf(s).vault.lockToJob(
            hold.jobId,
            hold.tillId,
            payee,
            hold.amt,
            resourceHash,
            hold.nonce,
            BigInt(Math.floor(Date.now() / 1000) + 3600),
            hold.packed,
            hold.teeSignature
          )
        )
        setJobPhase('working')
        jobHoldRef.current = { ...hold, lockTx: rec.hash }
        setTech({
          jobId: hold.jobId,
          lockTx: rec.hash,
          amount: `${hold.amountLabel} 0G`,
          model: hold.model,
        })
      })
    })

  const finishJob = (mode: 'settle' | 'refund') =>
    run(mode === 'settle' ? 'Settling' : 'Refunding', async () => {
      const hold = jobHoldRef.current
      if (!hold) throw new Error('Lock funds first.')
      await withSigner(async (s) => {
        if (!sameId(tokenIdRef.current, hold.tillId)) throw new Error('Till changed. Job cancelled.')
        const rec = await trackOwnerTx('job-finish', () =>
          mode === 'settle' ? contractsOf(s).escrow.settle(hold.jobId) : contractsOf(s).escrow.refund(hold.jobId)
        )
        if (!sameId(tokenIdRef.current, hold.tillId)) return
        setJobPhase(mode === 'settle' ? 'settle' : 'refunded')
        setLastWrite('job')
        setTech({
          jobId: hold.jobId,
          lockTx: hold.lockTx ?? '',
          finishTx: rec.hash,
          mode,
          amount: `${hold.amountLabel} 0G`,
          destination: mode === 'settle' ? payee : 'back to this Till',
          model: hold.model,
        })
      })
    })

  const register8004 = (uri: string) =>
    run('Registering ERC-8004', () =>
      withSigner(async (s) => {
        const identity = new Contract(ADDR.identity, ['function register(string) returns (uint256)'], s)
        await trackOwnerTx('mint', () => identity.register(uri))
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
    sweepDrawer,
    tryOverBudget,
    quoteJob,
    registerJobTee,
    lockQuotedJob,
    finishJob,
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
    jobNeedsTee,
    writePhase,
    writeLocked:
      writePhase === 'signing' || writePhase === 'submitted' || writePhase === 'waiting' || !!busy,
    lastWrite,
    signKind,
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
    drawerUsdceAtomic,
    drawerUsdceUsd: Number(drawerUsdceAtomic) / 1e6,
    missionCapUsd: MISSION_CAP_USD,
    hubSwap: HUB_SWAP,
  }
}

export type TillState = ReturnType<typeof useTill>
