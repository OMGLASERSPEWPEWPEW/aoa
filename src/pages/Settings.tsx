import { useAuth } from '../contexts/AuthContext'

export function Settings() {
  const { user, signOut } = useAuth()

  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 22,
          color: 'var(--ink)',
          marginBottom: 24,
        }}
      >
        Settings
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            backgroundColor: '#141109',
            border: '1px solid #2b2720',
            borderRadius: 3,
            padding: 16,
          }}
        >
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: '0.1em', color: '#625b4c', marginBottom: 4 }}>
            EMAIL
          </p>
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, color: 'var(--ink)' }}>
            {user?.email}
          </p>
        </div>
        <button
          onClick={signOut}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 3,
            backgroundColor: 'oklch(0.20 0.05 35)',
            border: '1px solid oklch(0.35 0.10 35)',
            color: 'oklch(0.66 0.19 35)',
            fontFamily: "'Courier Prime', monospace",
            fontSize: 12,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  )
}
