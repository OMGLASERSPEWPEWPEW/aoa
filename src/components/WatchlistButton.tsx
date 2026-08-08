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
      style={{
        padding: 6,
        borderRadius: 3,
        border: 'none',
        backgroundColor: 'transparent',
        color: status === 'seen'
          ? 'var(--access)'
          : status
            ? 'var(--accent)'
            : 'var(--ink-faint)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      title={status === 'seen' ? 'Seen' : status === 'want_to_see' ? 'Want to See' : status === 'booked' ? 'Booked' : 'Add to Watchlist'}
    >
      {status === 'seen' ? <Eye size={18} /> : status ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
    </button>
  )
}
