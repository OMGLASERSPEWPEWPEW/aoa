import { UserMinus, Check, X } from 'lucide-react'
import { HOUSE_RANKS } from '../lib/types'
import type { Friendship } from '../lib/types'

interface Props {
  friends: Friendship[]
  pending: Friendship[]
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onRemove: (id: string) => void
}

export function FriendsList({ friends, pending, onAccept, onDecline, onRemove }: Props) {
  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            Pending Requests ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-medium">
                    {(f.profile?.username ?? '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm">{f.profile?.username ?? 'Unknown'}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-amber-400/10 text-amber-400">
                      {HOUSE_RANKS[f.profile?.house_rank ?? 0]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onAccept(f.id)}
                    className="p-1.5 rounded-md bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => onDecline(f.id)}
                    className="p-1.5 rounded-md bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
          Friends ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <p className="text-slate-600 text-sm">No friends yet. Search to add some!</p>
        ) : (
          <div className="space-y-2">
            {friends.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-medium">
                    {(f.profile?.username ?? '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm">{f.profile?.username ?? 'Unknown'}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-amber-400/10 text-amber-400">
                      {HOUSE_RANKS[f.profile?.house_rank ?? 0]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(f.id)}
                  className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <UserMinus size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
