import { useNavigate } from 'react-router-dom'
import { useEvents } from '../hooks/useEvents'
import { usePlays } from '../hooks/usePlays'
import { useWatchlist } from '../hooks/useWatchlist'
import { useDiscoverFilters } from '../hooks/useDiscoverFilters'
import { EMOTIONS, base } from '../lib/emotions'
import { EventCard } from '../components/EventCard'
import { SceneNews } from '../components/SceneNews'
import { SearchBar } from '../components/discover/SearchBar'
import { FilterChips } from '../components/discover/FilterChips'
import { PlaySearchResults } from '../components/discover/PlaySearchResults'

const EVENT_TYPES = ['all', 'show', 'class', 'workshop', 'festival'] as const
const VENUE_TYPES = ['all', 'storefront', 'institutional', 'experimental'] as const

export function Discover() {
  const { events, loading } = useEvents()
  const { plays, loading: playsLoading } = usePlays()
  const { addToWatchlist, removeFromWatchlist, getStatus } = useWatchlist()
  const navigate = useNavigate()

  const {
    search, setSearch,
    typeFilter, setTypeFilter,
    venueTypeFilter, setVenueTypeFilter,
    emotionMatchIds, matchedEmotion,
    getTextTokens, EMOTION_SLUGS,
  } = useDiscoverFilters()

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.event_type !== typeFilter) return false
    if (venueTypeFilter !== 'all' && e.venue?.venue_type !== venueTypeFilter) return false
    if (search) {
      const nonEmotionTokens = getTextTokens()
      const textMatch = nonEmotionTokens.length === 0 || nonEmotionTokens.every(q =>
        e.title.toLowerCase().includes(q) ||
        e.venue?.name?.toLowerCase().includes(q) ||
        e.venue?.neighborhood?.toLowerCase().includes(q) ||
        e.genre_tags.some(t => t.toLowerCase().includes(q)) ||
        e.play?.title.toLowerCase().includes(q) ||
        e.play?.playwright.toLowerCase().includes(q)
      )
      const emotionMatch = matchedEmotion ? emotionMatchIds.has(e.id) : true
      return textMatch && emotionMatch
    }
    return true
  })

  const filteredPlays = search
    ? plays.filter(p => {
        const tokens = search.toLowerCase().split(/\s+/).filter(t => !EMOTION_SLUGS.has(t))
        if (tokens.length === 0) return false
        return tokens.every(t =>
          p.title.toLowerCase().includes(t) ||
          p.playwright.toLowerCase().includes(t)
        )
      })
    : []

  function handleWatchlistToggle(eventId: string) {
    const status = getStatus(eventId)
    if (status) {
      removeFromWatchlist(eventId)
    } else {
      addToWatchlist(eventId)
    }
  }

  if (loading && playsLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: 12, borderBottom: '1px solid var(--rule)' }}>
        <SearchBar value={search} onChange={setSearch} />
        <FilterChips
          eventTypes={EVENT_TYPES}
          venueTypes={VENUE_TYPES}
          activeEventType={typeFilter}
          activeVenueType={venueTypeFilter}
          onEventTypeChange={setTypeFilter}
          onVenueTypeChange={setVenueTypeFilter}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <SceneNews />
        <div style={{ padding: 12 }}>
          <PlaySearchResults plays={filteredPlays} onPlayClick={id => navigate(`/app/play/${id}`)} />

          {filtered.length === 0 && filteredPlays.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 160, color: 'var(--ink-faint)' }}>
              <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 14 }}>
                {search ? 'No plays or events match your search' : 'No events match your filters'}
              </p>
            </div>
          ) : filtered.length === 0 && filteredPlays.length > 0 ? (
            null
          ) : (
            <>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: 'var(--ink-ghost)', letterSpacing: '0.06em' }}>
                  {filtered.length} EVENT{filtered.length !== 1 ? 'S' : ''}
                </p>
                {matchedEmotion && (
                  <div className="flex items-center gap-1">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: base(EMOTIONS.find(e => e.slug === matchedEmotion)!) }} />
                    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: 'var(--ink-ghost)' }}>
                      {matchedEmotion.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
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
    </div>
  )
}
