import { useMemo, useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEmotionAggregates, personalInsight } from '../hooks/useEmotionAggregates'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useMyShowsState } from '../hooks/useMyShowsState'
import { groupByMonth } from '../lib/groupByMonth'
import { SpectrumBar } from '../components/SpectrumBar'
import { MarqueeView } from '../components/myshows/MarqueeView'
import { ShowRow } from '../components/myshows/ShowRow'
import { EmptyState } from '../components/myshows/EmptyState'
import { MonthDivider } from '../components/myshows/MonthDivider'
import type { WatchlistStatus } from '../lib/types'

const TABS: { key: WatchlistStatus; label: string }[] = [
  { key: 'want_to_see', label: 'WANT TO SEE' },
  { key: 'booked', label: 'BOOKED' },
  { key: 'seen', label: 'SEEN' },
]

export function MyShows() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, loading, refetch } = useWatchlist()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { onTouchStart, onTouchEnd } = usePullToRefresh(scrollRef, async () => { await refetch() })
  const { slices: paletteSlices, totalCards: paletteTotalCards } = useEmotionAggregates('all-time')
  const { view, tab, setTab, toggleView } = useMyShowsState()
  const [playInterestCount, setPlayInterestCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from('play_interest')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setPlayInterestCount(count ?? 0))
  }, [user])

  const filtered = useMemo(() => items.filter(i => i.status === tab), [items, tab])
  const counts = useMemo(() => ({
    want_to_see: items.filter(i => i.status === 'want_to_see').length + playInterestCount,
    booked: items.filter(i => i.status === 'booked').length,
    seen: items.filter(i => i.status === 'seen').length,
  }), [items, playInterestCount])

  const wantItems = useMemo(() => items.filter(i => i.status === 'want_to_see'), [items])
  const bookedItems = useMemo(() => items.filter(i => i.status === 'booked'), [items])
  const seenItems = useMemo(() => items.filter(i => i.status === 'seen'), [items])

  const grouped = useMemo(() => {
    if (tab !== 'seen') return null
    return groupByMonth(filtered)
  }, [tab, filtered])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  const handleShowNavigate = (eventId: string) => navigate(`/app/show/${eventId}`)

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="flex items-baseline justify-between"
        style={{ padding: '8px 20px 14px', borderBottom: '1px solid var(--rule)' }}
      >
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.04,
            color: 'var(--ink)',
          }}
        >
          My Shows
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleView}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: 'var(--ink-faint)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            {view === 'marquee' ? '▤ LEDGER' : '◧ MARQUEE'}
          </button>
        </div>
      </div>

      {view === 'marquee' ? (
        <MarqueeView
          scrollRef={scrollRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          wantItems={wantItems}
          bookedItems={bookedItems}
          seenItems={seenItems}
          counts={counts}
          paletteSlices={paletteSlices}
          paletteTotalCards={paletteTotalCards}
          onShowNavigate={handleShowNavigate}
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex" style={{ gap: 24, padding: '0 20px', borderBottom: '1px solid var(--rule)' }}>
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
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-faint)',
                    letterSpacing: '0.04em',
                    background: 'none',
                    transition: 'color 150ms',
                  }}
                >
                  {t.label}{' '}
                  <span style={{ color: active ? 'var(--accent)' : 'var(--ink-ghost)' }}>
                    {counts[t.key]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {tab === 'seen' && paletteSlices.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule)' }}>
                <div
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: 'var(--ink-faint)',
                    marginBottom: 8,
                  }}
                >
                  YOUR PALETTE, ALL {counts.seen}
                </div>
                <SpectrumBar slices={paletteSlices} height={26} totalCards={paletteTotalCards} />
                <p
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 14,
                    color: 'var(--ink-dim)',
                    lineHeight: 1.45,
                    marginTop: 8,
                  }}
                >
                  {personalInsight(paletteSlices)}
                </p>
              </div>
            )}
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
        </>
      )}
    </div>
  )
}
