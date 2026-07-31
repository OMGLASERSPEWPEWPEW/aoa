import { Bookmark, BookmarkCheck, Eye } from 'lucide-react'
import type { WatchlistStatus } from '../lib/types'

interface WatchlistButtonProps {
  status: WatchlistStatus | null
  onToggle: () => void
}

export function WatchlistButton({ status, onToggle }: WatchlistButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`p-1.5 rounded-lg transition-colors shrink-0 ${
        status === 'seen'
          ? 'text-green-400 bg-green-400/10'
          : status
            ? 'text-amber-400 bg-amber-400/10'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
      }`}
      title={status === 'seen' ? 'Seen' : status === 'want_to_see' ? 'Want to See' : status === 'seeing' ? 'Seeing' : 'Add to Watchlist'}
    >
      {status === 'seen' ? <Eye size={18} /> : status ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
    </button>
  )
}
