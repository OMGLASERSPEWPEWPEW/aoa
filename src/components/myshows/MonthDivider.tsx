interface Props {
  label: string
  count: number
}

export function MonthDivider({ label, count }: Props) {
  return (
    <div className="flex items-center" style={{ padding: '12px 20px 10px', gap: 10 }}>
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 10.5,
          color: 'var(--ink-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: 'var(--rule)' }} />
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9.5,
          color: 'var(--ink-ghost)',
          whiteSpace: 'nowrap',
        }}
      >
        {count} {count === 1 ? 'SHOW' : 'SHOWS'}
      </span>
    </div>
  )
}
