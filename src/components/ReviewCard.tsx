import { useState } from 'react'
import { ThumbsUp, AlertTriangle, Trash2 } from 'lucide-react'
import { BELT_NAMES, BELT_COLORS } from '../lib/types'
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
    <div className="bg-slate-800/50 rounded-lg p-3.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">
            {review.profile?.username ?? 'Anonymous'}
          </span>
          {review.profile && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${BELT_COLORS[review.profile.belt_level]}`}>
              {BELT_NAMES[review.profile.belt_level]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-xs ${i < review.rating ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
          ))}
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <p className="text-white text-sm font-medium mb-1">{review.title}</p>
      )}

      {/* Body */}
      {review.body && (
        <>
          {review.contains_spoilers && !spoilerRevealed ? (
            <button
              onClick={() => setSpoilerRevealed(true)}
              className="flex items-center gap-1.5 text-orange-400 text-xs bg-orange-400/10 px-2 py-1.5 rounded-md hover:bg-orange-400/20 transition-colors"
            >
              <AlertTriangle size={12} />
              Contains spoilers — tap to reveal
            </button>
          ) : (
            <p className="text-slate-400 text-sm leading-relaxed">{review.body}</p>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoteHelpful}
            className="flex items-center gap-1 text-slate-500 text-xs hover:text-slate-300 transition-colors"
          >
            <ThumbsUp size={12} />
            {review.helpful_count > 0 ? review.helpful_count : 'Helpful'}
          </button>
          <span className="text-slate-600 text-[10px]">
            {new Date(review.created_at).toLocaleDateString()}
          </span>
        </div>
        {isOwn && (
          <button
            onClick={onDelete}
            className="text-red-400/50 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
