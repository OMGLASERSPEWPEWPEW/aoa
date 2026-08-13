import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePlayInterest } from '../hooks/usePlayInterest'
import { SpectrumBar } from '../components/SpectrumBar'
import { InterpretationSentence } from '../components/InterpretationSentence'
import { EmotionDots } from '../components/EmotionDots'
import type { Play, Event, SpectrumSlice } from '../lib/types'

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
  const [spectrum, setSpectrum] = useState<SpectrumSlice[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [loading, setLoading] = useState(true)
  const interest = usePlayInterest(playId)

  useEffect(() => {
    if (!playId) return
    async function load() {
      const [playRes, eventsRes, specRes] = await Promise.all([
        supabase.from('plays').select('*').eq('id', playId!).single(),
        supabase
          .from('events')
          .select('*, venue:venues(*)')
          .eq('play_id', playId!)
          .order('start_date', { ascending: false }),
        supabase
          .from('play_emotion_counts')
          .select('emotion, weight')
          .eq('play_id', playId!),
      ])

      setPlay(playRes.data as Play | null)
      const events = (eventsRes.data as Event[]) ?? []

      if (specRes.data) {
        const totalWeight = (specRes.data as { emotion: string; weight: number }[])
          .reduce((sum, r) => sum + r.weight, 0)
        setSpectrum(
          (specRes.data as { emotion: string; weight: number }[])
            .map(r => ({
              emotion: r.emotion as SpectrumSlice['emotion'],
              pct: totalWeight > 0 ? Math.round((r.weight / totalWeight) * 100) : 0,
            }))
            .sort((a, b) => b.pct - a.pct)
        )
        setTotalCards(Math.round(totalWeight))
      }

      let seenEventIds = new Set<string>()
      let seenDates: Record<string, string> = {}
      if (user && events.length > 0) {
        const { data: watchlist } = await supabase
          .from('watchlist_items')
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
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  if (!play) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Play not found.
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const isStaged = productions.length > 0
  const upcomingProduction = productions.find(p => p.event.end_date && p.event.end_date >= today)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Chrome row */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink)',
          }}
        >
          ←
        </button>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 10,
            letterSpacing: '0.14em', color: 'var(--ink-faint)',
          }}
        >
          THE PLAY
        </span>
        <span style={{ width: 12 }} />
      </div>

      {/* Title block */}
      <div style={{ padding: '14px 20px 14px' }}>
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
            fontSize: 31, fontWeight: 400, lineHeight: 1.04,
            color: 'var(--ink)', margin: '0 0 4px',
          }}
        >
          {play.title}
        </h1>

        <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 15, color: 'var(--ink-dim)' }}>
          {play.playwright}
          {play.year_written && <span style={{ color: 'var(--ink-faint)' }}> · {play.year_written}</span>}
        </div>

        {/* Premise quote */}
        {play.synopsis && (
          <div
            style={{
              borderLeft: '3px solid var(--accent-border)',
              paddingLeft: 12, marginTop: 12,
            }}
          >
            <p
              style={{
                fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                fontSize: 15.5, lineHeight: 1.45, color: 'var(--ink)', margin: 0,
              }}
            >
              {play.synopsis}
            </p>
          </div>
        )}

        {/* Award chips */}
        {play.awards.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            {play.awards.map(award => (
              <span
                key={award}
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 9,
                  letterSpacing: '0.06em', color: 'var(--accent)',
                  border: '1px solid var(--accent-border)', borderRadius: 2,
                  padding: '2px 6px', textTransform: 'uppercase',
                }}
              >
                {award}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex" style={{ padding: '0 20px 14px', gap: 9 }}>
        <button
          onClick={interest.toggle}
          style={{
            flex: 1, height: 48, borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 16,
            ...(interest.isWaiting
              ? {
                  color: 'var(--accent-text)',
                  backgroundColor: 'var(--accent-bg)',
                  border: '1.5px solid var(--accent)',
                }
              : {
                  color: 'var(--accent-on)',
                  backgroundColor: 'var(--accent)',
                }),
          }}
        >
          {interest.isWaiting ? 'You\'re waiting ✓' : 'Want to see it'}
        </button>
        <button
          onClick={() => {
            if (upcomingProduction) {
              navigate(`/app/log/${upcomingProduction.event.id}`)
            }
          }}
          style={{
            width: 104, height: 48, borderRadius: 3, cursor: 'pointer',
            fontFamily: "'Courier Prime', monospace", fontSize: 10,
            color: 'var(--ink-dim)', backgroundColor: 'transparent',
            border: '1px solid var(--rule)',
          }}
        >
          I'VE SEEN IT
        </button>
      </div>

      {/* WAITING IN CHICAGO */}
      <div
        style={{
          margin: '0 20px 14px', padding: '14px 15px',
          border: '1px solid var(--accent-border)',
          backgroundColor: 'var(--accent-bg)', borderRadius: 3,
        }}
      >
        <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
              letterSpacing: '0.18em', color: 'var(--accent-text)',
            }}
          >
            WAITING IN CHICAGO
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
              color: 'var(--accent-text)',
            }}
          >
            {interest.waitingCount}
          </span>
        </div>

        {/* 8-bar trend (unstaged state) */}
        {!isStaged && interest.trend.length > 0 && (
          <WaitingTrend trend={interest.trend} />
        )}

        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif", fontSize: 14.5,
            lineHeight: 1.45, color: 'var(--ink-dim)', margin: 0,
          }}
        >
          {interest.waitingCount === 0
            ? 'Be the first to say you want this one.'
            : isStaged
              ? 'Someone announced it — see below.'
              : `${interest.waitingCount} ${interest.waitingCount === 1 ? 'person' : 'people'} in Chicago ${interest.waitingCount === 1 ? 'wants' : 'want'} this.`}
        </p>

        {isStaged && upcomingProduction && (
          <div
            className="flex items-center gap-2"
            style={{
              borderTop: '1px dotted var(--rule)', marginTop: 10, paddingTop: 10,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--live)' }} />
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                letterSpacing: '0.08em', color: 'var(--accent-text)',
              }}
            >
              SOMEONE ANNOUNCED IT — SEE BELOW
            </span>
          </div>
        )}
      </div>

      {/* EVERY ROOM, EVERY PRODUCTION — spectrum */}
      {spectrum.length > 0 && (
        <div
          style={{
            padding: '14px 20px', backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
            marginBottom: 14,
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                letterSpacing: '0.18em', color: 'var(--ink-faint)',
              }}
            >
              {isStaged ? 'EVERY ROOM, EVERY PRODUCTION' : 'EVERY ROOM, EVERYWHERE'}
            </span>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                color: 'var(--ink-ghost)',
              }}
            >
              {totalCards} CARDS
            </span>
          </div>
          <SpectrumBar slices={spectrum} height={11} totalCards={totalCards} />
          <div style={{ marginTop: 8 }}>
            <InterpretationSentence slices={spectrum} totalCards={totalCards} />
          </div>
        </div>
      )}

      {/* Productions list (staged) OR "Until somebody stages it" (unstaged) */}
      {isStaged ? (
        <div style={{ padding: '0 20px 14px' }}>
          {upcomingProduction && (
            <div style={{ marginBottom: 14 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--live)' }} />
                <span
                  style={{
                    fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                    letterSpacing: '0.12em', color: 'var(--ink-faint)',
                  }}
                >
                  JUST ANNOUNCED · CHICAGO
                </span>
              </div>
              <button
                onClick={() => navigate(`/app/show/${upcomingProduction.event.id}`)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                    fontSize: 19, color: 'var(--ink)',
                  }}
                >
                  {upcomingProduction.event.venue?.name ?? 'Unknown venue'}
                </div>
                <div
                  style={{
                    fontFamily: "'Courier Prime', monospace", fontSize: 10,
                    color: 'var(--accent-text)', marginTop: 2,
                  }}
                >
                  {upcomingProduction.event.start_date && upcomingProduction.event.end_date
                    ? `${formatDate(upcomingProduction.event.start_date)} – ${formatDate(upcomingProduction.event.end_date)}`
                    : 'Dates TBA'}
                </div>
                {upcomingProduction.event.cast_members && upcomingProduction.event.cast_members.length > 0 && (
                  <div
                    style={{
                      fontFamily: "'Newsreader', Georgia, serif", fontSize: 14,
                      color: 'var(--ink-dim)', marginTop: 4,
                    }}
                  >
                    {upcomingProduction.event.cast_members
                      .filter(c => c.role?.toLowerCase() === 'director')
                      .map(c => `directed by ${c.name}`)
                      .join(', ') || 'casting not announced'}
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Past productions */}
          {productions
            .filter(p => p !== upcomingProduction)
            .slice(0, 2)
            .map((p, i) => {
              const e = p.event
              const year = e.start_date ? new Date(e.start_date + 'T00:00:00').getFullYear() : null
              return (
                <div key={e.id}>
                  {(i > 0 || upcomingProduction) && (
                    <div style={{ borderTop: '1px dotted var(--rule)', margin: '10px 0' }} />
                  )}
                  <button
                    onClick={() => navigate(`/app/show/${e.id}`)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span
                        style={{
                          fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                          fontSize: 15, color: 'var(--ink)',
                        }}
                      >
                        {e.venue?.name ?? 'Unknown venue'}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Courier Prime', monospace", fontSize: 10,
                          color: 'var(--ink-ghost)',
                        }}
                      >
                        {year}
                      </span>
                    </div>
                    {p.userSeen && (
                      <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
                        <span
                          style={{
                            fontFamily: "'Courier Prime', monospace", fontSize: 9,
                            letterSpacing: '0.06em', color: 'var(--ink-ghost)',
                          }}
                        >
                          YOU SAW THIS
                        </span>
                        {p.userSeenDate && (
                          <EmotionDots emotions={[]} size={8} />
                        )}
                      </div>
                    )}
                  </button>
                </div>
              )
            })}

          {productions.length > 3 && (
            <div
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 10,
                color: 'var(--ink-ghost)', marginTop: 14, textAlign: 'right',
              }}
            >
              ALL {productions.length} PRODUCTIONS →
            </div>
          )}
        </div>
      ) : (
        /* UNTIL SOMEBODY STAGES IT */
        <div style={{ padding: '0 20px 14px' }}>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
              letterSpacing: '0.18em', color: 'var(--ink-faint)',
              display: 'block', marginBottom: 12,
            }}
          >
            UNTIL SOMEBODY STAGES IT
          </span>
          <div style={{ borderTop: '1px dotted var(--rule)' }}>
            <div style={{ padding: '12px 0' }}>
              <p
                style={{
                  fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                  fontSize: 15, color: 'var(--ink)', margin: '0 0 4px',
                }}
              >
                Read it. It's ninety pages.
              </p>
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                  letterSpacing: '0.08em', color: 'var(--access)',
                }}
              >
                AT THE HAROLD WASHINGTON LIBRARY · FREE
              </span>
            </div>
          </div>
          <div style={{ borderTop: '1px dotted var(--rule)', padding: '12px 0' }}>
            <p
              style={{
                fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                fontSize: 15, color: 'var(--ink)', margin: '0 0 4px',
              }}
            >
              Something adjacent might be on.
            </p>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                color: 'var(--ink-ghost)',
              }}
            >
              CHECK WHAT'S PLAYING →
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function WaitingTrend({ trend }: { trend: { month: string; added: number }[] }) {
  const last8 = trend.slice(-8)
  const max = Math.max(...last8.map(t => t.added), 1)

  return (
    <div className="flex items-end" style={{ gap: 3, height: 34, marginBottom: 10 }}>
      {last8.map((t, i) => {
        const pct = (t.added / max) * 100
        const progress = i / Math.max(last8.length - 1, 1)
        return (
          <div
            key={t.month}
            style={{
              flex: 1,
              height: `${Math.max(pct, 4)}%`,
              borderRadius: 1,
              backgroundColor: `oklch(${0.80 + progress * 0.12} ${0.06 + progress * 0.08} 55)`,
            }}
          />
        )
      })}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
