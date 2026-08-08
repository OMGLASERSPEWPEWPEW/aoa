import { HOUSE_RANKS, type HouseRank } from '../lib/house'

export function HouseChips({ currentRank }: { currentRank: HouseRank }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {HOUSE_RANKS.map((name, idx) => {
        const isAchieved = idx < currentRank
        const isCurrent = idx === currentRank

        let color: string
        let border: string
        let bg: string | undefined
        let textDecoration: string | undefined

        if (isAchieved) {
          color = 'var(--ink-ghost)'
          border = '1px solid var(--rule-soft)'
          textDecoration = 'line-through'
        } else if (isCurrent) {
          color = 'var(--accent)'
          border = '1px solid var(--accent-border)'
          bg = 'var(--accent-bg)'
        } else {
          color = 'var(--ink-faint)'
          border = '1px dashed var(--rule)'
        }

        return (
          <span
            key={name}
            data-testid="house-chip"
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              padding: '4px 9px',
              borderRadius: 2,
              color,
              border,
              backgroundColor: bg,
              textDecoration,
              textTransform: 'uppercase',
            }}
          >
            {name}
          </span>
        )
      })}
    </div>
  )
}
