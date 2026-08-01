import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Venue, Event } from '../lib/types'

interface PeekCounts {
  tonight: number
  under20: number
  pwyc: number
}

interface Props {
  venue: Venue | null
  tonightEvents: Event[]
  visitCount: number
  lastVisitDate: string | null
  allVenues: Venue[]
  allEvents: Event[]
  peekCounts: PeekCounts
  onClose: () => void
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function VenueSheet({ venue, tonightEvents, visitCount, lastVisitDate, allVenues, allEvents, peekCounts, onClose }: Props) {
  const navigate = useNavigate()
  const [entered, setEntered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    requestAnimationFrame(() => setEntered(true))
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const nearbyVenues = useMemo(() => {
    if (!venue || venue.latitude == null || venue.longitude == null) return []
    return allVenues
      .filter(v => v.id !== venue.id && v.latitude != null && v.longitude != null)
      .map(v => ({
        venue: v,
        distance: haversineKm(venue.latitude!, venue.longitude!, v.latitude!, v.longitude!),
        isUp: allEvents.some(e =>
          e.venue_id === v.id && e.start_date && e.end_date &&
          e.start_date <= today && e.end_date >= today
        ),
        currentShow: allEvents.find(e =>
          e.venue_id === v.id && e.start_date && e.end_date &&
          e.start_date <= today && e.end_date >= today
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
  }, [venue, allVenues, allEvents, today])

  const sheetBase: React.CSSProperties = {
    position: 'absolute',
    bottom: 79,
    left: 0,
    right: 0,
    zIndex: 1100,
    backgroundColor: '#0c0a05',
    borderRadius: '16px 16px 0 0',
    borderTop: '1px solid #2b2720',
    boxShadow: '0 -14px 44px rgba(0,0,0,.75)',
    transform: entered ? 'translateY(0)' : 'translateY(100%)',
    transition: reducedMotion ? 'none' : 'transform 300ms cubic-bezier(.2,.8,.2,1)',
  }

  if (!venue) {
    return (
      <div style={sheetBase}>
        <div className="flex justify-center" style={{ padding: '10px 0 6px' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: '#2b2720' }} />
        </div>
        <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 19,
              color: 'var(--ink)',
              marginBottom: 6,
            }}
          >
            {peekCounts.tonight} curtain{peekCounts.tonight !== 1 ? 's' : ''} up within three miles
          </div>
          <div
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: '#625b4c',
            }}
          >
            TAP A THEATER · {peekCounts.under20} UNDER $20 · {peekCounts.pwyc} PAY-WHAT-YOU-CAN
          </div>
        </div>
      </div>
    )
  }

  const isUp = tonightEvents.length > 0

  const historyLine = visitCount > 0
    ? `YOU'VE BEEN ${visitCount} TIME${visitCount !== 1 ? 'S' : ''}${lastVisitDate ? ` · LAST: ${new Date(lastVisitDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}` : ''}`
    : 'NEVER BEEN — GOOD FIRST ONE'

  return (
    <div style={{ ...sheetBase, maxHeight: '60vh', overflowY: 'auto' }}>
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
        <div className="flex gap-3" style={{ marginBottom: 4 }}>
          {venue.photo_url ? (
            <img
              src={venue.photo_url}
              alt={venue.name}
              style={{
                width: 88,
                height: 66,
                objectFit: 'cover',
                borderRadius: 3,
                border: '1px solid #2b2720',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 66,
                borderRadius: 3,
                border: '1px solid #2b2720',
                backgroundColor: '#141109',
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
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
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.06em',
                color: '#625b4c',
              }}
            >
              {[
                venue.neighborhood?.toUpperCase(),
                venue.venue_type?.toUpperCase(),
                venue.price_range,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9.5,
            color: '#4f4a3e',
            marginBottom: 14,
          }}
        >
          {historyLine}
        </div>

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

        {venue.pay_what_you_can_days && venue.pay_what_you_can_days.length > 0 && (
          <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9.5,
                letterSpacing: '0.06em',
                padding: '4px 10px',
                borderRadius: 2,
                backgroundColor: 'oklch(0.20 0.04 55)',
                border: '1px solid oklch(0.42 0.09 55)',
                color: 'oklch(0.80 0.14 55)',
              }}
            >
              PAY-WHAT-YOU-CAN {venue.pay_what_you_can_days.join(', ').toUpperCase()}
            </span>
            {venue.usher_signup_url && (
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 9.5,
                  letterSpacing: '0.06em',
                  padding: '4px 10px',
                  borderRadius: 2,
                  border: '1px solid #2b2720',
                  color: '#9c9586',
                }}
              >
                USHER SLOTS OPEN
              </span>
            )}
          </div>
        )}

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

        {nearbyVenues.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9,
                letterSpacing: '0.1em',
                color: '#4f4a3e',
                marginBottom: 10,
              }}
            >
              ALSO WITHIN A TEN-MINUTE WALK
            </div>
            {nearbyVenues.map((nv, i) => (
              <div key={nv.venue.id}>
                {i > 0 && <div style={{ borderTop: '1px dotted #2b2720', margin: '8px 0' }} />}
                <button
                  onClick={() => nv.currentShow && navigate(`/app/show/${nv.currentShow.id}`)}
                  className="flex items-center justify-between"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: nv.currentShow ? 'pointer' : 'default',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        color: nv.isUp ? 'oklch(0.74 0.16 145)' : '#4f4a3e',
                      }}
                    >
                      {nv.isUp ? 'UP' : 'DARK'}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Newsreader', Georgia, serif",
                        fontStyle: 'italic',
                        fontSize: 15,
                        color: 'var(--ink)',
                      }}
                    >
                      {nv.currentShow?.title ?? 'No show listed'}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9.5,
                      color: '#625b4c',
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {nv.venue.name}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
