import { useState } from 'react'
import { Star, AlertTriangle, X } from 'lucide-react'

interface Props {
  onSubmit: (review: { rating: number; title: string; body: string; contains_spoilers: boolean }) => Promise<void>
  onClose: () => void
}

export function ReviewForm({ onSubmit, onClose }: Props) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [spoilers, setSpoilers] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeRating = hoverRating || rating

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-white text-lg font-bold">Write a Review</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          {/* Rating */}
          <div className="mb-4">
            <label className="text-slate-400 text-xs block mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(n)}
                  className="text-2xl transition-colors"
                >
                  <Star
                    size={28}
                    className={n <= activeRating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="text-slate-400 text-xs block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Sum it up in a few words"
              maxLength={100}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Body */}
          <div className="mb-4">
            <label className="text-slate-400 text-xs block mb-1">Review</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="What did you think? What stood out?"
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          {/* Spoiler toggle */}
          <label className="flex items-center gap-2 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={spoilers}
              onChange={e => setSpoilers(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-amber-400 focus:ring-amber-400"
            />
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-slate-400 text-sm">Contains spoilers</span>
          </label>

          <button
            onClick={async () => {
              if (rating === 0) return
              setSaving(true)
              await onSubmit({ rating, title, body, contains_spoilers: spoilers })
            }}
            disabled={saving || rating === 0}
            className="w-full py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 disabled:opacity-30 transition-colors"
          >
            {saving ? 'Posting...' : 'Post Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
