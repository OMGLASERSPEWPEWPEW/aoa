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
          color = '#4f4a3e'
          border = '1px solid #211d17'
          textDecoration = 'line-through'
        } else if (isCurrent) {
          color = 'oklch(0.80 0.14 55)'
          border = '1px solid oklch(0.42 0.09 55)'
          bg = 'oklch(0.20 0.04 55)'
        } else {
          color = '#625b4c'
          border = '1px dashed #2b2720'
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
