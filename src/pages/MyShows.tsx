import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist'
import { useAuth } from '../contexts/AuthContext'
import { base, emotionBySlug } from '../lib/emotions'
import type { WatchlistItem, WatchlistStatus } from '../lib/types'

const TABS: { key: WatchlistStatus; label: string }[] = [
  { key: 'want_to_see', label: 'WANT TO SEE' },
  { key: 'booked', label: 'BOOKED' },
  { key: 'seen', label: 'SEEN' },
]

export function MyShows() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, loading } = useWatchlist()
  const [tab, setTab] = useState<WatchlistStatus>('want_to_see')

  const filtered = useMemo(() => items.filter(i => i.status === tab), [items, tab])
  const counts = useMemo(() => ({
    want_to_see: items.filter(i => i.status === 'want_to_see').length,
    booked: items.filter(i => i.status === 'booked').length,
    seen: items.filter(i => i.status === 'seen').length,
  }), [items])

  const grouped = useMemo(() => {
    if (tab !== 'seen') return null
    return groupByMonth(filtered)
  }, [tab, filtered])

  const sinceYear = user?.created_at
    ? new Date(user.created_at).getFullYear()
    : new Date().getFullYear()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg, #0c0a05)' }}>
      {/* Header */}
      <div
        className="flex items-baseline justify-between"
        style={{ padding: '8px 20px 14px', borderBottom: '1px solid #2b2720' }}
      >
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.04,
            color: 'var(--ink, #ebe5d6)',
          }}
        >
          My Shows
        </h1>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: '#625b4c',
          }}
        >
          SINCE {sinceYear}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ gap: 24, padding: '0 20px', borderBottom: '1px solid #2b2720' }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 12,
                padding: '8px 0 12px',
                borderBottom: active ? '2px solid oklch(0.80 0.14 55)' : '2px solid transparent',
                color: active ? '#ebe5d6' : '#625b4c',
                letterSpacing: '0.04em',
                background: 'none',
                transition: 'color 150ms',
              }}
            >
              {t.label}{' '}
              <span style={{ color: active ? 'oklch(0.80 0.14 55)' : '#4f4a3e' }}>
                {counts[t.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState shelf={tab} />
        ) : tab === 'seen' && grouped ? (
          grouped.map(group => (
            <div key={group.label}>
              <MonthDivider label={group.label} count={group.items.length} />
              {group.items.map(item => (
                <ShowRow key={item.id} item={item} tab={tab} onLog={() => navigate(`/app/log/${item.event_id}`)} />
              ))}
            </div>
          ))
        ) : (
          filtered.map(item => (
            <ShowRow key={item.id} item={item} tab={tab} onLog={() => navigate(`/app/log/${item.event_id}`)} />
          ))
        )}
      </div>
    </div>
  )
}

function EmptyState({ shelf }: { shelf: WatchlistStatus }) {
  const copy = {
    want_to_see: {
      line1: 'Nothing on the list yet.',
      line2: 'The map knows what’s up tonight. Start there.',
    },
    booked: {
      line1: 'Nothing here yet.',
      line2: 'Tap ✦ to log something you already saw — it counts, even from 2019.',
    },
    seen: {
      line1: 'Your record starts whenever you say it does.',
      line2: 'Log something you saw in 2019 — it counts.',
    },
  }[shelf]

  return (
    <div className="flex flex-col items-center justify-center h-40 px-8 text-center">
      <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 15, color: '#ebe5d6', marginBottom: 6 }}>
        {copy.line1}
      </p>
      <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: '#9c9586' }}>
        {copy.line2}
      </p>
    </div>
  )
}

function MonthDivider({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center" style={{ padding: '12px 20px 10px', gap: 10 }}>
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 10.5,
          color: '#625b4c',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: '#2b2720' }} />
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9.5,
          color: '#4f4a3e',
          whiteSpace: 'nowrap',
        }}
      >
        {count} {count === 1 ? 'SHOW' : 'SHOWS'}
      </span>
    </div>
  )
}

function ShowRow({ item, tab, onLog }: { item: WatchlistItem; tab: WatchlistStatus; onLog: () => void }) {
  const event = item.event
  if (!event) return null

  const venue = event.venue
  const day = item.seen_date
    ? new Date(item.seen_date + 'T12:00:00').getDate().toString().padStart(2, '0')
    : null

  const venueLine = [venue?.name?.toUpperCase(), venue?.neighborhood?.toUpperCase()].filter(Boolean).join(' · ')

  const excerpt = item.reflection
    ? truncate(item.reflection, 80)
    : null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '34px 1fr auto',
        gap: 12,
        padding: '11px 20px',
        borderBottom: '1px solid #211d17',
      }}
    >
      {/* Day */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#625b4c', paddingTop: 3 }}>
        {day ?? ''}
      </div>

      {/* Title + Venue */}
      <div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 17.5,
              lineHeight: 1.2,
              color: 'var(--ink, #ebe5d6)',
            }}
          >
            {event.title}
          </span>
        </div>
        {venueLine && (
          <p
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              color: '#625b4c',
              marginTop: 2,
              letterSpacing: '0.04em',
            }}
          >
            {venueLine}
          </p>
        )}
        {excerpt && (
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 13.5,
              color: '#9c9586',
              marginTop: 5,
            }}
          >
            {excerpt}
          </p>
        )}
        {(tab === 'want_to_see' || tab === 'booked') && (
          <button
            onClick={onLog}
            className="mt-2"
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'oklch(0.80 0.14 55)',
              background: 'none',
              border: '1px solid #2b2720',
              borderRadius: 4,
              padding: '4px 10px',
            }}
          >
            LOG AS SEEN
          </button>
        )}
      </div>

      {/* Emotion dots */}
      <div className="flex items-start gap-0.5 pt-1" style={{ gap: 3 }}>
        {(item.emotions ?? []).map((slug, i) => {
          const e = emotionBySlug(slug)
          return (
            <div
              key={`${slug}-${i}`}
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: base(e),
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
}

interface MonthGroup {
  label: string
  items: WatchlistItem[]
}

function groupByMonth(items: WatchlistItem[]): MonthGroup[] {
  const map = new Map<string, WatchlistItem[]>()

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
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
    ;(item as any).__monthLabel = label
  }

  return Array.from(map.entries()).map(([, groupItems]) => ({
    label: (groupItems[0] as any).__monthLabel,
    items: groupItems,
  }))
}
