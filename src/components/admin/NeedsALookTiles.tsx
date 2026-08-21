const mono = { fontFamily: "'Courier Prime', monospace" } as const
const data = { fontFamily: "'JetBrains Mono', monospace" } as const

interface Tile {
  key: string
  label: string
  count: number
  severity: 'neutral' | 'warn' | 'danger'
  active: boolean
}

interface NeedsALookTilesProps {
  tiles: Tile[]
  onToggle: (key: string) => void
}

function severityColor(severity: Tile['severity']): string {
  switch (severity) {
    case 'danger': return 'var(--danger)'
    case 'warn': return 'var(--accent)'
    case 'neutral': return 'var(--access)'
  }
}

function severityBg(severity: Tile['severity']): string {
  switch (severity) {
    case 'danger': return 'var(--danger-bg)'
    case 'warn': return 'var(--accent-bg)'
    case 'neutral': return 'var(--access-bg)'
  }
}

export function NeedsALookTiles({ tiles, onToggle }: NeedsALookTilesProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: 8,
      }}
    >
      {tiles.map((tile) => {
        const isEmpty = tile.count === 0
        const color = isEmpty ? 'var(--ink-faint)' : severityColor(tile.severity)
        const bg = tile.active && !isEmpty ? severityBg(tile.severity) : 'transparent'
        const borderColor = tile.active && !isEmpty ? color : 'var(--rule)'
        const borderWidth = tile.active && !isEmpty ? 1.5 : 1

        return (
          <button
            key={tile.key}
            onClick={() => onToggle(tile.key)}
            aria-pressed={tile.active}
            style={{
              minHeight: 44,
              padding: '8px 6px',
              background: bg,
              border: `${borderWidth}px solid ${borderColor}`,
              borderRadius: 3,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span style={{ ...data, fontSize: 18, color, lineHeight: 1 }}>
              {tile.count}
            </span>
            <span
              style={{
                ...mono,
                fontSize: 8.5,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isEmpty ? 'var(--ink-faint)' : 'var(--ink-dim)',
                lineHeight: 1.2,
              }}
            >
              {tile.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
