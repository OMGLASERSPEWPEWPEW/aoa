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
        color: isOrchestra ? 'var(--accent)' : 'var(--ink-dim)',
        border: `1px solid ${isOrchestra ? 'var(--accent-border)' : 'var(--rule)'}`,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {HOUSE_RANKS[rank]}
    </span>
  )
}
