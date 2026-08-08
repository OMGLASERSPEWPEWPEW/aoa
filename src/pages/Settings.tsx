import { Sun, Moon, Monitor } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, type ThemeMode } from '../contexts/ThemeContext'

const themeOptions: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'LIGHT', Icon: Sun },
  { mode: 'dark', label: 'DARK', Icon: Moon },
  { mode: 'system', label: 'SYSTEM', Icon: Monitor },
]

export function Settings() {
  const { user, signOut } = useAuth()
  const { mode, setMode } = useTheme()

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
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--rule)',
            borderRadius: 3,
            padding: 16,
          }}
        >
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8 }}>
            APPEARANCE
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {themeOptions.map(({ mode: m, label, Icon }) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 0',
                    borderRadius: 3,
                    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--rule)'}`,
                    backgroundColor: active ? 'var(--accent-bg)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--ink-dim)',
                    cursor: 'pointer',
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 9,
                    letterSpacing: '0.06em',
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--rule)',
            borderRadius: 3,
            padding: 16,
          }}
        >
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>
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
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
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
