import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { BELT_NAMES, BELT_COLORS } from '../lib/types'
import { Award, Eye, MapPin, MessageSquare } from 'lucide-react'

export function Profile() {
  const { user } = useAuth()
  const { profile, progress, loading } = useProfile()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading profile...
      </div>
    )
  }

  const beltLevel = profile?.belt_level ?? 0
  const beltName = BELT_NAMES[beltLevel]
  const beltColor = BELT_COLORS[beltLevel]

  const stats = [
    { label: 'Shows Seen', value: profile?.shows_seen_count ?? 0, icon: Eye },
    { label: 'Venues', value: profile?.venues_visited_count ?? 0, icon: MapPin },
    { label: 'Reviews', value: profile?.reviews_written_count ?? 0, icon: MessageSquare },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 ${beltColor}`}>
          <Award size={36} />
        </div>
        <h2 className="text-white text-xl font-bold">{beltName} Belt</h2>
        <p className="text-slate-500 text-sm mt-1">
          {profile?.username ?? user?.email?.split('@')[0] ?? 'Theater Explorer'}
        </p>
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

      {beltLevel < 7 && (
        <div className="mx-4 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-white text-sm font-medium">Next: {BELT_NAMES[beltLevel + 1]} Belt</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${BELT_COLORS[beltLevel + 1]}`}>
              {BELT_NAMES[beltLevel + 1]}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <ProgressItem label="See 3 shows" done={(profile?.shows_seen_count ?? 0) >= 3} />
            <ProgressItem label="Visit 2 venues" done={(profile?.venues_visited_count ?? 0) >= 2} />
            <ProgressItem label="Write 1 review" done={(profile?.reviews_written_count ?? 0) >= 1} />
            <ProgressItem label="Complete 1 learning module" done={(progress?.learning_modules_completed?.length ?? 0) >= 1} />
          </div>
        </div>
      )}

      {progress?.belt_history && progress.belt_history.length > 0 && (
        <div className="mx-4 mb-6">
          <h3 className="text-slate-400 text-xs font-medium mb-2 px-1">Belt History</h3>
          <div className="space-y-1">
            {progress.belt_history.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`w-3 h-3 rounded-full ${BELT_COLORS[entry.belt]}`} />
                <span className="text-slate-300">{BELT_NAMES[entry.belt]} Belt</span>
                <span className="text-slate-600">·</span>
                <span>{new Date(entry.earned_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${done ? 'bg-green-400/20 text-green-400' : 'bg-slate-800 text-slate-600'}`}>
        {done ? '✓' : '○'}
      </span>
      <span className={done ? 'text-slate-300 line-through' : ''}>{label}</span>
    </div>
  )
}
