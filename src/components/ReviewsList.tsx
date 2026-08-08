import { useState } from 'react'
import { useReviews } from '../hooks/useReviews'
import { useAuth } from '../contexts/AuthContext'
import { ReviewForm } from './ReviewForm'
import { ReviewCard } from './ReviewCard'

interface Props {
  eventId: string
}

export function ReviewsList({ eventId }: Props) {
  const { user } = useAuth()
  const { reviews, loading, submitReview, deleteReview, voteHelpful, userReview } = useReviews(eventId)
  const [showForm, setShowForm] = useState(false)

  if (loading) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-baseline gap-2">
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: 'var(--ink-faint)',
            }}
          >
            REVIEWS
          </span>
          {reviews.length > 0 && (
            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: 'var(--ink-ghost)' }}>
              ({reviews.length})
            </span>
          )}
        </div>
        {user && !userReview && (
          <button
            onClick={() => setShowForm(true)}
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
        )}
      </div>

      {reviews.length === 0 ? (
        <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 14, color: 'var(--ink-dim)' }}>
          No reviews yet. Be the first.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwn={review.user_id === user?.id}
              onVoteHelpful={() => voteHelpful(review.id)}
              onDelete={() => deleteReview(review.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ReviewForm
          onSubmit={async (data) => {
            await submitReview(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
