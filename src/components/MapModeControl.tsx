import type { MapMode } from '../lib/types'

interface Props {
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  showCount: number
  classCount: number
}

export function MapModeControl({ mode, onModeChange, showCount, classCount }: Props) {
  const baseStyle: React.CSSProperties = {
    fontFamily: "'Courier Prime', monospace",
    fontSize: 10,
    letterSpacing: '0.1em',
    padding: '7px 13px',
    borderRadius: 2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    border: 'none',
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    textTransform: 'uppercase',
  }

  return (
    <div style={{
      display: 'inline-flex',
      background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      border: '1px solid var(--rule)',
      borderRadius: 3,
      padding: 2,
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <button
        onClick={() => onModeChange('shows')}
        style={{
          ...baseStyle,
          background: mode === 'shows' ? 'var(--accent)' : 'transparent',
          color: mode === 'shows' ? 'var(--accent-on)' : 'var(--ink-dim)',
        }}
      >
        SHOWS
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 400,
          opacity: mode === 'shows' ? 0.72 : 1,
        }}>
          {showCount}
        </span>
      </button>
      <button
        onClick={() => onModeChange('classes')}
        style={{
          ...baseStyle,
          background: mode === 'classes' ? 'oklch(.80 .16 110)' : 'transparent',
          color: mode === 'classes' ? 'var(--accent-on)' : 'var(--ink-dim)',
        }}
      >
        CLASSES
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 400,
          opacity: mode === 'classes' ? 0.72 : 1,
        }}>
          {classCount}
        </span>
      </button>
    </div>
  )
}
