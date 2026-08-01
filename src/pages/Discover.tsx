import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEvents } from '../hooks/useEvents'
import { useWatchlist } from '../hooks/useWatchlist'
import { EMOTIONS, base } from '../lib/emotions'
import type { Emotion } from '../lib/emotions'
import { EventCard } from '../components/EventCard'
import { SceneNews } from '../components/SceneNews'

const EVENT_TYPES = ['all', 'show', 'class', 'workshop', 'festival'] as const
const VENUE_TYPES = ['all', 'storefront', 'institutional', 'experimental'] as const

const EMOTION_SLUGS = new Set(EMOTIONS.map(e => e.slug as string))

export function Discover() {
  const { events, loading } = useEvents()
  const { addToWatchlist, removeFromWatchlist, getStatus } = useWatchlist()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [venueTypeFilter, setVenueTypeFilter] = useState<string>('all')
  const [emotionMatchIds, setEmotionMatchIds] = useState<Set<string>>(new Set())
  const [matchedEmotion, setMatchedEmotion] = useState<Emotion | null>(null)

  useEffect(() => {
    if (!search) {
      setEmotionMatchIds(new Set())
      setMatchedEmotion(null)
      return
    }
    const tokens = search.toLowerCase().split(/\s+/)
    const emotionToken = tokens.find(t => EMOTION_SLUGS.has(t))
    if (!emotionToken) {
      setEmotionMatchIds(new Set())
      setMatchedEmotion(null)
      return
    }
    setMatchedEmotion(emotionToken as Emotion)
    supabase
      .from('event_spectrum')
      .select('event_id')
      .eq('emotion', emotionToken)
      .gte('pct', 25)
      .then(({ data }) => {
        setEmotionMatchIds(new Set((data ?? []).map((r: any) => r.event_id)))
      })
  }, [search])

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.event_type !== typeFilter) return false
    if (venueTypeFilter !== 'all' && e.venue?.venue_type !== venueTypeFilter) return false
    if (search) {
      const nonEmotionTokens = search.toLowerCase().split(/\s+/).filter(t => !EMOTION_SLUGS.has(t))
      const textMatch = nonEmotionTokens.length === 0 || nonEmotionTokens.every(q =>
        e.title.toLowerCase().includes(q) ||
        e.venue?.name?.toLowerCase().includes(q) ||
        e.venue?.neighborhood?.toLowerCase().includes(q) ||
        e.genre_tags.some(t => t.toLowerCase().includes(q))
      )
      const emotionMatch = matchedEmotion ? emotionMatchIds.has(e.id) : true
      return textMatch && emotionMatch
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
            placeholder="A play, a theater, a feeling…"
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

      <div className="flex-1 overflow-y-auto">
        <SceneNews />
        <div style={{ padding: 12 }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ height: 160, color: '#625b4c' }}>
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 14 }}>
              No events match your filters
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: '#4f4a3e', letterSpacing: '0.06em' }}>
                {filtered.length} EVENT{filtered.length !== 1 ? 'S' : ''}
              </p>
              {matchedEmotion && (
                <div className="flex items-center gap-1">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: base(EMOTIONS.find(e => e.slug === matchedEmotion)!) }} />
                  <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: '#4f4a3e' }}>
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
