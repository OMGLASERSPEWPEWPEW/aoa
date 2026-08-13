import { emotionBySlug } from '../lib/emotions'
import type { Emotion } from '../lib/types'

export function EmotionPill({ emotion }: { emotion: Emotion }) {
  const def = emotionBySlug(emotion)
  if (!def) return null

  return (
    <span
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9.5,
        padding: '2px 7px',
        borderRadius: 10,
        border: `1px solid oklch(0.36 ${def.c * 0.5} ${def.h})`,
        backgroundColor: `oklch(0.21 ${def.c * 0.3} ${def.h})`,
        color: `oklch(${def.l + 0.10} ${def.c - 0.02} ${def.h})`,
        whiteSpace: 'nowrap',
      }}
    >
      {def.label}
    </span>
  )
}
