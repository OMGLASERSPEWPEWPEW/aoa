const CELLS = [
  { key: 'shows', label: 'SHOWS' },
  { key: 'venues', label: 'VENUES' },
  { key: 'wrote', label: 'WROTE' },
  { key: 'ushered', label: 'USHERED' },
] as const

interface StatStripProps {
  shows: number
  venues: number
  wrote: number
  ushered: number
}

export function StatStrip({ shows, venues, wrote, ushered }: StatStripProps) {
  const values = { shows, venues, wrote, ushered }

  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
      {CELLS.map((cell, i) => (
        <div
          key={cell.key}
          data-testid="stat-cell"
          style={{
            flex: 1,
            padding: '14px 0',
            textAlign: 'center',
            borderLeft: i > 0 ? '1px solid var(--rule)' : undefined,
          }}
        >
          <div
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 24,
              color: cell.key === 'ushered' ? 'var(--access)' : 'var(--ink)',
            }}
          >
            {values[cell.key]}
          </div>
          <div
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: 'var(--ink-faint)',
              marginTop: 2,
            }}
          >
            {cell.label}
          </div>
        </div>
      ))}
    </div>
  )
}
