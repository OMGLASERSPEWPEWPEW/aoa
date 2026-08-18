import { useParams, useNavigate } from 'react-router-dom'
import { useProductionDetail } from '../hooks/useProductionDetail'
import { useReviews } from '../hooks/useReviews'
import { useWatchlist } from '../hooks/useWatchlist'
import { HeroImage } from '../components/production/HeroImage'
import { TitleBlock } from '../components/production/TitleBlock'
import { CastSection } from '../components/production/CastSection'
import { HouseFelt } from '../components/production/HouseFelt'
import { ReviewsSection } from '../components/production/ReviewsSection'

export function ProductionDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { data, isLoading: loading, isError } = useProductionDetail(eventId)
  const { reviews, loading: reviewsLoading } = useReviews(eventId ?? '')
  const { addToWatchlist, getStatus } = useWatchlist()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Unable to load this show. Please try again.
      </div>
    )
  }

  const event = data?.event
  if (!event) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Show not found.
      </div>
    )
  }

  const venue = event.venue
  const play = event.play
  const status = getStatus(event.id)
  const hasPWYC = !!(venue?.pay_what_you_can_days && venue.pay_what_you_can_days.length > 0)

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

  const eventUrl = event.ticket_url && /^https?:\/\//i.test(event.ticket_url) && !event.ticket_url.includes('theatreinchicago')
    ? event.ticket_url
    : event.source_url && /^https?:\/\//i.test(event.source_url)
      ? event.source_url
      : venue?.website_url && /^https?:\/\//i.test(venue.website_url)
        ? venue.website_url
        : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: 'none',
          borderBottom: '1px solid var(--rule)',
          cursor: 'pointer',
          fontFamily: "'Courier Prime', monospace",
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--ink-dim)',
          width: '100%',
          textAlign: 'left',
        }}
      >
        ← BACK
      </button>

      <HeroImage photoUrl={event.photo_url} venuePhotoUrl={venue?.photo_url} />

      <TitleBlock
        event={event}
        venue={venue}
        play={play}
        dateStr={dateStr}
        priceStr={priceStr}
        hasPWYC={hasPWYC}
        watchlistStatus={status}
        eventUrl={eventUrl}
        onWantToSee={() => addToWatchlist(event.id)}
        onLogSeen={() => navigate(`/app/log/${event.id}`)}
        onTickets={() => {
          if (event.ticket_url || venue?.website_url) {
            window.open(event.ticket_url || venue?.website_url || '', '_blank')
          }
        }}
      />

      <CastSection castMembers={event.cast_members} />

      <HouseFelt spectrum={data?.spectrum ?? []} totalCards={data?.totalCards ?? 0} />

      <ReviewsSection
        reviews={reviews}
        reviewsLoading={reviewsLoading}
        onWriteReview={() =>
          navigate(`/app/log/${event.id}/review`, {
            state: { emotions: [], volume: null, event },
          })
        }
      />

      {event.play_id && play && (
        <button
          onClick={() => navigate(`/app/play/${event.play_id}`)}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 20px',
            borderTop: '1px solid var(--rule)',
            background: 'none',
            border: 'none',
            borderTopStyle: 'solid',
            borderTopWidth: 1,
            borderTopColor: 'var(--rule)',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.08em',
              color: 'var(--ink-faint)',
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
