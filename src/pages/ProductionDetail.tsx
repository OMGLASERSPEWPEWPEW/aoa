import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReviews } from '../hooks/useReviews'
import { useWatchlist } from '../hooks/useWatchlist'
import { SpectrumBar } from '../components/SpectrumBar'
import { InterpretationSentence } from '../components/InterpretationSentence'
import { ReviewBadge } from '../components/ReviewBadge'
import { emotionBySlug } from '../lib/emotions'
import type { Event, SpectrumSlice, HouseRank } from '../lib/types'

export function ProductionDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [spectrum, setSpectrum] = useState<SpectrumSlice[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [loading, setLoading] = useState(true)
  const { reviews, loading: reviewsLoading } = useReviews(eventId ?? '')
  const { addToWatchlist, getStatus } = useWatchlist()

  useEffect(() => {
    if (!eventId) return
    async function load() {
      const [eventRes, specRes] = await Promise.all([
        supabase
          .from('events')
          .select('*, venue:venues(*), play:plays(*)')
          .eq('id', eventId!)
          .single(),
        supabase
          .from('event_emotion_counts')
          .select('*')
          .eq('event_id', eventId!),
      ])
      setEvent(eventRes.data as Event | null)

      if (specRes.data && specRes.data.length > 0) {
        const total = specRes.data.reduce((s: number, r: any) => s + (r.pick_count ?? 0), 0)
        setTotalCards(Math.ceil(total / 3))
        const slices: SpectrumSlice[] = specRes.data
          .map((r: any) => ({
            emotion: r.emotion_slug as SpectrumSlice['emotion'],
            pct: total > 0 ? Math.round((r.pick_count / total) * 100) : 0,
          }))
          .filter((s: SpectrumSlice) => s.pct > 0)
        setSpectrum(slices)
      }
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Show not found.
      </div>
    )
  }

  const venue = event.venue
  const play = event.play
  const status = getStatus(event.id)
  const hasPWYC = venue?.pay_what_you_can_days && venue.pay_what_you_can_days.length > 0

  const dateStr = event.start_date
    ? `${new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${
        event.end_date && event.end_date !== event.start_date
          ? ` – ${new Date(event.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : ''
      }`
    : 'Dates TBA'

  const priceStr =
    event.price_min === null && event.price_max === null
      ? 'Free'
      : event.price_min === 0 && (event.price_max === null || event.price_max === 0)
        ? 'Free'
        : event.price_min === event.price_max
          ? `$${event.price_min}`
          : `$${event.price_min ?? 0}–$${event.price_max}`

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 1. Hero image */}
      <div
        style={{
          height: 196,
          backgroundColor: '#141109',
          backgroundImage: event.photo_url || venue?.photo_url
            ? `url(${event.photo_url || venue?.photo_url})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(transparent, #0c0a05)',
          }}
        />
      </div>

      {/* 2. Title block */}
      <div style={{ padding: '0 20px 16px' }}>
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 31,
            lineHeight: 1.03,
            color: 'var(--ink)',
            marginTop: -8,
            position: 'relative',
          }}
        >
          {event.title}
        </h1>

        {(play?.playwright || play?.title) && (
          <div
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 14,
              color: '#9c9586',
              marginTop: 6,
            }}
          >
            {play?.playwright && <span>{play.playwright}</span>}
            {play?.playwright && play?.title && ' · '}
            {play?.title && <span style={{ fontStyle: 'italic' }}>directed by —</span>}
          </div>
        )}

        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.08em',
            color: '#625b4c',
            marginTop: 6,
          }}
        >
          {dateStr} · {venue?.name ?? 'Venue TBA'}
        </div>

        {hasPWYC && (
          <span
            style={{
              display: 'inline-block',
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.06em',
              color: 'oklch(0.68 0.13 150)',
              border: '1px solid oklch(0.68 0.13 150)',
              borderRadius: 2,
              padding: '2px 6px',
              marginTop: 8,
            }}
          >
            PAY WHAT YOU CAN
          </span>
        )}

        {/* Action buttons */}
        <div className="flex gap-2" style={{ marginTop: 14 }}>
          {!status && (
            <button
              onClick={() => addToWatchlist(event.id)}
              style={{
                height: 46,
                flex: 1,
                borderRadius: 3,
                backgroundColor: 'oklch(0.80 0.14 55)',
                color: '#0c0a05',
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 15,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Want to see
            </button>
          )}
          {status && (
            <button
              onClick={() => navigate(`/app/log/${event.id}`)}
              style={{
                height: 46,
                flex: 1,
                borderRadius: 3,
                backgroundColor: 'oklch(0.80 0.14 55)',
                color: '#0c0a05',
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 15,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Log as seen
            </button>
          )}
          <button
            onClick={() => {
              if (event.ticket_url || venue?.website_url) {
                window.open(event.ticket_url || venue?.website_url || '', '_blank')
              }
            }}
            style={{
              width: 104,
              height: 46,
              borderRadius: 3,
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              fontFamily: "'Courier Prime', monospace",
              fontSize: 12,
              border: '1px solid #2b2720',
              cursor: 'pointer',
            }}
          >
            {priceStr}
          </button>
        </div>
      </div>

      {/* 2b. THE COMPANY — cast/ensemble */}
      {event.cast_members && event.cast_members.length > 0 && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid #2b2720' }}>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: '#625b4c',
            }}
          >
            THE COMPANY
          </span>
          <div className="flex gap-3" style={{ marginTop: 10, overflowX: 'auto' }}>
            {event.cast_members.slice(0, 3).map((member, i) => (
              <div key={i} className="flex flex-col items-center" style={{ minWidth: 56 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: '#2b2720',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#625b4c',
                    fontSize: 20,
                  }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 12.5,
                    color: '#9c9586',
                    marginTop: 6,
                    textAlign: 'center',
                    maxWidth: 70,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {member.name}
                </span>
                {member.role && (
                  <span
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9,
                      color: '#4f4a3e',
                      marginTop: 2,
                    }}
                  >
                    {member.role}
                  </span>
                )}
              </div>
            ))}
            {event.cast_members.length > 3 && (
              <div className="flex items-center" style={{ minWidth: 56 }}>
                <span
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 10.5,
                    color: '#4f4a3e',
                  }}
                >
                  +{event.cast_members.length - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. "The house felt" panel */}
      <div style={{ backgroundColor: '#141109', padding: '16px 20px' }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: '#625b4c',
            }}
          >
            THE HOUSE FELT
          </span>
          {totalCards > 0 && (
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9,
                color: '#4f4a3e',
              }}
            >
              {totalCards} CARD{totalCards !== 1 ? 'S' : ''}
            </span>
          )}
        </div>

        {spectrum.length > 0 ? (
          <>
            <SpectrumBar slices={spectrum} height={11} totalCards={totalCards} />
            <div style={{ marginTop: 8 }}>
              <InterpretationSentence slices={spectrum} totalCards={totalCards} />
            </div>
          </>
        ) : (
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 14,
              color: '#9c9586',
              fontStyle: 'italic',
            }}
          >
            No one's logged this yet. Be the first.
          </p>
        )}
      </div>

      {/* 4. Reviews section */}
      <div style={{ padding: '16px 20px' }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 14 }}>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: '#625b4c',
            }}
          >
            WHAT PEOPLE SAID
          </span>
          <button
            onClick={() => navigate(`/app/log/${event.id}/review`, {
              state: { emotions: [], volume: null, event },
            })}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: 'oklch(0.80 0.14 55)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            WRITE ONE
          </button>
        </div>

        {reviewsLoading ? (
          <p style={{ color: '#625b4c', fontSize: 13 }}>Loading...</p>
        ) : reviews.length === 0 ? (
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 14,
              color: '#9c9586',
              fontStyle: 'italic',
            }}
          >
            No reviews yet.
          </p>
        ) : (
          <div>
            {reviews.map((review, i) => (
              <div key={review.id}>
                {i > 0 && <div style={{ borderTop: '1px dotted #2b2720', margin: '12px 0' }} />}
                {review.contains_spoilers ? (
                  <SpoilerReview review={review} />
                ) : (
                  <ReviewRow review={review} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Play link */}
      {event.play_id && play && (
        <button
          onClick={() => navigate(`/app/play/${event.play_id}`)}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 20px',
            borderTop: '1px solid #2b2720',
            background: 'none',
            border: 'none',
            borderTopStyle: 'solid',
            borderTopWidth: 1,
            borderTopColor: '#2b2720',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.08em',
              color: '#625b4c',
            }}
          >
            THE PLAY:{' '}
            <span style={{ color: 'var(--ink)' }}>{play.title}</span>
            {' →'}
          </span>
        </button>
      )}
    </div>
  )
}

function ReviewRow({ review }: { review: NonNullable<ReturnType<typeof useReviews>['reviews']>[number] }) {
  const rank = (review.profile?.house_rank ?? 0) as HouseRank
  const name = review.profile?.username ?? 'Anonymous'

  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--ink)',
          }}
        >
          {name}
        </span>
        <ReviewBadge rank={rank} />
        {review.emotions && review.emotions.length > 0 && (
          <div className="flex gap-1">
            {review.emotions.map(slug => {
              const def = emotionBySlug(slug)
              return def ? (
                <div
                  key={slug}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: `oklch(${def.l} ${def.c} ${def.h})`,
                  }}
                />
              ) : null
            })}
          </div>
        )}
      </div>
      {review.body && (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: '#9c9586',
            lineHeight: 1.5,
          }}
        >
          {review.body}
        </p>
      )}
    </div>
  )
}

function SpoilerReview({ review }: { review: NonNullable<ReturnType<typeof useReviews>['reviews']>[number] }) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) return <ReviewRow review={review} />

  return (
    <button
      onClick={() => setRevealed(true)}
      style={{
        width: '100%',
        minHeight: 44,
        fontFamily: "'Courier Prime', monospace",
        fontSize: 11,
        color: 'oklch(0.66 0.19 35)',
        backgroundColor: 'oklch(0.20 0.05 35)',
        border: 'none',
        borderRadius: 3,
        padding: '10px 14px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      Contains spoilers — tap to reveal
    </button>
  )
}
