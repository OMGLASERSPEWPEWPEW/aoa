import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist'
import { useEmotionAggregates, personalInsight } from '../hooks/useEmotionAggregates'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { base, emotionBySlug } from '../lib/emotions'
import { genreHue } from '../lib/genre'
import { SpectrumBar } from '../components/SpectrumBar'
import type { WatchlistItem, WatchlistStatus } from '../lib/types'

type View = 'marquee' | 'ledger'

const TABS: { key: WatchlistStatus; label: string }[] = [
  { key: 'want_to_see', label: 'WANT TO SEE' },
  { key: 'booked', label: 'BOOKED' },
  { key: 'seen', label: 'SEEN' },
]

export function MyShows() {
  const navigate = useNavigate()
  const { items, loading, refetch } = useWatchlist()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { onTouchStart, onTouchEnd } = usePullToRefresh(scrollRef, async () => { await refetch() })
  const { slices: paletteSlices, totalCards: paletteTotalCards } = useEmotionAggregates('all-time')
  const [view, setView] = useState<View>('marquee')
  const [tab, setTab] = useState<WatchlistStatus>('want_to_see')

  const filtered = useMemo(() => items.filter(i => i.status === tab), [items, tab])
  const counts = useMemo(() => ({
    want_to_see: items.filter(i => i.status === 'want_to_see').length,
    booked: items.filter(i => i.status === 'booked').length,
    seen: items.filter(i => i.status === 'seen').length,
  }), [items])

  const wantItems = useMemo(() => items.filter(i => i.status === 'want_to_see'), [items])
  const bookedItems = useMemo(() => items.filter(i => i.status === 'booked'), [items])
  const seenItems = useMemo(() => items.filter(i => i.status === 'seen'), [items])

  const grouped = useMemo(() => {
    if (tab !== 'seen') return null
    return groupByMonth(filtered)
  }, [tab, filtered])

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView(view === 'marquee' ? 'ledger' : 'marquee')}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: '#625b4c',
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
          navigate={navigate}
        />
      ) : (
        <>
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {tab === 'seen' && paletteSlices.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #2b2720' }}>
                <div
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: '#625b4c',
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
                    color: '#9c9586',
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

function MarqueeView({
  scrollRef,
  onTouchStart,
  onTouchEnd,
  wantItems,
  bookedItems,
  seenItems,
  counts,
  paletteSlices,
  paletteTotalCards,
  navigate,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  wantItems: WatchlistItem[]
  bookedItems: WatchlistItem[]
  seenItems: WatchlistItem[]
  counts: Record<WatchlistStatus, number>
  paletteSlices: import('../lib/types').SpectrumSlice[]
  paletteTotalCards: number
  navigate: ReturnType<typeof useNavigate>
}) {
  const venueCount = new Set(seenItems.map(i => i.event?.venue_id).filter(Boolean)).size
  const reflectionCount = seenItems.filter(i => i.reflection).length
  const usheredCount = 0

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ padding: '18px 20px 0' }}
    >
      <div className="flex flex-col" style={{ gap: 14 }}>
        {/* Want to See card */}
        <div
          style={{
            border: '1px solid #2b2720',
            borderRadius: 3,
            background: '#141109',
            padding: '16px 16px 14px',
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink, #ebe5d6)',
              }}
            >
              Want to See
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'oklch(0.80 0.14 55)',
              }}
            >
              {counts.want_to_see}
            </span>
          </div>
          {wantItems.length === 0 ? (
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: '#9c9586', fontStyle: 'italic' }}>
              Nothing on the list yet.
            </p>
          ) : (
            <div className="flex" style={{ gap: 8 }}>
              {wantItems.slice(0, 3).map(item => (
                <PosterThumb
                  key={item.id}
                  item={item}
                  onClick={() => item.event && navigate(`/app/production/${item.event_id}`)}
                />
              ))}
              {wantItems.length > 3 && (
                <div
                  style={{
                    flex: 1,
                    height: 84,
                    border: '1px dashed #2b2720',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 11,
                      color: '#4f4a3e',
                    }}
                  >
                    +{wantItems.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tickets Booked card */}
        <div
          style={{
            border: '1px solid oklch(0.42 0.09 55)',
            borderRadius: 3,
            background: 'linear-gradient(180deg, oklch(0.18 0.04 55), #141109)',
            padding: '16px 16px 14px',
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink, #ebe5d6)',
              }}
            >
              Tickets Booked
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'oklch(0.80 0.14 55)',
              }}
            >
              {counts.booked}
            </span>
          </div>
          {bookedItems.length === 0 ? (
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: '#9c9586', fontStyle: 'italic' }}>
              Nothing here yet.
            </p>
          ) : (
            <div>
              {bookedItems.map((item, i) => (
                <BookingRow key={item.id} item={item} isNext={i === 0} navigate={navigate} isLast={i === bookedItems.length - 1} />
              ))}
            </div>
          )}
        </div>

        {/* Seen card */}
        <div
          style={{
            border: '1px solid #2b2720',
            borderRadius: 3,
            background: '#141109',
            padding: '16px 16px 14px',
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink, #ebe5d6)',
              }}
            >
              Seen
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'oklch(0.80 0.14 55)',
              }}
            >
              {counts.seen}
            </span>
          </div>

          {counts.seen === 0 ? (
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: '#9c9586', fontStyle: 'italic', marginTop: 8 }}>
              Your record starts whenever you say it does.
            </p>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: '#625b4c',
                  marginBottom: 12,
                }}
              >
                {venueCount} VENUE{venueCount !== 1 ? 'S' : ''} · {reflectionCount} REFLECTION{reflectionCount !== 1 ? 'S' : ''} · {usheredCount} USHERED
              </div>
              {paletteSlices.length > 0 && (
                <>
                  <div
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      color: '#625b4c',
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
                      color: '#9c9586',
                      lineHeight: 1.45,
                      marginTop: 8,
                    }}
                  >
                    {personalInsight(paletteSlices)}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ height: 20 }} />
    </div>
  )
}

function PosterThumb({ item, onClick }: { item: WatchlistItem; onClick: () => void }) {
  const event = item.event
  const photoUrl = event?.photo_url || event?.venue?.photo_url
  const firstGenre = event?.genre_tags?.[0]
  const hue = firstGenre ? genreHue(firstGenre) : null

  return (
    <button
      onClick={onClick}
      style={{
        width: 62,
        height: 84,
        borderRadius: 2,
        border: '1px solid #2b2720',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        padding: 0,
        background: '#0c0a05',
        flexShrink: 0,
      }}
    >
      {hue !== null && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: `oklch(0.65 0.15 ${hue})`,
          }}
        />
      )}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={event?.title ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="flex items-center justify-center"
          style={{ width: '100%', height: '100%', paddingLeft: hue !== null ? 4 : 0 }}
        >
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 10,
              color: '#625b4c',
              textAlign: 'center',
              padding: 4,
              lineHeight: 1.2,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {event?.title}
          </span>
        </div>
      )}
    </button>
  )
}

function BookingRow({
  item,
  isNext,
  navigate,
  isLast,
}: {
  item: WatchlistItem
  isNext: boolean
  navigate: ReturnType<typeof useNavigate>
  isLast: boolean
}) {
  const event = item.event
  if (!event) return null

  const venue = event.venue
  const perfDate = item.performance_at
    ? new Date(item.performance_at)
    : null
  const dayLabel = perfDate
    ? perfDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3)
    : null
  const timeLabel = perfDate
    ? perfDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '')
    : null

  const borderColor = isNext ? 'oklch(0.80 0.14 55)' : '#2b2720'
  const textColor = isNext ? 'oklch(0.80 0.14 55)' : '#9c9586'

  return (
    <div>
      <div
        className="flex items-center gap-3"
        style={{ padding: '6px 0', cursor: 'pointer' }}
        onClick={() => navigate(`/app/production/${item.event_id}`)}
      >
        {dayLabel && timeLabel ? (
          <div
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 2,
              padding: '5px 7px',
              textAlign: 'center',
              minWidth: 42,
            }}
          >
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.1em',
                color: textColor,
                lineHeight: 1.3,
              }}
            >
              {dayLabel}
            </div>
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.1em',
                color: textColor,
                lineHeight: 1.3,
              }}
            >
              {timeLabel}
            </div>
          </div>
        ) : (
          <div style={{ minWidth: 42 }} />
        )}
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 17,
              color: 'var(--ink, #ebe5d6)',
              lineHeight: 1.2,
            }}
          >
            {event.title}
          </span>
          {venue && (
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                color: '#9c9586',
                marginTop: 2,
              }}
            >
              {venue.name?.toUpperCase()}{item.seat_note ? ` · ${item.seat_note.toUpperCase()}` : ''}
            </div>
          )}
        </div>
      </div>
      {!isLast && <div style={{ borderTop: '1px dotted #2b2720', margin: '2px 0' }} />}
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
