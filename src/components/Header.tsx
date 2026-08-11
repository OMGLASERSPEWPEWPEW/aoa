import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { VersionStamp } from './VersionStamp'
import { ADMINS } from '../lib/constants'

function formatNow(): string {
  const d = new Date()
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const date = d.getDate()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
  return `${day} ${month} ${date} · ${time}`
}

export function Header() {
  const { signOut } = useAuth()
  const { profile } = useProfile()
  const isAdmin = ADMINS.includes(profile?.username?.toLowerCase() ?? '')
  const [now, setNow] = useState(formatNow)

  useEffect(() => {
    const id = setInterval(() => setNow(formatNow()), 60_000)
    return () => clearInterval(id)
  }, [])

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
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link
            to="/app/admin"
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            ADMIN
          </Link>
        )}
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--ink-dim)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {now}
        </span>
        <button
          onClick={signOut}
          className="p-2 transition-colors"
          style={{ color: 'var(--ink-dim)' }}
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
