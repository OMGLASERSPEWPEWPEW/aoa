const mono = { fontFamily: "'Courier Prime', monospace" } as const

interface WorkActionsProps {
  domain: 'theaters' | 'schools'
  lastRunAt: string | null
  queueCount: number
  backfillCount: number
  running: 'find' | 'curate' | null
  onFind: () => void
  onCurate: () => void
  onQueue: () => void
  onBackfill: () => void
}

function formatLastRun(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  return `LAST RUN ${month} ${day} · ${diffDays}D AGO`
}

const primaryStyle: React.CSSProperties = {
  ...mono,
  fontSize: 11,
  padding: '0 16px',
  minHeight: 44,
  background: 'var(--accent)',
  color: 'var(--accent-on)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const secondaryStyle: React.CSSProperties = {
  ...mono,
  fontSize: 11,
  padding: '0 16px',
  minHeight: 44,
  background: 'none',
  color: 'var(--ink-dim)',
  border: '1px solid var(--rule)',
  borderRadius: 3,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const disabledOpacity = 0.6

export function WorkActions({
  domain,
  lastRunAt,
  queueCount,
  backfillCount,
  running,
  onFind,
  onCurate,
  onQueue,
  onBackfill,
}: WorkActionsProps) {
  const isTheaters = domain === 'theaters'

  const findLabel = running === 'find'
    ? 'Finding...'
    : isTheaters ? 'Find venues' : 'Find schools'

  const curateLabel = running === 'curate'
    ? 'Curating...'
    : isTheaters
      ? 'Curate shows'
      : `Curate all ${queueCount} schools`

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {/* Primary: Find */}
        <button
          onClick={onFind}
          disabled={running !== null}
          style={{
            ...primaryStyle,
            opacity: running !== null ? disabledOpacity : 1,
          }}
        >
          {findLabel}
        </button>

        {/* Primary: Curate */}
        <button
          onClick={onCurate}
          disabled={running !== null}
          style={{
            ...primaryStyle,
            opacity: running !== null ? disabledOpacity : 1,
          }}
        >
          {curateLabel}
        </button>

        {/* Secondary: Backfill / Queue */}
        <button
          onClick={onBackfill}
          disabled={running !== null}
          style={{
            ...secondaryStyle,
            opacity: running !== null ? disabledOpacity : 1,
          }}
        >
          {isTheaters ? `Play backfill (${backfillCount})` : `Queue ${backfillCount}`}
        </button>

        {/* Secondary: Queue */}
        <button
          onClick={onQueue}
          disabled={running !== null}
          style={{
            ...secondaryStyle,
            opacity: running !== null ? disabledOpacity : 1,
          }}
        >
          Queue {queueCount} &rarr;
        </button>
      </div>

      {/* Last run timestamp */}
      {lastRunAt && (
        <div
          style={{
            ...mono,
            fontSize: 9,
            color: 'var(--ink-faint)',
            marginTop: 8,
            letterSpacing: '0.06em',
          }}
        >
          {formatLastRun(lastRunAt)}
        </div>
      )}
    </div>
  )
}
