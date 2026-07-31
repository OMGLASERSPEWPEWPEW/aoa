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
    <div style={{ display: 'flex', borderTop: '1px solid #2b2720', borderBottom: '1px solid #2b2720' }}>
      {CELLS.map((cell, i) => (
        <div
          key={cell.key}
          data-testid="stat-cell"
          style={{
            flex: 1,
            padding: '14px 0',
            textAlign: 'center',
            borderLeft: i > 0 ? '1px solid #2b2720' : undefined,
          }}
        >
          <div
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 24,
              color: cell.key === 'ushered' ? 'oklch(0.68 0.13 150)' : 'var(--ink)',
            }}
          >
            {values[cell.key]}
          </div>
          <div
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: '#625b4c',
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
