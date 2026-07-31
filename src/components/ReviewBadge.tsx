import { HOUSE_RANKS, type HouseRank } from '../lib/house'

export function ReviewBadge({ rank }: { rank: HouseRank }) {
  const isOrchestra = rank >= 3

  return (
    <span
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: 8.5,
        letterSpacing: '0.1em',
        padding: '1px 6px',
        borderRadius: 9,
        color: isOrchestra ? 'oklch(0.80 0.14 55)' : '#9c9586',
        border: `1px solid ${isOrchestra ? 'oklch(0.42 0.09 55)' : '#2b2720'}`,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {HOUSE_RANKS[rank]}
    </span>
  )
}
