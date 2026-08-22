interface ClassListHeaderProps {
  totalCount: number
  lastCuratedAt: string | null
  completeness: number
  onRecurate: () => void
  onAddByHand: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return 'NEVER'
  const d = new Date(iso)
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function ClassListHeader({
  totalCount, lastCuratedAt, completeness, onRecurate, onAddByHand,
}: ClassListHeaderProps) {
  const pct = Math.round(completeness * 100)

  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: '14px 20px 8px',
        borderTop: '1px solid var(--rule)',
        marginTop: '12px',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: '9px',
            letterSpacing: '0.18em',
            color: 'var(--ink-faint)',
          }}
        >
          CLASSES &middot;{' '}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ink)' }}>
            {totalCount}
          </span>
        </div>
        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: '8.5px',
            letterSpacing: '0.04em',
            color: 'var(--ink-faint)',
            marginTop: '2px',
          }}
        >
          CURATED {formatDate(lastCuratedAt)} &middot; {pct}% COMPLETE
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onRecurate}
          className="rounded"
          style={{
            minHeight: '44px',
            padding: '0 11px',
            fontFamily: "'Courier Prime', monospace",
            fontSize: '9.5px',
            letterSpacing: '0.04em',
            color: 'var(--ink-dim)',
            background: 'none',
            border: '1px solid var(--rule)',
            cursor: 'pointer',
          }}
        >
          RECURATE
        </button>
        <button
          type="button"
          onClick={onAddByHand}
          className="rounded"
          style={{
            minHeight: '44px',
            padding: '0 11px',
            fontFamily: "'Courier Prime', monospace",
            fontSize: '9.5px',
            letterSpacing: '0.04em',
            color: 'var(--bg)',
            background: 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + BY HAND
        </button>
      </div>
    </div>
  )
}
