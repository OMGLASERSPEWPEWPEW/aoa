import { useAuth } from '../contexts/AuthContext'

const BELT_COLORS: Record<number, { name: string; color: string }> = {
  0: { name: 'White Belt', color: 'bg-white' },
  1: { name: 'Yellow Belt', color: 'bg-yellow-400' },
  2: { name: 'Orange Belt', color: 'bg-orange-500' },
  3: { name: 'Green Belt', color: 'bg-green-500' },
  4: { name: 'Blue Belt', color: 'bg-blue-500' },
  5: { name: 'Purple Belt', color: 'bg-purple-500' },
  6: { name: 'Brown Belt', color: 'bg-amber-800' },
  7: { name: 'Black Belt', color: 'bg-slate-900 border border-slate-600' },
}

export function Profile() {
  const { user } = useAuth()
  const beltLevel = 0
  const belt = BELT_COLORS[beltLevel]

  return (
    <div className="flex flex-col items-center p-6 text-white">
      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold text-amber-400 mb-4">
        {user?.email?.[0]?.toUpperCase() ?? '?'}
      </div>
      <h2 className="text-lg font-semibold mb-1">{user?.email}</h2>
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-4 h-4 rounded-full ${belt.color}`} />
        <span className="text-sm text-slate-400">{belt.name}</span>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs text-center">
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-2xl font-bold text-amber-400">0</p>
          <p className="text-xs text-slate-500">Shows Seen</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-2xl font-bold text-amber-400">0</p>
          <p className="text-xs text-slate-500">Venues</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-2xl font-bold text-amber-400">0</p>
          <p className="text-xs text-slate-500">Reviews</p>
        </div>
      </div>
    </div>
  )
}
