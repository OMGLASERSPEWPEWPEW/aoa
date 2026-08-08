import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist'
import { getTonightTimes, formatShowTime } from '../lib/tonight'
import { SpectrumBar } from './SpectrumBar'
import { GenreChip } from './GenreChip'
import type { Event, SpectrumSlice } from '../lib/types'

interface Props {
  event: Event
  spectrum: SpectrumSlice[]
  totalCards: number
}

export function TonightHero({ event, spectrum, totalCards }: Props) {
  const navigate = useNavigate()
  const { addToWatchlist, getStatus } = useWatchlist()
  const venue = event.venue
  const status = getStatus(event.id)

  const priceStr =
    event.price_min === null && event.price_max === null
      ? 'Free'
      : event.price_min === 0 && (event.price_max === null || event.price_max === 0)
        ? 'Free'
        : event.price_min === event.price_max
          ? `$${event.price_min}`
          : `$${event.price_min ?? 0}–$${event.price_max}`

  const tonightTimes = getTonightTimes(event.show_times)
  const curtainStr = tonightTimes.length > 0
    ? tonightTimes.map(formatShowTime).join(', ')
    : null

  const venueLine = [
    venue?.name?.toUpperCase(),
    venue?.venue_type?.toUpperCase(),
    curtainStr,
  ].filter(Boolean).join(' • ')

  return (
    <div style={{ borderBottom: '1px solid var(--rule)' }}>
      {/* Hero image band */}
      <div
        style={{
          height: 196,
          backgroundColor: 'var(--bg-card)',
          backgroundImage: event.photo_url || venue?.photo_url
            ? `url(${event.photo_url || venue?.photo_url})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(transparent, var(--bg))',
          }}
        />
        {/* Genre chips */}
        {event.genre_tags.length > 0 && (
          <div
            className="flex gap-1.5"
            style={{ position: 'absolute', bottom: 10, left: 20 }}
          >
            {event.genre_tags.slice(0, 3).map((tag, i) => (
              <GenreChip key={tag} genre={tag} primary={i === 0} />
            ))}
          </div>
        )}
      </div>

      {/* Body block */}
      <div style={{ padding: '14px 20px 18px' }}>
        <h2
          onClick={() => navigate(`/app/show/${event.id}`)}
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 29,
            lineHeight: 1.04,
            color: 'var(--ink)',
            cursor: 'pointer',
            margin: 0,
          }}
        >
          {event.title}
        </h2>

        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10.5,
            letterSpacing: '0.08em',
            color: 'var(--ink-faint)',
            marginTop: 6,
          }}
        >
          {venueLine}
        </div>

        {event.description && (
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 15,
              color: 'var(--ink-dim)',
              lineHeight: 1.4,
              marginTop: 10,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.description}
          </p>
        )}

        {spectrum.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <SpectrumBar slices={spectrum} height={9} totalCards={totalCards} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5" style={{ marginTop: 14 }}>
          <button
            onClick={() => {
              if (status) {
                navigate(`/app/show/${event.id}`)
              } else {
                addToWatchlist(event.id)
              }
            }}
            style={{
              flex: 1,
              height: 46,
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
            {status ? 'View show' : 'Want to see'}
          </button>
          <button
            onClick={() => navigate(`/app/show/${event.id}`)}
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
    </div>
  )
}
