import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Play, Event } from '../lib/types'

interface ProductionRow {
  event: Event
  userSeen: boolean
  userSeenDate: string | null
}

export function PlayDetail() {
  const { playId } = useParams<{ playId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [play, setPlay] = useState<Play | null>(null)
  const [productions, setProductions] = useState<ProductionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playId) return
    async function load() {
      const [playRes, eventsRes] = await Promise.all([
        supabase.from('plays').select('*').eq('id', playId!).single(),
        supabase
          .from('events')
          .select('*, venue:venues(*)')
          .eq('play_id', playId!)
          .order('start_date', { ascending: false }),
      ])

      setPlay(playRes.data as Play | null)
      const events = (eventsRes.data as Event[]) ?? []

      let seenEventIds = new Set<string>()
      let seenDates: Record<string, string> = {}
      if (user && events.length > 0) {
        const { data: watchlist } = await supabase
          .from('watchlist')
          .select('event_id, seen_date')
          .eq('user_id', user.id)
          .eq('status', 'seen')
          .in('event_id', events.map(e => e.id))
        for (const w of watchlist ?? []) {
          seenEventIds.add(w.event_id)
          if (w.seen_date) seenDates[w.event_id] = w.seen_date
        }
      }

      setProductions(events.map(event => ({
        event,
        userSeen: seenEventIds.has(event.id),
        userSeenDate: seenDates[event.id] ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [playId, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  if (!play) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Play not found.
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ padding: '20px' }}>
      {/* Title block */}
      <h1
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 28,
          color: 'var(--ink)',
          lineHeight: 1.1,
          margin: '0 0 6px',
        }}
      >
        {play.title}
      </h1>

      <div
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 14,
          color: '#9c9586',
          marginBottom: play.awards.length > 0 || play.year_written ? 6 : 0,
        }}
      >
        {play.playwright}
        {play.year_written && <span style={{ color: '#625b4c' }}> · {play.year_written}</span>}
      </div>

      {play.awards.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 14 }}>
          {play.awards.map(award => (
            <span
              key={award}
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9,
                letterSpacing: '0.06em',
                color: 'oklch(0.80 0.14 55)',
                border: '1px solid oklch(0.42 0.09 55)',
                borderRadius: 2,
                padding: '2px 6px',
                textTransform: 'uppercase',
              }}
            >
              {award}
            </span>
          ))}
        </div>
      )}

      {play.synopsis && (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 15,
            color: '#9c9586',
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          {play.synopsis}
        </p>
      )}

      {/* Productions */}
      <div
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          color: '#625b4c',
          marginBottom: 12,
        }}
      >
        {productions.length} PRODUCTION{productions.length !== 1 ? 'S' : ''} TRACKED
      </div>

      {productions.length === 0 ? (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 14,
            color: '#9c9586',
          }}
        >
          No productions tracked yet.
        </p>
      ) : (
        <div>
          {productions.map((p, i) => {
            const e = p.event
            const isUpcoming = e.end_date && e.end_date >= today
            const year = e.start_date
              ? new Date(e.start_date + 'T00:00:00').getFullYear()
              : null

            return (
              <div key={e.id}>
                {i > 0 && <div style={{ borderTop: '1px dotted #2b2720', margin: '10px 0' }} />}
                <button
                  onClick={() => navigate(`/app/show/${e.id}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      style={{
                        fontFamily: "'Newsreader', Georgia, serif",
                        fontStyle: 'italic',
                        fontSize: 15,
                        color: isUpcoming ? 'oklch(0.80 0.14 55)' : 'var(--ink)',
                      }}
                    >
                      {e.venue?.name ?? 'Unknown venue'}
                    </span>
                    {year && (
                      <span
                        style={{
                          fontFamily: "'Courier Prime', monospace",
                          fontSize: 10,
                          color: '#4f4a3e',
                        }}
                      >
                        {year}
                      </span>
                    )}
                  </div>

                  {p.userSeen && (
                    <div
                      style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 9,
                        letterSpacing: '0.06em',
                        color: 'oklch(0.80 0.14 55)',
                        marginTop: 3,
                      }}
                    >
                      YOU SAW THIS
                      {e.venue?.name ? ` AT ${e.venue.name.toUpperCase()}` : ''}
                      {p.userSeenDate ? ` IN ${new Date(p.userSeenDate + 'T00:00:00').getFullYear()}` : ''}
                    </div>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
