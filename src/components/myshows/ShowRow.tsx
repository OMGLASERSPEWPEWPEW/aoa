import { base, emotionBySlug } from '../../lib/emotions'
import type { WatchlistItem, WatchlistStatus } from '../../lib/types'

interface Props {
  item: WatchlistItem
  tab: WatchlistStatus
  onLog: () => void
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
}

export function ShowRow({ item, tab, onLog }: Props) {
  const event = item.event
  if (!event) return null

  const venue = event.venue
  const day = item.seen_date
    ? new Date(item.seen_date + 'T12:00:00').getDate().toString().padStart(2, '0')
    : null

  const venueLine = [venue?.name?.toUpperCase(), venue?.neighborhood?.toUpperCase()].filter(Boolean).join(' · ')

  const excerpt = item.reflection
    ? truncate(item.reflection, 80)
    : null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '34px 1fr auto',
        gap: 12,
        padding: '11px 20px',
        borderBottom: '1px solid var(--rule-soft)',
      }}
    >
      {/* Day */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink-faint)', paddingTop: 3 }}>
        {day ?? ''}
      </div>

      {/* Title + Venue */}
      <div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 17.5,
              lineHeight: 1.2,
              color: 'var(--ink)',
            }}
          >
            {event.title}
          </span>
        </div>
        {venueLine && (
          <p
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              color: 'var(--ink-faint)',
              marginTop: 2,
              letterSpacing: '0.04em',
            }}
          >
            {venueLine}
          </p>
        )}
        {excerpt && (
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 13.5,
              color: 'var(--ink-dim)',
              marginTop: 5,
            }}
          >
            {excerpt}
          </p>
        )}
        {(tab === 'want_to_see' || tab === 'booked') && (
          <button
            onClick={onLog}
            className="mt-2"
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              background: 'none',
              border: '1px solid var(--rule)',
              borderRadius: 4,
              padding: '4px 10px',
            }}
          >
            LOG AS SEEN
          </button>
        )}
      </div>

      {/* Emotion dots */}
      <div className="flex items-start gap-0.5 pt-1" style={{ gap: 3 }}>
        {(item.emotions ?? []).map((slug, i) => {
          const e = emotionBySlug(slug)
          return (
            <div
              key={`${slug}-${i}`}
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: base(e),
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
