import type { WatchlistItem } from './types'

export interface MonthGroup {
  label: string
  items: WatchlistItem[]
}

export function groupByMonth(items: WatchlistItem[]): MonthGroup[] {
  const map = new Map<string, { label: string; items: WatchlistItem[] }>()

  const sorted = [...items].sort((a, b) => {
    const da = a.seen_date ?? a.updated_at
    const db = b.seen_date ?? b.updated_at
    return db.localeCompare(da)
  })

  for (const item of sorted) {
    const dateStr = item.seen_date ?? item.updated_at
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
    if (!map.has(key)) map.set(key, { label, items: [] })
    map.get(key)!.items.push(item)
  }

  return Array.from(map.values())
}
