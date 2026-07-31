import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import { useWatchlist } from '../hooks/useWatchlist'
import { EventCard } from '../components/EventCard'

const EVENT_TYPES = ['all', 'show', 'class', 'workshop', 'festival'] as const
const VENUE_TYPES = ['all', 'storefront', 'institutional', 'experimental'] as const

export function Discover() {
  const { events, loading } = useEvents()
  const { addToWatchlist, removeFromWatchlist, getStatus } = useWatchlist()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [venueTypeFilter, setVenueTypeFilter] = useState<string>('all')
  const navigate = useNavigate()

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
                onTap={(e) => navigate(`/app/show/${e.id}`)}
              />
            ))}
          </>
        )}
      </div>

    </div>
  )
}
