export function loadTillName(id: bigint | string): string {
  const key = String(id)
  try {
    const n = localStorage.getItem(`till.name.${key}`)?.trim()
    if (n) return n
  } catch {
    /* ignore */
  }
  return `Till ${key}`
}

export function saveTillName(id: bigint | string, name: string) {
  const key = String(id)
  const clean = name.trim() || `Till ${key}`
  try {
    localStorage.setItem(`till.name.${key}`, clean)
  } catch {
    /* ignore */
  }
}
