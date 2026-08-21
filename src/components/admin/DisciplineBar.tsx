const mono = { fontFamily: "'Courier Prime', monospace" } as const

// Local color lookup — does not import from ClassMarker.ts so it can be extended independently
const DISCIPLINE_COLORS: Record<string, string> = {
  improv: 'oklch(.80 .16 110)',
  acting: 'oklch(.64 .19 20)',
  writing: 'oklch(.68 .13 235)',
  musical: 'oklch(.68 .18 330)',
  devised: 'oklch(.72 .14 165)',
  youth: 'oklch(.78 .15 65)',
}

const FALLBACK_COLOR = 'var(--ink-faint)'

interface DisciplineBarProps {
  byDiscipline: Record<string, number>
  total: number
}

export function DisciplineBar({ byDiscipline, total }: DisciplineBarProps) {
  if (total === 0) return null

  const entries = Object.entries(byDiscipline).filter(([, count]) => count > 0)

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          background: 'var(--rule)',
        }}
        role="img"
        aria-label={`Discipline breakdown: ${entries.map(([k, v]) => `${k} ${v}`).join(', ')}`}
      >
        {entries.map(([discipline, count]) => {
          const pct = (count / total) * 100
          const color = DISCIPLINE_COLORS[discipline] ?? FALLBACK_COLOR
          return (
            <div
              key={discipline}
              style={{
                width: `${pct}%`,
                height: 6,
                background: color,
              }}
            />
          )
        })}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
        {entries.map(([discipline, count]) => {
          const color = DISCIPLINE_COLORS[discipline] ?? FALLBACK_COLOR
          return (
            <div key={discipline} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ ...mono, fontSize: 9, color: 'var(--ink-dim)' }}>
                {discipline} ({count})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
