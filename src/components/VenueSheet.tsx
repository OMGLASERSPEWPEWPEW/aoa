import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Venue, Event } from '../lib/types'

interface Props {
  venue: Venue
  tonightEvents: Event[]
  visitCount: number
  onClose: () => void
}

export function VenueSheet({ venue, tonightEvents, visitCount, onClose }: Props) {
  const navigate = useNavigate()
  const isUp = tonightEvents.length > 0
  const [entered, setEntered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    requestAnimationFrame(() => setEntered(true))
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 79,
        left: 0,
        right: 0,
        zIndex: 1100,
        backgroundColor: '#0c0a05',
        borderRadius: '16px 16px 0 0',
        borderTop: '1px solid #2b2720',
        boxShadow: '0 -14px 44px rgba(0,0,0,.75)',
        maxHeight: '60vh',
        overflowY: 'auto',
        transform: entered ? 'translateY(0)' : 'translateY(100%)',
        transition: reducedMotion ? 'none' : 'transform 300ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {/* Grab handle */}
      <div className="flex justify-center" style={{ padding: '10px 0 6px' }}>
        <div
          onClick={onClose}
          style={{
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#2b2720',
            cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        {/* Venue name */}
        <h3
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 22,
            color: 'var(--ink)',
            margin: '0 0 4px',
          }}
        >
          {venue.name}
        </h3>

        {/* Meta line */}
        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: '#625b4c',
            marginBottom: 12,
          }}
        >
          {[
            venue.neighborhood?.toUpperCase(),
            venue.venue_type?.toUpperCase(),
            venue.price_range,
          ].filter(Boolean).join(' • ')}
        </div>

        {/* History line */}
        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9.5,
            color: '#4f4a3e',
            marginBottom: 14,
          }}
        >
          {visitCount > 0
            ? `YOU'VE BEEN ${visitCount} TIME${visitCount !== 1 ? 'S' : ''}`
            : 'NEVER BEEN'}
        </div>

        {/* Tonight panel */}
        <div
          style={{
            backgroundColor: '#141109',
            borderRadius: 3,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isUp ? 'oklch(0.74 0.16 145)' : '#4f4a3e',
              }}
            />
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.08em',
                color: isUp ? 'oklch(0.74 0.16 145)' : '#4f4a3e',
              }}
            >
              {isUp ? 'ON STAGE TONIGHT' : 'DARK TONIGHT'}
            </span>
          </div>
          {tonightEvents.map(e => (
            <button
              key={e.id}
              onClick={() => navigate(`/app/show/${e.id}`)}
              style={{
                display: 'block',
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--ink)',
                marginTop: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
            >
              {e.title}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {venue.website_url && (
            <a
              href={venue.website_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 3,
                border: '1px solid #2b2720',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.06em',
                color: '#9c9586',
                textDecoration: 'none',
              }}
            >
              WEBSITE
            </a>
          )}
          {venue.address && (
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(venue.address + ', Chicago, IL')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 56,
                height: 44,
                borderRadius: 3,
                backgroundColor: 'oklch(0.80 0.14 55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                textDecoration: 'none',
                color: '#0c0a05',
              }}
            >
              →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
