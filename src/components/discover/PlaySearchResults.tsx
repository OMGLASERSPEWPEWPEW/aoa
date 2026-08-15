import type { Play } from '../../lib/types'

export interface PlaySearchResultsProps {
  plays: Play[]
  onPlayClick: (playId: string) => void
}

export function PlaySearchResults({ plays, onPlayClick }: PlaySearchResultsProps) {
  if (plays.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <p
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9,
          color: 'var(--ink-ghost)',
          letterSpacing: '0.06em',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        {plays.length} Play{plays.length !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {plays.map(play => (
          <button
            key={play.id}
            onClick={() => onPlayClick(play.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              width: '100%',
              textAlign: 'left',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--rule)',
              borderRadius: 2,
              padding: '12px 14px',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--ink)',
                lineHeight: 1.3,
              }}
            >
              {play.title}
            </span>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                color: 'var(--ink-faint)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {play.playwright}{play.year_written ? ` · ${play.year_written}` : ''}
            </span>
            {play.synopsis && (
              <span
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 12,
                  color: 'var(--ink-ghost)',
                  lineHeight: 1.4,
                  marginTop: 4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {play.synopsis}
              </span>
            )}
            {play.awards.length > 0 && (
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 9,
                  color: 'var(--accent)',
                  letterSpacing: '0.04em',
                  marginTop: 2,
                }}
              >
                {play.awards[0]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
