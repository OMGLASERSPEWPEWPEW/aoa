import { useEffect, useState } from 'react'

interface RemovedUndoStripProps {
  sessionTitle: string
  onUndo: () => void
  autoHideMs?: number
}

export function RemovedUndoStrip({ sessionTitle, onUndo, autoHideMs = 4000 }: RemovedUndoStripProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), autoHideMs)
    return () => clearTimeout(timer)
  }, [autoHideMs])

  if (!visible) return null

  return (
    <div
      className="flex items-center justify-between"
      style={{
        minHeight: '46px',
        padding: '0 12px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--rule-soft)',
      }}
    >
      <span style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: '9.5px',
        letterSpacing: '0.04em',
        color: 'var(--ink-faint)',
      }}>
        Removed {sessionTitle ? `· ${sessionTitle}` : ''}
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          minHeight: '44px',
          padding: '0 12px',
          fontFamily: "'Courier Prime', monospace",
          fontSize: '10px',
          letterSpacing: '0.04em',
          color: 'var(--accent-text)',
          background: 'none',
          border: '1px solid var(--accent-border)',
          borderRadius: '3px',
          cursor: 'pointer',
        }}
      >
        UNDO
      </button>
    </div>
  )
}
