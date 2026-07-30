import { Bookmark } from 'lucide-react'

export function Watchlist() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
      <Bookmark size={48} className="text-amber-400 mb-4" />
      <h2 className="text-xl font-semibold text-white mb-2">Your Watchlist</h2>
      <p className="text-center text-sm max-w-xs">
        Track shows you want to see and log what you've seen. Coming in Phase 4.
      </p>
      <p className="text-xs text-slate-600 mt-4">Graph node: watchlist-ui</p>
    </div>
  )
}
