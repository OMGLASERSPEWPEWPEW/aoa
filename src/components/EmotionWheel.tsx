import { useState, useCallback } from 'react'
import { EMOTIONS, base, fill, bright, type Emotion, type EmotionDef } from '../lib/emotions'

const NODE_POSITIONS: { left: number; top: number }[] = [
  { left: 118, top: 6 },
  { left: 174, top: 21 },
  { left: 215, top: 62 },
  { left: 230, top: 118 },
  { left: 215, top: 174 },
  { left: 174, top: 215 },
  { left: 118, top: 230 },
  { left: 62, top: 215 },
  { left: 21, top: 174 },
  { left: 6, top: 118 },
  { left: 21, top: 62 },
  { left: 62, top: 21 },
]

const TWO_LINE: Set<Emotion> = new Set(['electrified', 'cracked_open', 'transported'])

interface Props {
  selected: Emotion[]
  onChange: (emotions: Emotion[]) => void
}

export function EmotionWheel({ selected, onChange }: Props) {
  const [shaking, setShaking] = useState(false)

  const toggle = useCallback((slug: Emotion) => {
    if (selected.includes(slug)) {
      onChange(selected.filter(s => s !== slug))
      return
    }
    if (selected.length >= 3) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (!mq.matches) {
        setShaking(true)
        setTimeout(() => setShaking(false), 120)
      }
      return
    }
    onChange([...selected, slug])
  }, [selected, onChange])

  return (
    <div>
      <div className="relative mx-auto" style={{ width: 300, height: 300 }}>
        <div
          className="absolute text-center"
          style={{
            left: 96,
            top: 112,
            width: 108,
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-faint)',
            animation: shaking ? 'wheel-shake 120ms ease-out' : undefined,
          }}
        >
          PICK UP TO THREE
        </div>

        {EMOTIONS.map((e, i) => {
          const pos = NODE_POSITIONS[i]
          const isSelected = selected.includes(e.slug)
          return (
            <button
              key={e.slug}
              onClick={() => toggle(e.slug)}
              className="absolute flex items-center justify-center rounded-full transition-colors"
              style={{
                left: pos.left,
                top: pos.top,
                width: 66,
                height: 66,
                border: isSelected ? `1.5px solid ${base(e)}` : '1px solid var(--rule)',
                backgroundColor: isSelected ? fill(e) : 'transparent',
                color: isSelected ? bright(e) : nodeColor(e),
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1.2,
                textAlign: 'center',
                padding: 4,
              }}
              aria-pressed={isSelected}
            >
              {TWO_LINE.has(e.slug) ? (
                <span dangerouslySetInnerHTML={{ __html: e.label.replace(' ', '<br/>') }} />
              ) : (
                e.label
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5 justify-center mt-3">
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-faint)',
          }}
        >
          SELECTED
        </span>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => {
            const slug = selected[i]
            const e = slug ? EMOTIONS.find(em => em.slug === slug) : null
            return (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: e ? base(e) : 'var(--rule)',
                  transition: 'background-color 150ms',
                }}
              />
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes wheel-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}

function nodeColor(e: EmotionDef): string {
  if (e.slug === 'bored') return 'var(--ink-faint)'
  return base(e)
}
