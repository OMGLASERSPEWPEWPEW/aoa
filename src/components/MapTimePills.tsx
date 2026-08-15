import type { TimeFilter } from '../lib/types'

const PILLS: Array<{ key: TimeFilter; label: string }> = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'month', label: 'THIS MONTH' },
]

interface Props {
  selected: TimeFilter
  onSelect: (filter: TimeFilter) => void
  counts: Record<TimeFilter, number>
}

export function MapTimePills({ selected, onSelect, counts }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        zIndex: 1060,
        padding: '0 14px',
        display: 'flex',
        gap: 6,
        justifyContent: 'center',
      }}
    >
      {PILLS.map((p) => {
        const active = selected === p.key
        return (
          <button
            key={p.key}
            onClick={() => onSelect(p.key)}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9.5,
              letterSpacing: '0.08em',
              padding: '6px 12px',
              borderRadius: 3,
              border: active ? '1px solid var(--accent)' : '1px solid var(--rule)',
              backgroundColor: active ? 'var(--accent-bg)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: active ? 'var(--accent)' : 'var(--ink-dim)',
              backdropFilter: 'blur(6px)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {p.label} ({counts[p.key]})
          </button>
        )
      })}
    </div>
  )
}
