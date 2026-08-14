import type { Event } from '../../lib/types'

interface ProductionRow {
  event: Event
  userSeen: boolean
  userSeenDate: string | null
}

interface Props {
  productions: ProductionRow[]
  onProductionClick: (eventId: string) => void
}

export function StagedProductionsBlock({ productions, onProductionClick }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = productions.find(p => p.event.end_date && p.event.end_date >= today)
  const past = productions.filter(p => p !== upcoming).slice(0, 2)

  return (
    <div style={{ padding: '0 20px 14px' }}>
      {/* JUST ANNOUNCED */}
      {upcoming && (
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
            onClick={() => onProductionClick(upcoming.event.id)}
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
              {upcoming.event.venue?.name ?? 'Venue TBA'}
            </div>
            <div
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 10,
                color: 'var(--accent-text)', marginTop: 2,
              }}
            >
              {formatDateRange(upcoming.event.start_date, upcoming.event.end_date)}
            </div>
            {upcoming.event.cast_members && upcoming.event.cast_members.length > 0 && (
              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif", fontSize: 14,
                  color: 'var(--ink-dim)', marginTop: 4,
                }}
              >
                {getDirectorLine(upcoming.event.cast_members)}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Past productions */}
      {past.map((p, i) => {
        const year = p.event.start_date
          ? new Date(p.event.start_date + 'T00:00:00').getFullYear()
          : null
        return (
          <div key={p.event.id}>
            {(i > 0 || upcoming) && (
              <div style={{ borderTop: '1px dotted var(--rule)', margin: '10px 0' }} />
            )}
            <button
              onClick={() => onProductionClick(p.event.id)}
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
                  {p.event.venue?.name ?? 'Unknown venue'}
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
                <span
                  style={{
                    fontFamily: "'Courier Prime', monospace", fontSize: 9,
                    letterSpacing: '0.06em', color: 'var(--ink-ghost)', marginTop: 3,
                    display: 'block',
                  }}
                >
                  YOU SAW THIS
                  {p.event.venue?.name ? ` AT ${p.event.venue.name.toUpperCase()}` : ''}
                  {p.userSeenDate ? ` IN ${new Date(p.userSeenDate + 'T00:00:00').getFullYear()}` : ''}
                </span>
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
  )
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates TBA'
  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  }
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start)
}

function getDirectorLine(cast: Array<{ name: string; role: string | null }>): string {
  const directors = cast.filter(c => c.role?.toLowerCase() === 'director')
  if (directors.length > 0) {
    return `dir. ${directors.map(d => d.name).join(', ')} · casting not announced`
  }
  return 'casting not announced'
}
