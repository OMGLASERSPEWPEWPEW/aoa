import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEvents } from '../hooks/useEvents'
import { useWatchlist } from '../hooks/useWatchlist'
import { EventCard } from '../components/EventCard'

const EVENT_TYPES = ['all', 'show', 'class', 'workshop', 'festival'] as const
const VENUE_TYPES = ['all', 'storefront', 'institutional', 'experimental'] as const

export function Discover() {
  const { events, loading } = useEvents()
  const { addToWatchlist, removeFromWatchlist, getStatus } = useWatchlist()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [venueTypeFilter, setVenueTypeFilter] = useState<string>('all')

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.event_type !== typeFilter) return false
    if (venueTypeFilter !== 'all' && e.venue?.venue_type !== venueTypeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.title.toLowerCase().includes(q) ||
        e.venue?.name?.toLowerCase().includes(q) ||
        e.venue?.neighborhood?.toLowerCase().includes(q) ||
        e.genre_tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  function handleWatchlistToggle(eventId: string) {
    const status = getStatus(eventId)
    if (status) {
      removeFromWatchlist(eventId)
    } else {
      addToWatchlist(eventId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading events...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: 12, borderBottom: '1px solid #2b2720' }}>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#4f4a3e',
              fontSize: 14,
            }}
          >
            ⌕
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shows, venues, genres..."
            style={{
              width: '100%',
              backgroundColor: '#141109',
              color: 'var(--ink)',
              border: '1px solid #2b2720',
              borderRadius: 3,
              paddingLeft: 34,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              fontFamily: "'Courier Prime', monospace",
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        <div className="flex gap-1.5" style={{ marginTop: 8, overflowX: 'auto' }}>
          {EVENT_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9.5,
                letterSpacing: '0.06em',
                padding: '5px 10px',
                borderRadius: 2,
                border: typeFilter === type ? '1px solid oklch(0.80 0.14 55)' : '1px solid #2b2720',
                backgroundColor: typeFilter === type ? 'oklch(0.20 0.04 55)' : 'transparent',
                color: typeFilter === type ? 'oklch(0.80 0.14 55)' : '#625b4c',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {type === 'all' ? 'All' : type + 's'}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5" style={{ marginTop: 6, overflowX: 'auto' }}>
          {VENUE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setVenueTypeFilter(type)}
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9.5,
                letterSpacing: '0.06em',
                padding: '5px 10px',
                borderRadius: 2,
                border: venueTypeFilter === type ? '1px solid oklch(0.80 0.14 55)' : '1px solid #2b2720',
                backgroundColor: venueTypeFilter === type ? 'oklch(0.20 0.04 55)' : 'transparent',
                color: venueTypeFilter === type ? 'oklch(0.80 0.14 55)' : '#625b4c',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {type === 'all' ? 'All Venues' : type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ height: 160, color: '#625b4c' }}>
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 14 }}>
              No events match your filters
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: '#4f4a3e', marginBottom: 8, letterSpacing: '0.06em' }}>
              {filtered.length} EVENT{filtered.length !== 1 ? 'S' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  watchlistStatus={getStatus(event.id)}
                  onWatchlistToggle={handleWatchlistToggle}
                  onTap={(e) => navigate(`/app/show/${e.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
