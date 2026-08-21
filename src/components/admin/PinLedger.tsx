import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

type Disposition = 'SHOWN' | 'HIDDEN · unresolved geocode' | 'HIDDEN · out of city' | 'HIDDEN · blocked site' | 'MERGED' | 'PENDING · candidate' | 'REJECTED'

interface LedgerEntry {
  id: string
  name: string
  status: string
  disposition: Disposition
  geocode_status: string | null
  latitude: number | null
  longitude: number | null
  reason: string | null
  duplicate_name: string | null
}

const CHICAGO_CENTER_LAT = 41.8781
const CHICAGO_CENTER_LNG = -87.6298

function computeDisposition(v: {
  status: string
  geocode_status: string | null
  latitude: number | null
  longitude: number | null
}): Disposition {
  if (v.status === 'rejected') return 'REJECTED'
  if (v.status === 'duplicate') return 'MERGED'
  if (v.status === 'candidate') return 'PENDING · candidate'
  if (v.status === 'out_of_city') return 'HIDDEN · out of city'
  if (v.status === 'fetch_blocked') return 'HIDDEN · blocked site'
  if (v.geocode_status === 'default' || (v.latitude === CHICAGO_CENTER_LAT && v.longitude === CHICAGO_CENTER_LNG)) {
    return 'HIDDEN · unresolved geocode'
  }
  return 'SHOWN'
}

const DISPOSITION_COLORS: Record<Disposition, string> = {
  'SHOWN': '#22c55e',
  'HIDDEN · unresolved geocode': '#f59e0b',
  'HIDDEN · out of city': '#f59e0b',
  'HIDDEN · blocked site': '#f59e0b',
  'MERGED': '#8b5cf6',
  'PENDING · candidate': '#3b82f6',
  'REJECTED': '#ef4444',
}

export function PinLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: venues } = await supabase
        .from('venues')
        .select('id, name, status, geocode_status, latitude, longitude, duplicate_of')
        .eq('venue_type', 'school')
        .order('name')

      const { data: rejections } = await supabase
        .from('discovery_rejections')
        .select('school_name, reason')

      const rejectionMap = new Map<string, string>()
      for (const r of rejections ?? []) {
        if (r.school_name) rejectionMap.set(r.school_name.toLowerCase(), r.reason)
      }

      const venueMap = new Map<string, string>()
      for (const v of venues ?? []) venueMap.set(v.id, v.name)

      const ledger: LedgerEntry[] = (venues ?? []).map(v => ({
        id: v.id,
        name: v.name,
        status: v.status,
        disposition: computeDisposition(v),
        geocode_status: v.geocode_status,
        latitude: v.latitude,
        longitude: v.longitude,
        reason: rejectionMap.get(v.name.toLowerCase()) ?? null,
        duplicate_name: v.duplicate_of ? (venueMap.get(v.duplicate_of) ?? null) : null,
      }))

      setEntries(ledger)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', padding: 16 }}>Loading registry...</div>

  const counts: Record<string, number> = {}
  for (const e of entries) counts[e.disposition] = (counts[e.disposition] ?? 0) + 1

  const shown = counts['SHOWN'] ?? 0
  const hidden = (counts['HIDDEN · unresolved geocode'] ?? 0) + (counts['HIDDEN · out of city'] ?? 0) + (counts['HIDDEN · blocked site'] ?? 0)
  const rejected = counts['REJECTED'] ?? 0
  const merged = counts['MERGED'] ?? 0
  const pending = counts['PENDING · candidate'] ?? 0

  return (
    <div>
      <div style={{
        ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)',
        padding: '12px 0 8px', borderBottom: '1px solid var(--rule)',
      }}>
        PIN LEDGER
      </div>

      <div style={{
        ...mono, fontSize: 10, padding: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ color: 'var(--ink)' }}>{entries.length} in registry</span>
        <span style={{ color: '#22c55e' }}>{shown} shown</span>
        {hidden > 0 && <span style={{ color: '#f59e0b' }}>{hidden} hidden</span>}
        {rejected > 0 && <span style={{ color: '#ef4444' }}>{rejected} rejected</span>}
        {merged > 0 && <span style={{ color: '#8b5cf6' }}>{merged} merged</span>}
        {pending > 0 && <span style={{ color: '#3b82f6' }}>{pending} pending</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {entries.map(e => (
          <div key={e.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '4px 0', borderBottom: '1px solid var(--rule-soft, var(--rule))',
          }}>
            <span style={{ ...mono, fontSize: 10, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.name}
            </span>
            <span style={{
              ...mono, fontSize: 8, color: DISPOSITION_COLORS[e.disposition],
              marginLeft: 8, flexShrink: 0, textAlign: 'right',
            }}>
              {e.disposition}
              {e.disposition === 'MERGED' && e.duplicate_name && ` → ${e.duplicate_name}`}
              {e.disposition === 'REJECTED' && e.reason && ` (${e.reason})`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
