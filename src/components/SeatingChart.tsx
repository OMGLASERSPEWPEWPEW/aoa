import { rankRow, type HouseRank } from '../lib/house'

const ROWS = 4
const SEATS_PER_ROW = 8
const LIT_SEAT_INDEX = 3

export function SeatingChart({ rank }: { rank: HouseRank }) {
  const userRow = rankRow(rank)

  return (
    <div
      style={{
        border: '1px solid #2b2720',
        borderRadius: 3,
        backgroundColor: '#141109',
        padding: '12px 0 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 8.5,
          letterSpacing: '0.3em',
          color: '#4f4a3e',
        }}
      >
        STAGE
      </span>

      <div
        style={{
          width: 180,
          height: 2,
          backgroundColor: 'oklch(0.42 0.09 55)',
          marginBottom: 8,
        }}
      />

      {Array.from({ length: ROWS }, (_, rowIdx) => {
        const isUserRow = rowIdx === userRow
        const isCloserToStage = rowIdx < userRow

        return (
          <div key={rowIdx} style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: SEATS_PER_ROW }, (_, seatIdx) => {
              const isLit = isUserRow && seatIdx === LIT_SEAT_INDEX
              const size = isLit ? 11 : 7
              const radius = isLit ? 2 : 1

              let bg: string
              if (isLit) {
                bg = 'oklch(0.86 0.15 55)'
              } else if (isUserRow) {
                bg = 'oklch(0.45 0.09 55)'
              } else if (isCloserToStage) {
                bg = 'oklch(0.55 0.11 55)'
              } else {
                bg = '#2b2720'
              }

              return (
                <div
                  key={seatIdx}
                  data-testid="seat"
                  style={{
                    width: size,
                    height: size,
                    borderRadius: radius,
                    backgroundColor: bg,
                    boxShadow: isLit ? '0 0 10px oklch(0.80 0.14 55)' : undefined,
                  }}
                />
              )
            })}
          </div>
        )
      })}

      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 8.5,
          letterSpacing: '0.2em',
          color: '#4f4a3e',
          marginTop: 6,
        }}
      >
        STANDING ROOM
      </span>
    </div>
  )
}
