import { useState } from 'react'
import { MessageSquare, Star } from 'lucide-react'
import { useReviews } from '../hooks/useReviews'
import { useAuth } from '../contexts/AuthContext'
import { useBeltCheck } from '../hooks/useBeltCheck'
import { ReviewForm } from './ReviewForm'
import { ReviewCard } from './ReviewCard'
import { BeltUpgradeModal } from './BeltUpgradeModal'

interface Props {
  eventId: string
}

export function ReviewsList({ eventId }: Props) {
  const { user } = useAuth()
  const { reviews, loading, submitReview, deleteReview, voteHelpful, userReview } = useReviews(eventId)
  const { result: beltResult, checkBelt, dismiss: dismissBelt } = useBeltCheck()
  const [showForm, setShowForm] = useState(false)

  if (loading) return null

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-white text-sm font-medium">Reviews</h3>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1">
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span className="text-amber-400 text-xs font-medium">{avgRating.toFixed(1)}</span>
              <span className="text-slate-500 text-xs">({reviews.length})</span>
            </div>
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

      {/* Reviews */}
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
            await checkBelt()
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {beltResult && (
        <BeltUpgradeModal beltLevel={beltResult.newBeltLevel!} onClose={dismissBelt} />
      )}
    </div>
  )
}
