import { base, ink, emotionBySlug, type SpectrumSlice } from '../lib/emotions'
import { useTheme } from '../contexts/ThemeContext'

interface Props {
  slices: SpectrumSlice[]
  height: 8 | 9 | 11 | 26 | 30
  totalCards: number
}

export function SpectrumBar({ slices, height, totalCards }: Props) {
  const { resolved: theme } = useTheme()
  if (totalCards < 5) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {slices.map((s, i) => (
            <div
              key={`${s.emotion}-${i}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: base(emotionBySlug(s.emotion)),
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10.5,
            color: 'var(--ink-ghost)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          EARLY DAYS · {totalCards} {totalCards === 1 ? 'CARD' : 'CARDS'}
        </span>
      </div>
    )
  }

  const sorted = [...slices].sort((a, b) => b.pct - a.pct)
  const capped = capSegments(sorted, 7)
  const top = sorted.slice(0, 3).filter(s => s.pct >= 10)

  return (
    <div>
      <div
        className="flex"
        style={{
          gap: 1,
          borderRadius: height / 2,
          overflow: 'hidden',
          height,
        }}
        role="img"
        aria-label="Emotion spectrum"
      >
        {capped.map((s, i) => (
          <div
            key={`${s.emotion}-${i}`}
            data-emotion={s.emotion}
            style={{
              flex: s.pct,
              backgroundColor: base(emotionBySlug(s.emotion)),
              height,
            }}
          />
        ))}
      </div>
      {top.length > 0 && (
        <div className="flex gap-3 mt-2">
          {top.map(s => {
            const e = emotionBySlug(s.emotion)
            return (
              <span
                key={s.emotion}
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10.5,
                  color: theme === 'dark' ? base(e) : ink(e),
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {e.label} {Math.round(s.pct)}%
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function capSegments(sorted: SpectrumSlice[], max: number): SpectrumSlice[] {
  if (sorted.length <= max) return sorted
  const head = sorted.slice(0, max - 1)
  const tailPct = sorted.slice(max - 1).reduce((sum, s) => sum + s.pct, 0)
  return [...head, { emotion: sorted[max - 1].emotion, pct: tailPct }]
}
