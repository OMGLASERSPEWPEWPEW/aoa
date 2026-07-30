import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Header() {
  const { signOut } = useAuth()

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-white">The Art of Art</h1>
        <span className="text-[9px] text-slate-500 font-normal align-top">
          v{__APP_VERSION__}
          <span className="mx-0.5">&middot;</span>
          {new Date(__BUILD_TIME__).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      <button
        onClick={signOut}
        className="p-2 text-slate-400 hover:text-white transition-colors"
        aria-label="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}
