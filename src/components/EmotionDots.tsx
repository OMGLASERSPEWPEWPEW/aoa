import { base, emotionBySlug } from '../lib/emotions'
import type { Emotion } from '../lib/types'

interface Props {
  emotions: Emotion[]
  size: 8 | 9 | 10
}

export function EmotionDots({ emotions, size }: Props) {
  if (emotions.length === 0) return null

  return (
    <div className="flex items-center" style={{ gap: 3 }}>
      {emotions.map((slug, i) => {
        const e = emotionBySlug(slug)
        return (
          <div
            key={`${slug}-${i}`}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: base(e),
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}
