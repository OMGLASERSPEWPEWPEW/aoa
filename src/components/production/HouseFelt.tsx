import { SpectrumBar } from '../SpectrumBar'
import { InterpretationSentence } from '../InterpretationSentence'
import type { SpectrumSlice } from '../../lib/types'

export interface HouseFeltProps {
  spectrum: SpectrumSlice[]
  totalCards: number
}

export function HouseFelt({ spectrum, totalCards }: HouseFeltProps) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
          }}
        >
          THE HOUSE FELT
        </span>
        {totalCards > 0 && (
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              color: 'var(--ink-ghost)',
            }}
          >
            {totalCards} CARD{totalCards !== 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {spectrum.length > 0 ? (
        <>
          <SpectrumBar slices={spectrum} height={11} totalCards={totalCards} />
          <div style={{ marginTop: 8 }}>
            <InterpretationSentence slices={spectrum} totalCards={totalCards} />
          </div>
        </>
      ) : (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: 'var(--ink-dim)',
            fontStyle: 'italic',
          }}
        >
          No one's logged this yet. Be the first.
        </p>
      )}
    </div>
  )
}
