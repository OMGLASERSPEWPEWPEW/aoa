import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { VersionStamp } from './VersionStamp'

export function Header() {
  const { signOut } = useAuth()

  return (
    <header
      className="flex items-center justify-between px-5 py-3"
      style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}
    >
      <div className="flex items-baseline gap-2">
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 19,
            fontWeight: 400,
            color: 'var(--ink)',
          }}
        >
          The Art of Art
        </h1>
        <VersionStamp />
      </div>
      <button
        onClick={signOut}
        className="p-2 transition-colors"
        style={{ color: 'var(--ink-dim)' }}
        aria-label="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}
