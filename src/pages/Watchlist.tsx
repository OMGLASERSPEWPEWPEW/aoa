import { useState } from 'react'
import { Bookmark, Eye } from 'lucide-react'
import { useWatchlist } from '../hooks/useWatchlist'
import { useBeltCheck } from '../hooks/useBeltCheck'
import { EventCard } from '../components/EventCard'
import { LogShowModal } from '../components/LogShowModal'
import { BeltUpgradeModal } from '../components/BeltUpgradeModal'
import type { WatchlistStatus, WatchlistItem } from '../lib/types'

const TABS: { key: WatchlistStatus | 'all'; label: string; icon: typeof Bookmark }[] = [
  { key: 'all', label: 'All', icon: Bookmark },
  { key: 'want_to_see', label: 'Want to See', icon: Bookmark },
  { key: 'seen', label: 'Seen', icon: Eye },
]

export function Watchlist() {
  const { items, loading, updateStatus, removeFromWatchlist } = useWatchlist()
  const { result: beltResult, checkBelt, dismiss: dismissBelt } = useBeltCheck()
  const [tab, setTab] = useState<WatchlistStatus | 'all'>('all')
  const [loggingItem, setLoggingItem] = useState<WatchlistItem | null>(null)

  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab)

  function handleToggle(eventId: string) {
    const item = items.find(i => i.event_id === eventId)
    if (!item) return
    if (item.status === 'want_to_see') {
      setLoggingItem(item)
    } else {
      removeFromWatchlist(eventId)
    }
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
      {/* Tabs */}
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

      {/* List */}
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
                <EventCard
                  event={item.event}
                  watchlistStatus={item.status}
                  onWatchlistToggle={() => handleToggle(item.event_id)}
                />
              )}
              {item.status === 'want_to_see' && (
                <button
                  onClick={() => setLoggingItem(item)}
                  className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-md hover:bg-green-400/20 transition-colors"
                >
                  <Eye size={12} />
                  Log as Seen
                </button>
              )}
              {item.status === 'seen' && item.rating && (
                <div className="absolute bottom-3 right-3 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < item.rating! ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Log show modal */}
      {loggingItem && (
        <LogShowModal
          event={loggingItem.event!}
          onSave={async (rating, reflection) => {
            await updateStatus(loggingItem.event_id, 'seen', {
              rating,
              reflection,
              seen_date: new Date().toISOString().split('T')[0],
            })
            setLoggingItem(null)
            await checkBelt()
          }}
          onClose={() => setLoggingItem(null)}
        />
      )}

      {beltResult && (
        <BeltUpgradeModal beltLevel={beltResult.newBeltLevel!} onClose={dismissBelt} />
      )}
    </div>
  )
}
