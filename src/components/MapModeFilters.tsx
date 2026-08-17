import type { MapMode } from '../lib/types'

const SHOWS_FILTERS = [
  { key: 'tonight', label: 'TONIGHT' },
  { key: 'under20', label: 'UNDER $20' },
  { key: 'never', label: 'NEVER BEEN' },
]

const CLASSES_FILTERS = [
  { key: 'enrolling', label: 'ENROLLING' },
  { key: 'drop_in', label: 'DROP-IN' },
  { key: 'no_experience', label: 'NO EXPERIENCE' },
]

interface Props {
  mode: MapMode
  activeFilters: Set<string>
  onToggle: (key: string) => void
  counts: Record<string, number>
}

export function MapModeFilters({ mode, activeFilters, onToggle, counts }: Props) {
  const filters = mode === 'shows' ? SHOWS_FILTERS : CLASSES_FILTERS
  const accentColor = mode === 'shows' ? 'var(--accent)' : 'oklch(.80 .16 110)'

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
    }}>
      {filters.map(f => {
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
              border: active ? `1px solid ${accentColor}` : '1px solid var(--rule)',
              background: active ? accentColor : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: active ? 'var(--accent-on)' : 'var(--ink-dim)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              minHeight: 32,
              textTransform: 'uppercase',
            }}
          >
            {f.label}
            {counts[f.key] != null && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                marginLeft: 4,
                opacity: 0.7,
              }}>
                {counts[f.key]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
