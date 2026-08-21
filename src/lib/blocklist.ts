export type BlockReason = 'aggregator' | 'closed' | 'duplicate' | 'not_chicago' | 'other'

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  aggregator: 'Aggregator / listing site',
  closed: 'Permanently closed',
  duplicate: 'Duplicate of another entry',
  not_chicago: 'Not in Chicago',
  other: 'Other',
}

export function normalizeDomain(url: string | null): string | null {
  if (!url) return null

  let s = url.trim()
  if (!s) return null

  // Strip scheme
  s = s.replace(/^https?:\/\//i, '')

  // Nothing left after stripping scheme
  if (!s || s === '/') return null

  // Strip path, query, fragment
  const slashIdx = s.indexOf('/')
  if (slashIdx !== -1) s = s.substring(0, slashIdx)

  // Strip port
  const colonIdx = s.indexOf(':')
  if (colonIdx !== -1) s = s.substring(0, colonIdx)

  // Lowercase
  s = s.toLowerCase()

  // Strip leading www.
  if (s.startsWith('www.')) s = s.substring(4)

  return s || null
}
