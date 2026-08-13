import { emotionBySlug, fill, edge, bright, ink, fillLight, edgeLight } from '../lib/emotions'
import { useTheme } from '../contexts/ThemeContext'
import type { Emotion } from '../lib/types'

export function EmotionPill({ emotion }: { emotion: Emotion }) {
  const def = emotionBySlug(emotion)
  const { resolved: theme } = useTheme()
  if (!def) return null

  const isDark = theme === 'dark'

  return (
    <span
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9.5,
        padding: '2px 7px',
        borderRadius: 10,
        border: `1px solid ${isDark ? edge(def) : edgeLight(def)}`,
        backgroundColor: isDark ? fill(def) : fillLight(def),
        color: isDark ? bright(def) : ink(def),
        whiteSpace: 'nowrap',
      }}
    >
      {def.label}
    </span>
  )
}
