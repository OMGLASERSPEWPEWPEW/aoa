import type { Event } from '../lib/types'

interface EventCardProps {
  event: Event
  watchlistStatus: 'want_to_see' | 'booked' | 'seen' | null
  onWatchlistToggle: (eventId: string) => void
  onTap?: (event: Event) => void
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBA'
  const s = new Date(start + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = s.toLocaleDateString('en-US', opts)
  if (!end || start === end) return startStr
  const e = new Date(end + 'T00:00:00')
  if (s.getMonth() === e.getMonth()) return `${startStr}–${e.getDate()}`
  return `${startStr} – ${e.toLocaleDateString('en-US', opts)}`
}

function formatPrice(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Free'
  if (min === 0 && (max === null || max === 0)) return 'Free'
  if (min === max) return `$${min}`
  if (min === 0) return `Free–$${max}`
  return `$${min}–$${max}`
}

export function EventCard({ event, watchlistStatus, onWatchlistToggle, onTap }: EventCardProps) {
  const venue = event.venue

  return (
    <div
      onClick={() => onTap?.(event)}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      style={{
        padding: '14px 0',
        borderBottom: '1px solid #2b2720',
        cursor: onTap ? 'pointer' : undefined,
      }}
    >
      <div className="flex justify-between items-start gap-3">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 16,
              color: 'var(--ink)',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {event.title}
          </h3>
          {venue && (
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.06em',
                color: '#625b4c',
                marginTop: 3,
              }}
            >
              {venue.name?.toUpperCase()}
              {venue.neighborhood && <span style={{ color: '#4f4a3e' }}> · {venue.neighborhood.toUpperCase()}</span>}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onWatchlistToggle(event.id) }}
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.06em',
            padding: '4px 8px',
            borderRadius: 2,
            border: watchlistStatus
              ? '1px solid oklch(0.42 0.09 55)'
              : '1px solid #2b2720',
            backgroundColor: watchlistStatus ? 'oklch(0.20 0.04 55)' : 'transparent',
            color: watchlistStatus ? 'oklch(0.80 0.14 55)' : '#625b4c',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {watchlistStatus === 'seen' ? 'SEEN' : watchlistStatus ? '✓' : '+ SAVE'}
        </button>
      </div>

      <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            color: '#4f4a3e',
          }}
        >
          {formatDateRange(event.start_date, event.end_date)}
        </span>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            color: event.price_min === 0 || (event.price_min === null && event.price_max === null)
              ? 'oklch(0.68 0.13 150)' : '#4f4a3e',
          }}
        >
          {formatPrice(event.price_min, event.price_max)}
        </span>
        {event.hottix_available && (
          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: 'oklch(0.68 0.13 150)' }}>
            HOTTIX
          </span>
        )}
      </div>
    </div>
  )
}
