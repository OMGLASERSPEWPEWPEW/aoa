import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Venue, Event } from '../lib/types'

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
const mono = { fontFamily: "'Courier Prime', monospace" } as const

interface Props {
  venue: Venue
  tonightEvents: Event[]
  visitCount: number
  lastVisitDate: string | null
  allVenues: Venue[]
  allEvents: Event[]
  onClose: () => void
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const [, m, day] = d.split('-')
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m)]} ${parseInt(day)}`
}

export function VenueSheet({ venue, tonightEvents, visitCount, lastVisitDate, allVenues, allEvents, onClose }: Props) {
  const navigate = useNavigate()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true))
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const touchRef = useRef<{ startY: number; startTime: number; startScroll: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = sheetRef.current
    if (!el) return
    touchRef.current = {
      startY: e.touches[0].clientY,
      startTime: Date.now(),
      startScroll: el.scrollTop,
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const el = sheetRef.current
    const touch = touchRef.current
    if (!el || !touch) return
    touchRef.current = null

    const endY = e.changedTouches[0].clientY
    const delta = endY - touch.startY
    const elapsed = Date.now() - touch.startTime
    const velocity = delta / Math.max(elapsed, 1)

    if (touch.startScroll <= 0 && delta > 0) {
      if (velocity > 0.4 || delta > 100) {
        onClose()
      }
    }
  }, [onClose])

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

  const upcomingEvents = useMemo(() => {
    const tonightIds = new Set(tonightEvents.map(e => e.id))
    return allEvents
      .filter(e => e.venue_id === venue.id && !tonightIds.has(e.id))
      .filter(e => !e.end_date || e.end_date >= today)
      .sort((a, b) => (a.start_date ?? 'z').localeCompare(b.start_date ?? 'z'))
      .slice(0, 5)
  }, [venue, allEvents, tonightEvents, today])

  const isUp = tonightEvents.length > 0

  const historyLine = visitCount > 0
    ? `YOU'VE BEEN ${visitCount} TIME${visitCount !== 1 ? 'S' : ''}${lastVisitDate ? ` · LAST: ${new Date(lastVisitDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}` : ''}`
    : 'NEVER BEEN — GOOD FIRST ONE'

  return (
    <>
      {/* Tap-outside overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1099,
          background: 'rgba(0,0,0,0.15)',
          opacity: entered ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          backgroundColor: 'var(--bg)',
          borderRadius: '16px 16px 0 0',
          borderTop: '1px solid var(--rule)',
          boxShadow: '0 -14px 44px rgba(0,0,0,.75)',
          maxHeight: '75dvh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(.2,.8,.2,1)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Grab handle — large touch target */}
        <div
          className="flex justify-center"
          style={{ padding: '12px 0 8px', cursor: 'grab' }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'var(--rule)' }} />
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          {/* Venue header */}
          <div className="flex gap-3" style={{ marginBottom: 4 }}>
            {venue.photo_url ? (
              <img
                src={venue.photo_url}
                alt={venue.name}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--rule)', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 88, height: 66, borderRadius: 3, border: '1px solid var(--rule)', backgroundColor: 'var(--bg-card)', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ ...serif, fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', margin: '0 0 4px' }}>
                {venue.name}
              </h3>
              <div style={{ ...mono, fontSize: 10, letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>
                {[venue.neighborhood?.toUpperCase(), venue.venue_type?.toUpperCase(), venue.price_range].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div style={{ ...mono, fontSize: 9.5, color: 'var(--ink-ghost)', marginBottom: 14 }}>
            {historyLine}
          </div>

          {/* Tonight status */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 3, padding: '12px 14px', marginBottom: 14 }}>
            <div className="flex items-center gap-2">
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isUp ? 'var(--live)' : 'var(--ink-ghost)' }} />
              <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: isUp ? 'var(--live)' : 'var(--ink-ghost)' }}>
                {isUp ? 'ON STAGE TONIGHT' : 'DARK TONIGHT'}
              </span>
            </div>
            {tonightEvents.map(e => (
              <div key={e.id} style={{ marginTop: 8 }}>
                <button
                  onClick={() => navigate(`/app/show/${e.id}`)}
                  style={{ display: 'block', ...serif, fontStyle: 'italic', fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  {e.title}
                </button>
                {e.ticket_url && /^https?:\/\//i.test(e.ticket_url) && !e.ticket_url.includes('theatreinchicago') && (
                  <a href={e.ticket_url} target="_blank" rel="noopener noreferrer"
                    style={{ ...mono, fontSize: 8.5, letterSpacing: '0.08em', color: 'var(--accent-text)', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>
                    TICKETS →
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* PWYC / Usher */}
          {venue.pay_what_you_can_days && venue.pay_what_you_can_days.length > 0 && (
            <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
              <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 2, backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
                PAY-WHAT-YOU-CAN {venue.pay_what_you_can_days.join(', ').toUpperCase()}
              </span>
              {venue.usher_signup_url && (
                <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 2, border: '1px solid var(--rule)', color: 'var(--ink-dim)' }}>
                  USHER SLOTS OPEN
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {venue.website_url && /^https?:\/\//i.test(venue.website_url) && (
              <a href={venue.website_url} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, height: 44, borderRadius: 3, border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 10, letterSpacing: '0.06em', color: 'var(--ink-dim)', textDecoration: 'none' }}>
                WEBSITE
              </a>
            )}
            {venue.address && (
              <a href={`https://maps.apple.com/?daddr=${encodeURIComponent(venue.address + ', Chicago, IL')}`} target="_blank" rel="noopener noreferrer"
                style={{ width: 56, height: 44, borderRadius: 3, backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, textDecoration: 'none', color: 'var(--accent-on)' }}>
                →
              </a>
            )}
          </div>

          {/* Coming up at this venue */}
          {upcomingEvents.length > 0 && (
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-ghost)', marginBottom: 8 }}>
                COMING UP AT {venue.name.toUpperCase().slice(0, 30)}
              </div>
              {upcomingEvents.map((e, i) => (
                <div key={e.id}>
                  {i > 0 && <div style={{ borderTop: '1px dotted var(--rule)', margin: '6px 0' }} />}
                  <button onClick={() => navigate(`/app/show/${e.id}`)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                    <div style={{ ...serif, fontStyle: 'italic', fontSize: 14, color: 'var(--ink)' }}>{e.title}</div>
                    <div style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', marginTop: 1 }}>
                      {e.start_date ? `${fmtDate(e.start_date)}${e.end_date ? ` – ${fmtDate(e.end_date)}` : '+'}` : 'DATES TBD'}
                      {e.price_min != null ? ` · $${e.price_min}${e.price_max && e.price_max !== e.price_min ? `–$${e.price_max}` : ''}` : ''}
                    </div>
                  </button>
                  {e.ticket_url && /^https?:\/\//i.test(e.ticket_url) && !e.ticket_url.includes('theatreinchicago') && (
                    <a href={e.ticket_url} target="_blank" rel="noopener noreferrer"
                      style={{ ...mono, fontSize: 8, letterSpacing: '0.08em', color: 'var(--accent-text)', textDecoration: 'none', display: 'inline-block', marginTop: 1 }}>
                      TICKETS →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nearby venues */}
          {nearbyVenues.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-ghost)', marginBottom: 10 }}>
                ALSO WITHIN A TEN-MINUTE WALK
              </div>
              {nearbyVenues.map((nv, i) => (
                <div key={nv.venue.id}>
                  {i > 0 && <div style={{ borderTop: '1px dotted var(--rule)', margin: '8px 0' }} />}
                  <button
                    onClick={() => nv.currentShow && navigate(`/app/show/${nv.currentShow.id}`)}
                    className="flex items-center justify-between"
                    style={{ width: '100%', background: 'none', border: 'none', cursor: nv.currentShow ? 'pointer' : 'default', padding: 0, textAlign: 'left' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: nv.isUp ? 'var(--live)' : 'var(--ink-ghost)' }}>
                        {nv.isUp ? 'UP' : 'DARK'}
                      </span>
                      <span style={{ ...serif, fontStyle: 'italic', fontSize: 15, color: 'var(--ink)' }}>
                        {nv.currentShow?.title ?? 'No show listed'}
                      </span>
                    </div>
                    <span style={{ ...mono, fontSize: 9.5, color: 'var(--ink-faint)', flexShrink: 0, marginLeft: 8 }}>
                      {nv.venue.name}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
