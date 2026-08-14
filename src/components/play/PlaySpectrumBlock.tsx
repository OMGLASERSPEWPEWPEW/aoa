import { SpectrumBar } from '../SpectrumBar'
import { InterpretationSentence } from '../InterpretationSentence'
import type { SpectrumSlice } from '../../lib/types'

interface Props {
  slices: SpectrumSlice[]
  totalCards: number
  mode: 'staged' | 'unstaged'
}

export function PlaySpectrumBlock({ slices, totalCards, mode }: Props) {
  if (slices.length === 0 && totalCards === 0) return null

  return (
    <div
      style={{
        padding: '14px 20px', backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
        marginBottom: 14,
      }}
    >
      <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
            letterSpacing: '0.18em', color: 'var(--ink-faint)',
          }}
        >
          {mode === 'staged' ? 'EVERY ROOM, EVERY PRODUCTION' : 'EVERY ROOM, EVERYWHERE'}
        </span>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
            color: 'var(--ink-ghost)',
          }}
        >
          {totalCards.toLocaleString()} CARDS
        </span>
      </div>
      <SpectrumBar slices={slices} height={11} totalCards={totalCards} />
      <div style={{ marginTop: 8 }}>
        <InterpretationSentence slices={slices} totalCards={totalCards} />
      </div>
    </div>
  )
}
