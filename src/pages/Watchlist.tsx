import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Eye } from 'lucide-react'
import { useWatchlist } from '../hooks/useWatchlist'
import { EventCard } from '../components/EventCard'
import type { WatchlistStatus } from '../lib/types'

const TABS: { key: WatchlistStatus | 'all'; label: string; icon: typeof Bookmark }[] = [
  { key: 'all', label: 'All', icon: Bookmark },
  { key: 'want_to_see', label: 'Want to See', icon: Bookmark },
  { key: 'booked', label: 'Booked', icon: Bookmark },
  { key: 'seen', label: 'Seen', icon: Eye },
]

export function Watchlist() {
  const navigate = useNavigate()
  const { items, loading, removeFromWatchlist } = useWatchlist()
  const [tab, setTab] = useState<WatchlistStatus | 'all'>('all')

  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab)

  function handleToggle(eventId: string) {
    const item = items.find(i => i.event_id === eventId)
    if (!item) return
    removeFromWatchlist(eventId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading watchlist...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
              tab === key ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500'
            }`}
          >
            <Icon size={14} />
            {label}
            {key !== 'all' && (
              <span className="text-[10px] bg-slate-800 px-1.5 rounded-full">
                {items.filter(i => i.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <Bookmark size={32} className="mb-2 text-slate-600" />
            <p className="text-sm">
              {tab === 'all' ? 'Your watchlist is empty' : `No ${tab.replace('_', ' ')} shows`}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Browse the Discover tab to add shows
            </p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="relative">
              {item.event && (
                <>
                  <EventCard
                    event={item.event}
                    watchlistStatus={item.status}
                    onWatchlistToggle={() => handleToggle(item.event_id)}
                  />
                  {(item.status === 'want_to_see' || item.status === 'booked') && (
                    <button
                      onClick={() => navigate(`/app/log/${item.event_id}`)}
                      className="w-full mt-1 py-2 rounded-md text-center transition-colors"
                      style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 10.5,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase' as const,
                        color: 'var(--accent)',
                        border: '1px solid var(--rule)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      LOG AS SEEN
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
