import { OG_ROUTER_URL, ROLE_REQUIREMENTS, type Role } from '@till/config'

export type CatalogModel = {
  id: string
  type?: string
  verifiability?: string
  tee_attested?: boolean
  provider_count?: number
  owned_by?: string
  pricing?: { prompt?: number; completion?: number }
  architecture?: { input_modalities?: string[]; output_modalities?: string[] }
  supported_parameters?: string[]
}

export type Catalog = { data: CatalogModel[]; fetchedAt: number }

let cache: Catalog | null = null
const TTL_MS = 60_000

export async function fetchCatalog(force = false): Promise<Catalog> {
  if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) return cache
  const res = await fetch(`${OG_ROUTER_URL}/models`)
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`)
  const json = (await res.json()) as { data?: CatalogModel[] }
  const data = json.data ?? []
  cache = { data, fetchedAt: Date.now() }
  return cache
}

function isTextChat(m: CatalogModel): boolean {
  const mods = m.architecture?.input_modalities
  if (!mods?.length) return true
  return mods.includes('text') && mods.every((x) => x === 'text')
}

function hasJson(m: CatalogModel): boolean {
  return (m.supported_parameters ?? []).includes('response_format')
}

function hasTools(m: CatalogModel): boolean {
  return (m.supported_parameters ?? []).includes('tools')
}

function isTee(m: CatalogModel): boolean {
  const v = (m.verifiability ?? '').toLowerCase()
  return v === 'teeml' || v === 'teetls' || m.tee_attested === true
}

function isTeeML(m: CatalogModel): boolean {
  return (m.verifiability ?? '').toLowerCase() === 'teeml'
}

function promptPrice(m: CatalogModel): number {
  return m.pricing?.prompt ?? Number.POSITIVE_INFINITY
}

export function selectModel(
  catalog: Catalog,
  role: Role,
  preferred?: string
): CatalogModel {
  const req = ROLE_REQUIREMENTS[role]
  let candidates = catalog.data.filter(
    (m) =>
      (m.type === 'chatbot' || !m.type) &&
      isTextChat(m) &&
      isTee(m) &&
      hasJson(m) &&
      (!req.tools || hasTools(m))
  )
  const forcePrivate = req.privatePreferred || (req.moneyPath && process.env.OG_TRUST_MODE === 'private')
  if (forcePrivate) {
    const priv = candidates.filter(isTeeML)
    if (priv.length) candidates = priv
    else if (req.moneyPath && process.env.OG_TRUST_MODE === 'private') {
      throw new Error(`No TeeML model satisfies role ${role} (private trust mode)`)
    }
  }
  if (!candidates.length) {
    throw new Error(`No 0G model satisfies role ${role} (TEE+JSON required)`)
  }

  if (preferred) {
    const hit = candidates.find((m) => m.id === preferred)
    if (hit) return hit
  }

  candidates.sort((a, b) => {
    const pc = (b.provider_count ?? 0) - (a.provider_count ?? 0)
    if (pc !== 0) return pc
    return promptPrice(a) - promptPrice(b)
  })
  return candidates[0]
}

export async function selectForRole(role: Role): Promise<CatalogModel> {
  const catalog = await fetchCatalog()
  const preferred =
    role === 'defaultPolicy' || role === 'highRisk'
      ? process.env.OG_PREFERRED_POLICY_MODEL || '0gm-1.0-35b-a3b'
      : undefined
  return selectModel(catalog, role, preferred)
}

export type AutoPreset = 'auto' | 'cheap' | 'fast' | 'deep' | 'private' | 'custom'

export function selectPreset(
  catalog: Catalog,
  preset: AutoPreset,
  role: Role,
  customId?: string
): CatalogModel {
  if (preset === 'custom' && customId) {
    const hit = catalog.data.find((m) => m.id === customId)
    if (!hit) throw new Error(`Model ${customId} is not in the live 0G catalog`)
    const req = ROLE_REQUIREMENTS[role]
    if (req.moneyPath) {
      const v = (hit.verifiability ?? '').toLowerCase()
      if (v !== 'teeml') throw new Error(`${customId} is not TeeML — blocked for spend/security decisions`)
      if (!hasJson(hit) || (req.tools && !hasTools(hit))) {
        throw new Error(`${customId} cannot satisfy JSON/tools for this role`)
      }
    }
    return hit
  }
  if (preset === 'private' || preset === 'deep') {
    return selectModel(catalog, role === 'compiler' ? 'highRisk' : role)
  }
  if (preset === 'cheap' || preset === 'fast') {
    const req = ROLE_REQUIREMENTS[role]
    let candidates = catalog.data.filter(
      (m) =>
        (m.type === 'chatbot' || !m.type) &&
        isTextChat(m) &&
        isTee(m) &&
        hasJson(m) &&
        (!req.tools || hasTools(m))
    )
    if (!candidates.length) throw new Error('No 0G TEE+JSON model for this preset')
    if (preset === 'fast') {
      candidates.sort((a, b) => (b.provider_count ?? 0) - (a.provider_count ?? 0) || promptPrice(a) - promptPrice(b))
    } else {
      candidates.sort((a, b) => promptPrice(a) - promptPrice(b))
    }
    return candidates[0]
  }
  return selectModel(catalog, role)
}
