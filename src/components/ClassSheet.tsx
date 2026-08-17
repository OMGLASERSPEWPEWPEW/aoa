import { useState, useEffect, useRef, useCallback } from 'react'
import type { SchoolWithSession, ClassSession } from '../lib/types'
import { isEnrolling } from '../lib/classData'
import { DISCIPLINE_COLORS } from './ClassMarker'
import { LevelPips } from './LevelPips'

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
const mono = { fontFamily: "'Courier Prime', monospace" } as const

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtStartDate(d: string | null): string {
  if (!d) return 'LATER'
  const date = new Date(d + 'T00:00:00')
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  return `${month} ${date.getDate()}`
}

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

interface Props {
  school: SchoolWithSession
  allSchools: SchoolWithSession[]
  onClose: () => void
  onSelectSchool: (school: SchoolWithSession) => void
}

export function ClassSheet({ school, allSchools, onClose, onSelectSchool }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)
  const dc = DISCIPLINE_COLORS[school.discipline]
  const session = school.next_session
  const enrolling = isEnrolling(session)

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true))
  }, [])

  // Drag-to-dismiss
  const [dragY, setDragY] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const dragRef = useRef<{ startY: number; isDragging: boolean } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (dismissing) return
    dragRef.current = { startY: e.touches[0].clientY, isDragging: false }
  }, [dismissing])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return
    const dy = e.touches[0].clientY - dragRef.current.startY
    if (dy > 0) {
      dragRef.current.isDragging = true
      setDragY(dy)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!dragRef.current) return
    if (dragY > 80) {
      setDismissing(true)
      setTimeout(onClose, 200)
    } else {
      setDragY(0)
    }
    dragRef.current = null
  }, [dragY, onClose])

  // Nearby schools
  const nearby = allSchools
    .filter(s => s.id !== school.id)
    .map(s => ({
      ...s,
      distance: haversineKm(school.latitude, school.longitude, s.latitude, s.longitude),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2)

  const scrapedDaysAgo = daysSince(session?.scraped_at ?? null)

  function accessFact(s: ClassSession | null): string {
    if (!s) return 'BETWEEN SESSIONS'
    if (s.no_experience) return 'NO EXPERIENCE NEEDED'
    if (s.drop_in) return `DROP-IN${s.price ? ` · $${s.price}` : ''}`
    if (s.audition_required) return 'AUDITION REQUIRED'
    return `LEVEL ${s.level}`
  }

  function seatStatus(s: ClassSession | null): string | null {
    if (!s) return null
    if (s.drop_in) return 'WALK-INS WELCOME'
    if (!enrolling) return 'WAITLIST OPEN'
    if (s.seats_total && s.seats_taken != null) return `${s.seats_taken} OF ${s.seats_total} TAKEN`
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 1099,
          background: 'rgba(0,0,0,.3)',
          opacity: entered && !dismissing ? 1 : 0,
          transition: 'opacity 200ms',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'absolute',
          bottom: 79,
          left: 0,
          right: 0,
          zIndex: 1100,
          background: 'var(--bg)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -14px 44px rgba(0,0,0,.75)',
          maxHeight: 'calc(100% - 160px)',
          overflowY: 'auto',
          transform: `translateY(${dismissing ? 400 : entered ? dragY : 200}px)`,
          transition: dismissing || !entered ? 'transform 200ms' : dragY > 0 ? 'none' : 'transform 200ms',
        }}
      >
        {/* Grab row — explicit 24px height for OSM attribution */}
        <div style={{ height: 24, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
          <div style={{
            position: 'absolute', right: 14, top: 6,
            ...mono, fontSize: 8, color: 'var(--ink-whisper)',
          }}>
            © OpenStreetMap contributors
          </div>
        </div>

        <div style={{ padding: '0 20px 24px' }}>
          {/* Header */}
          <div style={{ marginBottom: 14 }}>
            {/* Photo placeholder */}
            <div style={{
              width: 88, height: 66, borderRadius: 3,
              background: 'var(--bg-card)', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10,
              ...mono, fontSize: 8, color: 'var(--ink-faint)', letterSpacing: '0.1em',
            }}>
              THE ROOM
            </div>

            <div style={{ ...serif, fontStyle: 'italic', fontSize: 21, color: 'var(--ink)', marginBottom: 4 }}>
              {school.name}
            </div>
            <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--ink-faint)' }}>
              {[school.neighborhood, school.discipline.toUpperCase(), school.price_band].filter(Boolean).join(' · ')}
            </div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--ink-ghost)', marginTop: 4 }}>
              NEVER TAKEN A CLASS HERE
            </div>
          </div>

          {/* Next session panel */}
          {session && (
            <div style={{
              border: `1px solid ${enrolling ? dc : '#4a453a'}`,
              borderRadius: 3,
              background: 'var(--bg-card)',
              padding: '12px 14px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: enrolling ? dc : 'var(--ink-faint)', textTransform: 'uppercase' }}>
                  {enrolling ? 'NEXT SESSION' : 'BETWEEN SESSIONS'}
                </span>
                {seatStatus(session) && (
                  <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)' }}>
                    {seatStatus(session)}
                  </span>
                )}
              </div>

              <div style={{ ...serif, fontStyle: 'italic', fontSize: 19, color: 'var(--ink)', marginBottom: 4 }}>
                {session.title}
              </div>

              {(session.schedule || session.weeks || session.starts_on) && (
                <div style={{ ...serif, fontSize: 14, color: 'var(--ink-dim)', marginBottom: 10 }}>
                  {[session.schedule, session.weeks ? `${session.weeks} weeks` : null, session.starts_on ? `from ${fmtStartDate(session.starts_on)}` : null].filter(Boolean).join(' · ')}
                </div>
              )}

              {/* WHERE IT STARTS */}
              <div style={{ marginTop: 8 }}>
                <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', marginBottom: 6, textTransform: 'uppercase' }}>
                  WHERE IT STARTS
                </div>
                <LevelPips level={session.level as 1 | 2 | 3 | 4 | 5} disciplineColor={dc} />
              </div>
            </div>
          )}

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {/* Access fact — first chip, filled */}
            <span style={{
              ...mono, fontSize: 9.5, letterSpacing: '0.06em',
              padding: '3px 8px', borderRadius: 2,
              background: dc, color: '#0c0a05',
            }}>
              {accessFact(session)}
            </span>

            {/* Money chips — outline */}
            {school.payment_plan && (
              <span style={{ ...mono, fontSize: 9.5, padding: '3px 8px', borderRadius: 2, border: '1px solid var(--rule)', color: 'var(--ink-dim)' }}>
                PAYMENT PLAN
              </span>
            )}
            {school.financial_aid && (
              <span style={{ ...mono, fontSize: 9.5, padding: '3px 8px', borderRadius: 2, border: '1px solid var(--rule)', color: 'var(--ink-dim)' }}>
                FINANCIAL AID
              </span>
            )}
            {school.sliding_scale && (
              <span style={{ ...mono, fontSize: 9.5, padding: '3px 8px', borderRadius: 2, border: '1px solid var(--rule)', color: 'var(--ink-dim)' }}>
                SLIDING SCALE
              </span>
            )}
            {session?.price != null && (
              <span style={{ ...mono, fontSize: 9.5, padding: '3px 8px', borderRadius: 2, border: '1px solid var(--rule)', color: 'var(--ink-dim)' }}>
                ${session.price}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button style={{
              flex: 1, height: 46,
              ...serif, fontStyle: 'italic', fontSize: 15,
              background: enrolling ? dc : 'var(--ink)',
              color: '#0c0a05',
              border: 'none', borderRadius: 3, cursor: 'pointer',
            }}>
              {session?.drop_in ? 'Just show up' : enrolling ? 'Hold a spot' : 'Join the waitlist'}
            </button>

            <button style={{
              height: 46, padding: '0 16px',
              ...mono, fontSize: 11,
              background: 'transparent',
              color: 'var(--ink-dim)',
              border: '1px solid var(--rule)', borderRadius: 3, cursor: 'pointer',
            }}>
              TELL ME MORE
            </button>

            {school.url && (
              <a
                href={`https://maps.google.com/maps?q=${school.latitude},${school.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 46, height: 46,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--rule)', borderRadius: 3,
                  color: 'var(--ink-dim)', textDecoration: 'none', fontSize: 20,
                }}
              >
                ↗
              </a>
            )}
          </div>

          {/* WHO TEACHES IT */}
          {school.teachers.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', marginBottom: 8, textTransform: 'uppercase' }}>
                WHO TEACHES IT
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {school.teachers.map(t => (
                  <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'var(--bg-card)', border: '1px solid var(--rule)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...mono, fontSize: 14, color: 'var(--ink-faint)',
                    }}>
                      {t.name.charAt(0)}
                    </div>
                    <div style={{ ...serif, fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', textAlign: 'center' }}>
                      {t.name}
                    </div>
                    {t.credential && (
                      <div style={{ ...mono, fontSize: 8, color: 'var(--ink-faint)', textAlign: 'center', textTransform: 'uppercase' }}>
                        {t.credential}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ALSO NEARBY */}
          {nearby.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', marginBottom: 8, textTransform: 'uppercase' }}>
                ALSO NEARBY
              </div>
              {nearby.map(s => {
                const sEnrolling = isEnrolling(s.next_session)
                return (
                  <div
                    key={s.id}
                    onClick={() => onSelectSchool(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0',
                      borderTop: '1px solid var(--rule-soft, var(--rule))',
                      cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    <span style={{
                      ...mono, fontSize: 9,
                      color: sEnrolling ? 'var(--ink)' : 'var(--ink-faint)',
                      whiteSpace: 'nowrap', minWidth: 40,
                    }}>
                      {s.next_session?.starts_on ? fmtStartDate(s.next_session.starts_on) : 'LATER'}
                    </span>
                    <span style={{ ...serif, fontStyle: 'italic', fontSize: 14, color: 'var(--ink)', flex: 1 }}>
                      {s.next_session?.title ?? s.name}
                    </span>
                    <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', textAlign: 'right' }}>
                      {s.short_name}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Stale data footer */}
          {scrapedDaysAgo !== null && scrapedDaysAgo > 7 && (
            <div style={{ ...mono, fontSize: 8, color: 'var(--ink-ghost)', textAlign: 'center', paddingTop: 8 }}>
              LISTINGS UPDATED {Math.floor(scrapedDaysAgo)} DAYS AGO
            </div>
          )}
        </div>
      </div>
    </>
  )
}
