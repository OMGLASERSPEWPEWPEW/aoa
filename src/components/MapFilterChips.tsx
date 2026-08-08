interface Props {
  activeFilters: Set<string>
  onToggle: (filter: string) => void
  counts: Record<string, number>
}

const FILTERS = [
  { key: 'tonight', label: 'TONIGHT' },
  { key: 'under20', label: 'UNDER $20' },
  { key: 'storefront', label: 'STOREFRONT' },
  { key: 'usher', label: 'USHER SLOTS' },
  { key: 'never', label: 'NEVER BEEN' },
]

export function MapFilterChips({ activeFilters, onToggle, counts }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        zIndex: 1050,
        padding: '0 14px',
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {FILTERS.map(f => {
        const active = activeFilters.has(f.key)
        return (
          <button
            key={f.key}
            onClick={() => onToggle(f.key)}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9.5,
              letterSpacing: '0.08em',
              padding: '6px 10px',
              borderRadius: 3,
              border: active ? '1px solid var(--accent)' : '1px solid var(--rule)',
              backgroundColor: active ? 'var(--accent-bg)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: active ? 'var(--accent)' : 'var(--ink-dim)',
              backdropFilter: 'blur(6px)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {f.label}
            {counts[f.key] !== undefined && ` ${counts[f.key]}`}
          </button>
        )
      })}
    </div>
  )
}
