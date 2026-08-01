import { useState, useRef, useEffect } from 'react'
import { CHANGELOG } from '../data/changelog'

const SEEN_KEY = 'aoa-changelog-seen'

function useUnread() {
  const latest = CHANGELOG[0]?.version
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) ?? '' }
    catch { return '' }
  })

  const unread = !!latest && seen !== latest

  function markRead() {
    if (!latest) return
    setSeen(latest)
    try { localStorage.setItem(SEEN_KEY, latest) }
    catch { /* quota */ }
  }

  return { unread, markRead }
}

const starPath =
  'M12 1.8 C13.1 8.2 15.8 10.9 22.2 12 C15.8 13.1 13.1 15.8 12 22.2 C10.9 15.8 8.2 13.1 1.8 12 C8.2 10.9 10.9 8.2 12 1.8 Z'

export function VersionStamp() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { unread, markRead } = useUnread()

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && unread) markRead()
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const versionText = `v${__APP_VERSION__}`

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={panelRef}>
      <button
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        aria-label={`Version ${__APP_VERSION__}. Click for changelog.`}
      >
        {unread && (
          <svg viewBox="0 0 24 24" width={10} height={10} style={{ flexShrink: 0 }}>
            <path d={starPath} fill="oklch(0.80 0.14 55)" />
          </svg>
        )}
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.06em',
            color: unread ? 'oklch(0.80 0.14 55)' : '#4f4a3e',
          }}
        >
          {versionText}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Changelog"
          style={{
            position: 'fixed',
            top: 52,
            left: 10,
            right: 10,
            maxWidth: 380,
            maxHeight: '60vh',
            overflowY: 'auto',
            borderRadius: 3,
            border: '1px solid #2b2720',
            background: '#0c0a05',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 200,
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              background: '#0c0a05',
              borderBottom: '1px solid #2b2720',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 14,
                color: '#ebe5d6',
              }}
            >
              Changelog
            </span>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9,
                color: '#4f4a3e',
              }}
            >
              LATEST {Math.min(3, CHANGELOG.length)}
            </span>
          </div>

          <div style={{ padding: '4px 14px' }}>
            {CHANGELOG.slice(0, 3).map((note, i) => (
              <div
                key={note.version}
                style={{
                  padding: '10px 0',
                  borderBottom: i < 2 ? '1px solid #2b2720' : 'none',
                }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 10,
                      color: 'oklch(0.80 0.14 55)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    v{note.version}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9,
                      color: '#4f4a3e',
                    }}
                  >
                    {note.date}
                  </span>
                  {i === 0 && (
                    <span
                      style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 8,
                        letterSpacing: '0.1em',
                        color: 'oklch(0.80 0.14 55)',
                        border: '1px solid oklch(0.42 0.09 55)',
                        padding: '1px 5px',
                        borderRadius: 2,
                      }}
                    >
                      LATEST
                    </span>
                  )}
                </div>
                <p
                  style={{
                    margin: '0 0 3px',
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: '#ebe5d6',
                  }}
                >
                  {note.title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 12,
                    color: '#9c9586',
                    lineHeight: 1.5,
                  }}
                >
                  {note.summary}
                </p>
                {note.details && (
                  <ul style={{ margin: '5px 0 0', padding: 0, listStyle: 'none' }}>
                    {note.details.map((d, j) => (
                      <li
                        key={j}
                        style={{
                          fontFamily: "'Courier Prime', monospace",
                          fontSize: 10,
                          color: '#625b4c',
                          display: 'flex',
                          gap: 5,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ flexShrink: 0 }}>·</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
