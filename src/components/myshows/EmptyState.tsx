import type { WatchlistStatus } from '../../lib/types'

interface Props {
  shelf: WatchlistStatus
}

const COPY: Record<WatchlistStatus, { line1: string; line2: string }> = {
  want_to_see: {
    line1: 'Nothing on the list yet.',
    line2: 'The map knows what’s up tonight. Start there.',
  },
  booked: {
    line1: 'Nothing here yet.',
    line2: 'Tap ✦ to log something you already saw — it counts, even from 2019.',
  },
  seen: {
    line1: 'Your record starts whenever you say it does.',
    line2: 'Log something you saw in 2019 — it counts.',
  },
}

export function EmptyState({ shelf }: Props) {
  const copy = COPY[shelf]

  return (
    <div className="flex flex-col items-center justify-center h-40 px-8 text-center">
      <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
        {copy.line1}
      </p>
      <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: 'var(--ink-dim)' }}>
        {copy.line2}
      </p>
    </div>
  )
}
