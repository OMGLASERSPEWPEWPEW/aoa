import { HOUSE_RANKS, RANK_UP_COPY, type HouseRank } from '../lib/house'
import { SeatingChart } from './SeatingChart'

interface Props {
  rank: HouseRank
  onDismiss: () => void
}

export function HouseRankModal({ rank, onDismiss }: Props) {
  if (rank < 1 || rank > 6) return null

  const rankName = HOUSE_RANKS[rank]
  const copy = RANK_UP_COPY[rank as Exclude<HouseRank, 0>]

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#0c0a05',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, oklch(0.16 0.04 55) 0%, #0c0a05 60%)',
          position: 'absolute',
          inset: 0,
        }}
      />

      <div style={{ position: 'relative', transform: 'scale(1.6)', marginBottom: 40 }}>
        <SeatingChart rank={rank} />
      </div>

      <h2
        style={{
          position: 'relative',
          fontFamily: "'Newsreader', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 34,
          color: 'oklch(0.84 0.13 55)',
          margin: '0 0 12px',
          textAlign: 'center',
        }}
      >
        {rankName}
      </h2>

      <p
        style={{
          position: 'relative',
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 16,
          color: '#9c9586',
          lineHeight: 1.5,
          textAlign: 'center',
          maxWidth: 300,
          margin: 0,
        }}
      >
        {copy}
      </p>
    </div>
  )
}
