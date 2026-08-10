import type { VenueCoverageMetrics } from '../../../supabase/functions/_shared/scraper/types'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

interface Props {
  metrics: VenueCoverageMetrics
}

export function CoverageMetricsCards({ metrics }: Props) {
  const cards = [
    { label: 'AOA VENUES', value: String(metrics.total_aoa_venues) },
    { label: 'KNOWN CHICAGO', value: String(metrics.total_known_chicago || '—') },
    { label: 'COVERAGE', value: metrics.total_known_chicago ? `${metrics.coverage_pct}%` : '—' },
    { label: 'W/ CALENDAR', value: String(metrics.venues_with_calendar_url) },
    { label: 'W/ PHOTO', value: String(metrics.venues_with_photo) },
    { label: 'ZERO EVENTS', value: String(metrics.venues_zero_events) },
    { label: 'QUEUE', value: String(metrics.pending_in_queue) },
    {
      label: 'LAST RUN',
      value: metrics.last_discovery_run
        ? new Date(metrics.last_discovery_run).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Never',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--rule)',
            borderRadius: 3,
            padding: '10px 6px',
            textAlign: 'center',
          }}
        >
          <div style={{ ...mono, fontSize: 8, letterSpacing: '0.12em', color: 'var(--ink-faint)', marginBottom: 3 }}>
            {c.label}
          </div>
          <div style={{ ...mono, fontSize: 15, color: 'var(--ink)' }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}
