import { useAuth } from '../contexts/AuthContext'

export function Settings() {
  const { user, signOut } = useAuth()

  return (
    <div className="p-6 text-white">
      <h2 className="text-xl font-semibold mb-6">Settings</h2>
      <div className="space-y-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-sm text-slate-400">Email</p>
          <p className="text-white">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 py-3 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
