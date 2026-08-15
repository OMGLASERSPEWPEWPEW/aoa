import type { TrendBucket } from '../../lib/types'

interface Props {
  city: string
  waitingCount: number
  trend?: TrendBucket[]
  hasActiveProduction: boolean
}

export function WaitingBlock({ city, waitingCount, trend, hasActiveProduction }: Props) {
  return (
    <div
      style={{
        margin: '0 20px 14px', padding: '14px 15px',
        border: '1px solid var(--accent-border)',
        backgroundColor: 'var(--accent-bg)', borderRadius: 3,
      }}
    >
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
            letterSpacing: '0.18em', color: 'var(--accent-text)',
          }}
        >
          WAITING IN {city.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
            color: 'var(--accent-text)',
          }}
        >
          {waitingCount.toLocaleString()}
        </span>
      </div>

      {/* 8-bar trend (unstaged only) */}
      {trend && trend.length > 0 && !hasActiveProduction && (
        <TrendBars trend={trend} />
      )}

      <p
        style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: 14.5,
          lineHeight: 1.45, color: 'var(--ink-dim)', margin: 0,
        }}
      >
        {waitingCount === 0
          ? 'Be the first to say you want this one.'
          : hasActiveProduction
            ? 'Someone announced it — see below.'
            : `${waitingCount.toLocaleString()} ${waitingCount === 1 ? 'person' : 'people'} in ${city} ${waitingCount === 1 ? 'wants' : 'want'} this.`}
      </p>

      {hasActiveProduction && (
        <div
          className="flex items-center gap-2"
          style={{ borderTop: '1px dotted var(--rule)', marginTop: 10, paddingTop: 10 }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--live)' }} />
          <span
            style={{
              fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
              letterSpacing: '0.08em', color: 'var(--accent-text)',
            }}
          >
            SOMEONE ANNOUNCED IT — SEE BELOW
          </span>
        </div>
      )}
    </div>
  )
}

function TrendBars({ trend }: { trend: TrendBucket[] }) {
  const max = Math.max(...trend.map(t => t.count), 1)

  return (
    <div className="flex items-end" style={{ gap: 3, height: 34, marginBottom: 10 }}>
      {trend.map((t, i) => {
        const pct = (t.count / max) * 100
        const progress = trend.length > 1 ? i / (trend.length - 1) : 1
        return (
          <div
            key={t.month}
            style={{
              flex: 1,
              height: `${Math.max(pct, 4)}%`,
              borderRadius: 1,
              backgroundColor: `oklch(${(0.80 + progress * 0.12).toFixed(2)} ${(0.06 + progress * 0.08).toFixed(2)} 55)`,
            }}
          />
        )
      })}
    </div>
  )
}
