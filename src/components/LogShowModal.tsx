import { useState } from 'react'
import type { Event } from '../lib/types'

interface LogShowModalProps {
  event: Event
  onSave: (rating: number, reflection: string) => Promise<void>
  onClose: () => void
}

export function LogShowModal({ event, onSave, onClose }: LogShowModalProps) {
  const [rating, setRating] = useState(0)
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (rating === 0) return
    setSaving(true)
    await onSave(rating, reflection)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-lg mb-1">Log Show</h3>
        <p className="text-amber-400 text-sm mb-4">{event.title}</p>

        {/* Star rating */}
        <p className="text-slate-400 text-xs mb-2">How was it?</p>
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl transition-colors ${
                star <= rating ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'
              }`}
            >
              ★
            </button>
          ))}
        </div>

        {/* Reflection */}
        <textarea
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          placeholder="Quick thoughts? (optional)"
          rows={3}
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={rating === 0 || saving}
            className="flex-1 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 disabled:opacity-30 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
