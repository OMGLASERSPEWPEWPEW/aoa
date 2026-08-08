import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEvents } from '../hooks/useEvents'
import { usePlays } from '../hooks/usePlays'
import { useWatchlist } from '../hooks/useWatchlist'
import { EMOTIONS, base } from '../lib/emotions'
import type { Emotion } from '../lib/emotions'
import type { Play } from '../lib/types'
import { EventCard } from '../components/EventCard'
import { SceneNews } from '../components/SceneNews'

const EVENT_TYPES = ['all', 'show', 'class', 'workshop', 'festival'] as const
const VENUE_TYPES = ['all', 'storefront', 'institutional', 'experimental'] as const

const EMOTION_SLUGS = new Set(EMOTIONS.map(e => e.slug as string))

export function Discover() {
  const { events, loading } = useEvents()
  const { plays, loading: playsLoading } = usePlays()
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
        e.genre_tags.some(t => t.toLowerCase().includes(q)) ||
        e.play?.title.toLowerCase().includes(q) ||
        e.play?.playwright.toLowerCase().includes(q)
      )
      const emotionMatch = matchedEmotion ? emotionMatchIds.has(e.id) : true
      return textMatch && emotionMatch
    }
    return true
  })

  const filteredPlays: Play[] = search
    ? plays.filter(p => {
        const q = search.toLowerCase()
        const tokens = q.split(/\s+/).filter(t => !EMOTION_SLUGS.has(t))
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
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-ghost)',
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
              backgroundColor: 'var(--bg-card)',
              color: 'var(--ink)',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              paddingLeft: 34,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              fontFamily: "'Courier Prime', monospace",
              fontSize: 16,
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
                border: typeFilter === type ? '1px solid var(--accent)' : '1px solid var(--rule)',
                backgroundColor: typeFilter === type ? 'var(--accent-bg)' : 'transparent',
                color: typeFilter === type ? 'var(--accent)' : 'var(--ink-faint)',
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
                border: venueTypeFilter === type ? '1px solid var(--accent)' : '1px solid var(--rule)',
                backgroundColor: venueTypeFilter === type ? 'var(--accent-bg)' : 'transparent',
                color: venueTypeFilter === type ? 'var(--accent)' : 'var(--ink-faint)',
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
        {filteredPlays.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: 'var(--ink-ghost)', letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>
              {filteredPlays.length} Play{filteredPlays.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredPlays.map(play => (
                <button
                  key={play.id}
                  onClick={() => navigate(`/app/play/${play.id}`)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    width: '100%',
                    textAlign: 'left',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--rule)',
                    borderRadius: 2,
                    padding: '12px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontStyle: 'italic',
                    fontSize: 16,
                    color: 'var(--ink)',
                    lineHeight: 1.3,
                  }}>
                    {play.title}
                  </span>
                  <span style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {play.playwright}{play.year_written ? ` · ${play.year_written}` : ''}
                  </span>
                  {play.synopsis && (
                    <span style={{
                      fontFamily: "'Newsreader', Georgia, serif",
                      fontSize: 12,
                      color: 'var(--ink-ghost)',
                      lineHeight: 1.4,
                      marginTop: 4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {play.synopsis}
                    </span>
                  )}
                  {play.awards.length > 0 && (
                    <span style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9,
                      color: 'var(--accent)',
                      letterSpacing: '0.04em',
                      marginTop: 2,
                    }}>
                      {play.awards[0]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
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
