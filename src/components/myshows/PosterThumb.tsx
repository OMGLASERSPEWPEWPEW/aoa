import { genreHue } from '../../lib/genre'
import type { WatchlistItem } from '../../lib/types'

interface Props {
  item: WatchlistItem
  onClick: () => void
}

export function PosterThumb({ item, onClick }: Props) {
  const event = item.event
  const photoUrl = event?.photo_url || event?.venue?.photo_url
  const firstGenre = event?.genre_tags?.[0]
  const hue = firstGenre ? genreHue(firstGenre) : null

  return (
    <button
      onClick={onClick}
      style={{
        width: 62,
        height: 84,
        borderRadius: 2,
        border: '1px solid var(--rule)',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        padding: 0,
        background: 'var(--bg)',
        flexShrink: 0,
      }}
    >
      {hue !== null && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: `oklch(0.65 0.15 ${hue})`,
          }}
        />
      )}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={event?.title ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="flex items-center justify-center"
          style={{ width: '100%', height: '100%', paddingLeft: hue !== null ? 4 : 0 }}
        >
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 10,
              color: 'var(--ink-faint)',
              textAlign: 'center',
              padding: 4,
              lineHeight: 1.2,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {event?.title}
          </span>
        </div>
      )}
    </button>
  )
}
