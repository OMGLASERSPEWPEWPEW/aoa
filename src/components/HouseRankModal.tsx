import { useState, useEffect } from 'react'
import { HOUSE_RANKS, RANK_UP_COPY, type HouseRank } from '../lib/house'
import { SeatingChart } from './SeatingChart'

interface Props {
  rank: HouseRank
  onDismiss: () => void
}

export function HouseRankModal({ rank, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    requestAnimationFrame(() => setVisible(true))
  }, [])

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
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? 'none' : 'opacity 400ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        style={{
          background: 'var(--gold-gradient)',
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
          color: 'var(--accent-text)',
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
          color: 'var(--ink-dim)',
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
