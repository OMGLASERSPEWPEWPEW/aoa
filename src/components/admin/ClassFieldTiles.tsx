const mono = { fontFamily: "'Courier Prime', monospace" } as const
const data = { fontFamily: "'JetBrains Mono', monospace" } as const

interface ClassFieldTilesProps {
  sessionCount: number
  fields: Array<{ label: string; count: number }>
}

function fieldColor(count: number, sessionCount: number): string {
  if (count === 0) return 'var(--ink-faint)'
  if (count < sessionCount) return 'var(--danger)'
  return 'var(--access)'
}

function fieldBg(count: number, sessionCount: number): string {
  if (count === 0) return 'transparent'
  if (count < sessionCount) return 'var(--danger-bg)'
  return 'var(--access-bg)'
}

export function ClassFieldTiles({ sessionCount, fields }: ClassFieldTilesProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: 8,
      }}
    >
      {fields.map((field) => {
        const color = fieldColor(field.count, sessionCount)
        const bg = fieldBg(field.count, sessionCount)
        const borderColor = field.count === 0 ? 'var(--rule)' : color

        return (
          <div
            key={field.label}
            style={{
              minHeight: 44,
              padding: '8px 6px',
              background: bg,
              border: `1px solid ${borderColor}`,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span style={{ ...data, fontSize: 18, color, lineHeight: 1 }}>
              {field.count}
            </span>
            <span
              style={{
                ...mono,
                fontSize: 8.5,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: field.count === 0 ? 'var(--ink-faint)' : 'var(--ink-dim)',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {field.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
