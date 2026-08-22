interface ClassGroupHeaderProps {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
}

export function ClassGroupHeader({ label, count, collapsed, onToggle }: ClassGroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2"
      style={{
        padding: '7px 0 6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        minHeight: '32px',
      }}
    >
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: '8.5px',
          letterSpacing: '0.16em',
          color: 'var(--ink-dim)',
        }}
      >
        {collapsed ? '▸' : '▾'} {label}
      </span>
      <span style={{ flex: 1, height: '1px', background: 'var(--rule-soft)' }} />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: 'var(--ink-ghost)',
        }}
      >
        {count}
      </span>
    </button>
  )
}
