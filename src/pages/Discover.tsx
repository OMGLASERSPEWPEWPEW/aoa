import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEvents } from '../hooks/useEvents'
import { usePlays } from '../hooks/usePlays'
import { useWatchlist } from '../hooks/useWatchlist'
import { EMOTIONS, base, ink } from '../lib/emotions'
import { useTheme } from '../contexts/ThemeContext'
import type { Emotion } from '../lib/emotions'
import type { Play, Event } from '../lib/types'
import { EventCard } from '../components/EventCard'
import { SceneNews } from '../components/SceneNews'

const EMOTION_SLUGS = new Set(EMOTIONS.map(e => e.slug as string))

type FilterChip = 'tonight' | 'under20' | 'storefront' | 'asl'

export function Discover() {
  const { events, loading } = useEvents()
  const { plays, loading: playsLoading } = usePlays()
  const { addToWatchlist, removeFromWatchlist, getStatus } = useWatchlist()
  const { resolved: theme } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<FilterChip>>(new Set())
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
        setEmotionMatchIds(new Set((data ?? []).map((r: { event_id: string }) => r.event_id)))
      })
  }, [search])

  function toggleFilter(chip: FilterChip) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(chip)) next.delete(chip)
      else next.add(chip)
      return next
    })
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = events.filter(e => {
    if (activeFilters.has('tonight') && (!e.end_date || e.end_date < today)) return false
    if (activeFilters.has('under20') && (e.price_min === null || e.price_min > 20)) return false
    if (activeFilters.has('storefront') && e.venue?.venue_type !== 'storefront') return false
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
        const tokens = search.toLowerCase().split(/\s+/).filter(t => !EMOTION_SLUGS.has(t))
        if (tokens.length === 0) return false
        return tokens.every(t =>
          p.title.toLowerCase().includes(t) ||
          p.playwright.toLowerCase().includes(t)
        )
      })
    : []

  const playProductions = new Map<string, Event[]>()
  for (const e of events) {
    if (e.play_id) {
      const list = playProductions.get(e.play_id) ?? []
      list.push(e)
      playProductions.set(e.play_id, list)
    }
  }

  function handleWatchlistToggle(eventId: string) {
    const status = getStatus(eventId)
    if (status) removeFromWatchlist(eventId)
    else addToWatchlist(eventId)
  }

  if (loading && playsLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  const emotionDef = matchedEmotion ? EMOTIONS.find(e => e.slug === matchedEmotion) : null

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute', left: 14, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--ink-faint)', fontSize: 16,
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
              width: '100%', height: 46,
              backgroundColor: 'var(--bg-card)',
              color: 'var(--ink)',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              paddingLeft: 38, paddingRight: 14,
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </div>

        {/* Emotion match banner */}
        {emotionDef && (
          <div
            className="flex items-center gap-2"
            style={{
              marginTop: 8, padding: '6px 10px',
              borderRadius: 14,
              border: `1px solid ${theme === 'dark' ? base(emotionDef) : ink(emotionDef)}`,
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: base(emotionDef) }} />
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                color: theme === 'dark' ? base(emotionDef) : ink(emotionDef),
                letterSpacing: '0.06em',
              }}
            >
              SHOWING {matchedEmotion!.toUpperCase()} PRODUCTIONS
            </span>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-1.5" style={{ marginTop: 8, overflowX: 'auto' }}>
          <FilterButton
            label="TONIGHT"
            active={activeFilters.has('tonight')}
            onClick={() => toggleFilter('tonight')}
            variant="gold"
          />
          <FilterButton
            label="UNDER $20"
            active={activeFilters.has('under20')}
            onClick={() => toggleFilter('under20')}
            variant="access"
          />
          <FilterButton
            label="STOREFRONT"
            active={activeFilters.has('storefront')}
            onClick={() => toggleFilter('storefront')}
          />
          <FilterButton
            label="ASL"
            active={activeFilters.has('asl')}
            onClick={() => toggleFilter('asl')}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <SceneNews />
        <div style={{ padding: '0 20px 20px' }}>

          {/* THE PLAY, NOT THE POSTER */}
          {filteredPlays.length > 0 && (
            <div style={{ marginBottom: 16, marginTop: 14 }}>
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                  letterSpacing: '0.18em', color: 'var(--ink-faint)',
                  display: 'block', marginBottom: 10,
                }}
              >
                THE PLAY, NOT THE POSTER
              </span>
              {filteredPlays.map(play => {
                const prods = playProductions.get(play.id) ?? []
                return (
                  <div
                    key={play.id}
                    style={{
                      border: '1px solid var(--rule)',
                      borderRadius: 3,
                      padding: '14px 16px',
                      marginBottom: 8,
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <button
                      onClick={() => navigate(`/app/play/${play.id}`)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                          fontSize: 20, color: 'var(--ink)', lineHeight: 1.2,
                        }}
                      >
                        {play.title}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Newsreader', Georgia, serif", fontSize: 14,
                          color: 'var(--ink-dim)', marginTop: 2,
                        }}
                      >
                        {play.playwright}
                        {play.awards.length > 0 && ` · ${play.awards[0]}`}
                      </div>
                    </button>

                    {prods.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {prods.slice(0, 3).map((e, i) => {
                          const isUpcoming = e.end_date && e.end_date >= today
                          const year = e.start_date
                            ? new Date(e.start_date + 'T00:00:00').getFullYear()
                            : null
                          return (
                            <div key={e.id}>
                              {i > 0 && <div style={{ borderTop: '1px dotted var(--rule)', margin: '6px 0' }} />}
                              <button
                                onClick={() => navigate(`/app/show/${e.id}`)}
                                style={{
                                  display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'baseline', width: '100%',
                                  background: 'none', border: 'none', padding: 0,
                                  cursor: 'pointer', textAlign: 'left',
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "'Courier Prime', monospace", fontSize: 10,
                                    color: isUpcoming ? 'var(--accent)' : 'var(--ink-faint)',
                                  }}
                                >
                                  {isUpcoming ? (year ?? 'UPCOMING') : (year ?? '—')} · {e.venue?.name?.toUpperCase() ?? 'UNKNOWN'}
                                </span>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Events */}
          {filtered.length === 0 && filteredPlays.length === 0 ? (
            <div className="flex flex-col items-center" style={{ paddingTop: 40 }}>
              <p
                style={{
                  fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                  fontSize: 15, color: 'var(--ink-dim)',
                }}
              >
                Nothing under that name.
              </p>
              <p
                style={{
                  fontFamily: "'Newsreader', Georgia, serif", fontSize: 14,
                  color: 'var(--ink-faint)', marginTop: 4,
                }}
              >
                Try a feeling instead — "gutted", "delighted".
              </p>
            </div>
          ) : filtered.length > 0 && (
            <div style={{ marginTop: filteredPlays.length > 0 ? 0 : 14 }}>
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                  letterSpacing: '0.06em', color: 'var(--ink-ghost)',
                  display: 'block', marginBottom: 8,
                }}
              >
                {filtered.length} EVENT{filtered.length !== 1 ? 'S' : ''}
              </span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterButton({
  label, active, onClick, variant,
}: {
  label: string
  active: boolean
  onClick: () => void
  variant?: 'gold' | 'access'
}) {
  const activeColor = variant === 'access' ? 'var(--access)' : 'var(--accent)'
  const activeBorder = variant === 'access'
    ? '1px solid oklch(0.36 0.07 150)'
    : '1px solid var(--accent)'

  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: 10,
        letterSpacing: '0.06em',
        padding: '6px 11px',
        borderRadius: 14,
        border: active ? activeBorder : '1px solid var(--rule)',
        backgroundColor: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? activeColor : 'var(--ink-faint)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
