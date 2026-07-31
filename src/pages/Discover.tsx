import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import { useWatchlist } from '../hooks/useWatchlist'
import { EventCard } from '../components/EventCard'
import { ReviewsList } from '../components/ReviewsList'
import { CommunityRating } from '../components/CommunityRating'
import type { Event } from '../lib/types'

const EVENT_TYPES = ['all', 'show', 'class', 'workshop', 'festival'] as const
const VENUE_TYPES = ['all', 'storefront', 'institutional', 'experimental'] as const

export function Discover() {
  const { events, loading } = useEvents()
  const { addToWatchlist, removeFromWatchlist, getStatus } = useWatchlist()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [venueTypeFilter, setVenueTypeFilter] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

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
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading events...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shows, venues, genres..."
            className="w-full bg-slate-800 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {EVENT_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                typeFilter === type
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
            </button>
          ))}
        </div>

        {/* Venue type filter chips */}
        <div className="flex gap-2 mt-1.5 overflow-x-auto">
          {VENUE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setVenueTypeFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                venueTypeFilter === type
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800/50 text-slate-500 hover:text-white border border-slate-700'
              }`}
            >
              {type === 'all' ? 'All Venues' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <SlidersHorizontal size={24} className="mb-2" />
            <p className="text-sm">No events match your filters</p>
          </div>
        ) : (
          <>
            <p className="text-slate-600 text-xs">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</p>
            {filtered.map(event => (
              <EventCard
                key={event.id}
                event={event}
                watchlistStatus={getStatus(event.id)}
                onWatchlistToggle={handleWatchlistToggle}
                onTap={setSelectedEvent}
              />
            ))}
          </>
        )}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          watchlistStatus={getStatus(selectedEvent.id)}
          onWatchlistToggle={() => handleWatchlistToggle(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

function EventDetail({ event, watchlistStatus, onWatchlistToggle, onClose }: {
  event: Event
  watchlistStatus: 'want_to_see' | 'seeing' | 'seen' | null
  onWatchlistToggle: () => void
  onClose: () => void
}) {
  const venue = event.venue

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-white text-lg font-bold">{event.title}</h2>
              {venue && (
                <p className="text-amber-400 text-sm mt-0.5">{venue.name}</p>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1">✕</button>
          </div>

          {event.community_rating && (
            <div className="mb-3">
              <CommunityRating rating={event.community_rating} count={event.rating_count} />
            </div>
          )}

          {event.description && (
            <p className="text-slate-300 text-sm leading-relaxed mb-4">{event.description}</p>
          )}

          <div className="space-y-2 text-sm mb-4">
            {venue?.neighborhood && (
              <p className="text-slate-400">📍 {venue.address ?? venue.neighborhood}</p>
            )}
            {event.start_date && (
              <p className="text-slate-400">📅 {new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {event.end_date && event.end_date !== event.start_date && ` – ${new Date(event.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
              </p>
            )}
            {(event.price_min !== null || event.price_max !== null) && (
              <p className="text-slate-400">🎟️ {event.price_min === event.price_max ? `$${event.price_min}` : `$${event.price_min ?? 0}–$${event.price_max}`}</p>
            )}
            {venue?.venue_type && (
              <p className="text-slate-400">🏛️ {venue.venue_type.charAt(0).toUpperCase() + venue.venue_type.slice(1)} theater</p>
            )}
          </div>

          {event.genre_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {event.genre_tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded-md">{tag}</span>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            {event.ticket_url && (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-4 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                Get Tickets ↗
              </a>
            )}
            <button
              onClick={onWatchlistToggle}
              className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                watchlistStatus
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              {watchlistStatus === 'seen' ? '✓ Seen' : watchlistStatus ? '✓ On Watchlist' : '+ Want to See'}
            </button>
          </div>

          <ReviewsList eventId={event.id} />
        </div>
      </div>
    </div>
  )
}
