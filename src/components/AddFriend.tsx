import { useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { HOUSE_RANKS } from '../lib/types'
import type { Profile } from '../lib/types'

interface Props {
  onSearch: (query: string) => Promise<Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]>
  onSendRequest: (userId: string) => Promise<void>
  onClose: () => void
}

export function AddFriend({ onSearch, onSendRequest, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]>([])
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)

  async function handleSearch() {
    if (query.length < 2) return
    setSearching(true)
    const data = await onSearch(query)
    setResults(data)
    setSearching(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-lg font-bold">Add Friend</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username..."
                className="w-full bg-slate-800 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={query.length < 2 || searching}
              className="px-4 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 disabled:opacity-30 transition-colors"
            >
              Search
            </button>
          </div>

          {results.length === 0 && query.length >= 2 && !searching && (
            <p className="text-slate-600 text-sm text-center py-4">No users found</p>
          )}

          <div className="space-y-2">
            {results.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-medium">
                    {(p.username ?? '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm">{p.username ?? 'Anonymous'}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-amber-400/10 text-amber-400">
                      {HOUSE_RANKS[p.house_rank]}
                    </span>
                  </div>
                </div>
                {sent.has(p.id) ? (
                  <span className="text-green-400 text-xs">Sent!</span>
                ) : (
                  <button
                    onClick={async () => {
                      await onSendRequest(p.id)
                      setSent(prev => new Set(prev).add(p.id))
                    }}
                    className="p-1.5 rounded-md bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
