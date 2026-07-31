import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
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
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-white text-sm font-medium">Reviews</h3>
          {reviews.length > 0 && (
            <span className="text-slate-500 text-xs">({reviews.length})</span>
          )}
        </div>
        {user && !userReview && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md hover:bg-amber-400/20 transition-colors"
          >
            <MessageSquare size={12} />
            Write Review
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-slate-600 text-sm">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
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
