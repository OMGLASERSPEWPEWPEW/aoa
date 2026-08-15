import { useState } from 'react'
import { ReviewBadge } from '../ReviewBadge'
import { emotionBySlug } from '../../lib/emotions'
import type { Emotion, HouseRank } from '../../lib/types'

export interface ReviewItem {
  id: string
  body: string | null
  contains_spoilers: boolean
  emotions: Emotion[] | null
  profile?: { username: string | null; house_rank: number } | null
}

export interface ReviewsSectionProps {
  reviews: ReviewItem[]
  reviewsLoading: boolean
  onWriteReview: () => void
}

export function ReviewsSection({ reviews, reviewsLoading, onWriteReview }: ReviewsSectionProps) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 14 }}>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
          }}
        >
          WHAT PEOPLE SAID
        </span>
        <button
          onClick={onWriteReview}
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          WRITE ONE
        </button>
      </div>

      {reviewsLoading ? (
        <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Loading...</p>
      ) : reviews.length === 0 ? (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: 'var(--ink-dim)',
            fontStyle: 'italic',
          }}
        >
          No reviews yet.
        </p>
      ) : (
        <div>
          {reviews.map((review, i) => (
            <div key={review.id}>
              {i > 0 && <div style={{ borderTop: '1px dotted var(--rule)', margin: '12px 0' }} />}
              {review.contains_spoilers ? (
                <SpoilerReview review={review} />
              ) : (
                <ReviewRow review={review} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewRow({ review }: { review: ReviewItem }) {
  const rank = (review.profile?.house_rank ?? 0) as HouseRank
  const name = review.profile?.username ?? 'Anonymous'

  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--ink)',
          }}
        >
          {name}
        </span>
        <ReviewBadge rank={rank} />
        {review.emotions && review.emotions.length > 0 && (
          <div className="flex gap-1">
            {review.emotions.map(slug => {
              const def = emotionBySlug(slug)
              return def ? (
                <div
                  key={slug}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: `oklch(${def.l} ${def.c} ${def.h})`,
                  }}
                />
              ) : null
            })}
          </div>
        )}
      </div>
      {review.body && (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: 'var(--ink-dim)',
            lineHeight: 1.5,
          }}
        >
          {review.body}
        </p>
      )}
    </div>
  )
}

function SpoilerReview({ review }: { review: ReviewItem }) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) return <ReviewRow review={review} />

  return (
    <button
      onClick={() => setRevealed(true)}
      style={{
        width: '100%',
        minHeight: 44,
        fontFamily: "'Courier Prime', monospace",
        fontSize: 11,
        color: 'var(--danger)',
        backgroundColor: 'var(--danger-bg)',
        border: 'none',
        borderRadius: 3,
        padding: '10px 14px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      Contains spoilers — tap to reveal
    </button>
  )
}
