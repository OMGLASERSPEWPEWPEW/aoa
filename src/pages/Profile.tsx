import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { HOUSE_RANKS } from '../lib/types'
import { Award, Eye, MapPin, MessageSquare } from 'lucide-react'

export function Profile() {
  const { user } = useAuth()
  const { profile, loading } = useProfile()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading profile...
      </div>
    )
  }

  const rank = profile?.house_rank ?? 0
  const rankName = HOUSE_RANKS[rank]

  const stats = [
    { label: 'Shows Seen', value: profile?.shows_seen_count ?? 0, icon: Eye },
    { label: 'Venues', value: profile?.venues_visited_count ?? 0, icon: MapPin },
    { label: 'Reviews', value: profile?.reviews_written_count ?? 0, icon: MessageSquare },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3 bg-amber-400/10 text-amber-400">
          <Award size={36} />
        </div>
        <h2 className="text-white text-xl font-bold">{rankName}</h2>
        <p className="text-slate-500 text-sm mt-1">
          {profile?.username ?? user?.email?.split('@')[0] ?? 'Theater Explorer'}
        </p>
        <p className="text-slate-600 text-xs mt-0.5">{rank + 1} of 7</p>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 mb-6">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <Icon size={16} className="text-amber-400 mx-auto mb-1" />
            <p className="text-white text-lg font-bold">{value}</p>
            <p className="text-slate-500 text-[10px]">{label}</p>
          </div>
        ))}
      </div>

      {rank < 6 && (
        <div className="mx-4 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-white text-sm font-medium mb-1">Next: {HOUSE_RANKS[rank + 1]}</p>
          <p className="text-slate-500 text-xs">Keep exploring Chicago theater to advance.</p>
        </div>
      )}
    </div>
  )
}
