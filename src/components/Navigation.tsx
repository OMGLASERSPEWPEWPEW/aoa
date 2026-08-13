import { NavLink, useNavigate } from 'react-router-dom'

const tabs = [
  { to: '/app', glyph: '◉', label: 'TONIGHT', end: true },
  { to: '/app/callboard', glyph: '▥', label: 'CALLBOARD' },
  { to: '/app/lobby', glyph: '◍', label: 'LOBBY' },
  { to: '/app/you', glyph: '◇', label: 'YOU' },
]

export function Navigation() {
  const navigate = useNavigate()

  return (
    <nav
      className="flex items-center justify-around"
      style={{
        borderTop: '1px solid var(--rule)',
        backgroundColor: 'var(--bg)',
        padding: '8px 6px 22px',
      }}
    >
      {tabs.slice(0, 2).map(tab => (
        <NavSlot key={tab.to} {...tab} />
      ))}

      {/* Slot 3: Gold FAB — log a show */}
      <div className="flex justify-center" style={{ flex: 1 }}>
        <button
          onClick={() => navigate('/app/watchlist')}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 19,
            color: 'var(--accent-on)',
            border: 'none',
          }}
          aria-label="Log a show"
        >
          ✦
        </button>
      </div>

      {tabs.slice(2).map(tab => (
        <NavSlot key={tab.to} {...tab} />
      ))}
    </nav>
  )
}

function NavSlot({ to, glyph, label, end }: { to: string; glyph: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={{ flex: 1, height: 48, textDecoration: 'none' }}
      className="flex flex-col items-center justify-center"
    >
      {({ isActive }) => (
        <>
          <span style={{ fontSize: 15, color: isActive ? 'var(--accent)' : 'var(--ink-faint)' }}>
            {glyph}
          </span>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              color: isActive ? 'var(--accent)' : 'var(--ink-faint)',
              marginTop: 3,
              letterSpacing: '0.06em',
            }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}
