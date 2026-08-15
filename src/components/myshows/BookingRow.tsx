import type { WatchlistItem } from '../../lib/types'

interface Props {
  item: WatchlistItem
  isNext: boolean
  isLast: boolean
  onNavigate: () => void
}

export function BookingRow({ item, isNext, isLast, onNavigate }: Props) {
  const event = item.event
  if (!event) return null

  const venue = event.venue
  const perfDate = item.performance_at
    ? new Date(item.performance_at)
    : null
  const dayLabel = perfDate
    ? perfDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3)
    : null
  const timeLabel = perfDate
    ? perfDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '')
    : null

  const borderColor = isNext ? 'var(--accent)' : 'var(--rule)'
  const textColor = isNext ? 'var(--accent)' : 'var(--ink-dim)'

  return (
    <div>
      <div
        className="flex items-center gap-3"
        style={{ padding: '6px 0', cursor: 'pointer' }}
        onClick={onNavigate}
      >
        {dayLabel && timeLabel ? (
          <div
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 2,
              padding: '5px 7px',
              textAlign: 'center',
              minWidth: 42,
            }}
          >
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.1em',
                color: textColor,
                lineHeight: 1.3,
              }}
            >
              {dayLabel}
            </div>
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.1em',
                color: textColor,
                lineHeight: 1.3,
              }}
            >
              {timeLabel}
            </div>
          </div>
        ) : (
          <div style={{ minWidth: 42 }} />
        )}
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 17,
              color: 'var(--ink)',
              lineHeight: 1.2,
            }}
          >
            {event.title}
          </span>
          {venue && (
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                color: 'var(--ink-dim)',
                marginTop: 2,
              }}
            >
              {venue.name?.toUpperCase()}{item.seat_note ? ` · ${item.seat_note.toUpperCase()}` : ''}
            </div>
          )}
        </div>
      </div>
      {!isLast && <div style={{ borderTop: '1px dotted var(--rule)', margin: '2px 0' }} />}
    </div>
  )
}
