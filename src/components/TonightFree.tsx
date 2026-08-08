import { useNavigate } from 'react-router-dom'
import { getTonightTimes, formatShowTime } from '../lib/tonight'
import type { Event } from '../lib/types'

interface Props {
  freeEvents: Event[]
  cheapestEvents: Event[]
}

export function TonightFree({ freeEvents, cheapestEvents }: Props) {
  const navigate = useNavigate()
  const hasFree = freeEvents.length > 0
  const items = hasFree ? freeEvents : cheapestEvents.slice(0, 3)

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: hasFree ? 'var(--access)' : 'var(--ink-faint)',
          }}
        >
          {hasFree ? 'FREE TONIGHT' : 'CHEAPEST TONIGHT'}
        </span>
        {hasFree && (
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: 'var(--ink-ghost)',
            }}
          >
            {' — NO CATCH, NO TICKET'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: 'var(--ink-dim)',
            fontStyle: 'italic',
          }}
        >
          Nothing playing tonight — check back tomorrow.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(event => (
            <button
              key={event.id}
              onClick={() => navigate(`/app/show/${event.id}`)}
              style={{
                background: 'none',
                border: 'none',
                textAlign: 'left',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 15,
                  lineHeight: 1.4,
                  color: 'var(--ink-dim)',
                }}
              >
                <span style={{ fontStyle: 'italic', color: 'var(--ink)' }}>{event.title}</span>
                {event.venue?.name && (
                  <span> at {event.venue.name}</span>
                )}
                {(() => {
                  const times = getTonightTimes(event.show_times)
                  return times.length > 0 ? (
                    <span style={{ color: 'var(--ink-faint)' }}> · {times.map(formatShowTime).join(', ')}</span>
                  ) : null
                })()}
                {!hasFree && event.price_min !== null && (
                  <span style={{ color: 'var(--access)' }}> · ${event.price_min}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
