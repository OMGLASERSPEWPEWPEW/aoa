import { useState } from 'react'
import { ReviewBadge } from './ReviewBadge'
import { EmotionDots } from './EmotionDots'
import type { Review } from '../lib/types'

interface Props {
  review: Review
  isOwn: boolean
  onVoteHelpful: () => Promise<void>
  onDelete: () => Promise<void>
}

export function ReviewCard({ review, isOwn, onVoteHelpful, onDelete }: Props) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false)

  return (
    <div style={{ padding: '12px 0' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 15,
              color: 'var(--ink)',
            }}
          >
            {review.profile?.username ?? 'Anonymous'}
          </span>
          {review.profile && (
            <ReviewBadge rank={review.profile.house_rank} />
          )}
        </div>
        {review.emotions && review.emotions.length > 0 && (
          <EmotionDots emotions={review.emotions} size={8} />
        )}
      </div>

      {review.body && (
        <>
          {review.contains_spoilers && !spoilerRevealed ? (
            <button
              onClick={() => setSpoilerRevealed(true)}
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11,
                color: 'var(--danger)',
                backgroundColor: 'var(--danger-bg)',
                padding: '6px 10px',
                borderRadius: 2,
                border: 'none',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Contains spoilers — tap to reveal
            </button>
          ) : (
            <p
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: 14.5,
                lineHeight: 1.45,
                color: 'var(--ink-dim)',
                margin: 0,
              }}
            >
              {review.body}
            </p>
          )}
        </>
      )}

      <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onVoteHelpful}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              color: 'var(--ink-ghost)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {review.helpful_count > 0 ? `${review.helpful_count} HELPFUL` : 'HELPFUL'}
          </button>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'var(--ink-ghost)',
            }}
          >
            {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {isOwn && (
          <button
            onClick={onDelete}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              color: 'var(--danger)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            DELETE
          </button>
        )}
      </div>
    </div>
  )
}
