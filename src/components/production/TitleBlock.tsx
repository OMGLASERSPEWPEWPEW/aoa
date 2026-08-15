import type { Event, Venue, Play } from '../../lib/types'
import type { WatchlistStatus } from '../../lib/types'

export interface TitleBlockProps {
  event: Event
  venue: Venue | undefined
  play: Play | undefined
  dateStr: string
  priceStr: string
  hasPWYC: boolean
  watchlistStatus: WatchlistStatus | null
  onWantToSee: () => void
  onLogSeen: () => void
  onTickets: () => void
}

export function TitleBlock({
  event,
  venue,
  play,
  dateStr,
  priceStr,
  hasPWYC,
  watchlistStatus,
  onWantToSee,
  onLogSeen,
  onTickets,
}: TitleBlockProps) {
  return (
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
            color: 'var(--ink-dim)',
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
          color: 'var(--ink-faint)',
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
            color: 'var(--access)',
            border: '1px solid var(--access)',
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
        {!watchlistStatus && (
          <button
            onClick={onWantToSee}
            style={{
              height: 46,
              flex: 1,
              borderRadius: 3,
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-on)',
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
        {watchlistStatus && (
          <button
            onClick={onLogSeen}
            style={{
              height: 46,
              flex: 1,
              borderRadius: 3,
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-on)',
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
          onClick={onTickets}
          style={{
            width: 104,
            height: 46,
            borderRadius: 3,
            backgroundColor: 'transparent',
            color: 'var(--ink)',
            fontFamily: "'Courier Prime', monospace",
            fontSize: 12,
            border: '1px solid var(--rule)',
            cursor: 'pointer',
          }}
        >
          {priceStr}
        </button>
      </div>
    </div>
  )
}
