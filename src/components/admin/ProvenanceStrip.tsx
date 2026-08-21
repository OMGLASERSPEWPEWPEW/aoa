import type { FC } from 'react'

interface Props {
  total: number
  held: number
  empty: number
  notes: number
  lastCuratedAt: string | null
}

export const ProvenanceStrip: FC<Props> = ({ total, held, empty, notes, lastCuratedAt }) => {
  const curatedLabel = lastCuratedAt
    ? `CURATED ${new Date(lastCuratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`
    : 'NEVER CURATED'

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--rule)' }}
    >
      <div className="flex items-center gap-3 font-mono text-xs" style={{ color: 'var(--ink-dim)' }}>
        <span>{total} FIELDS</span>
        {held > 0 && <span style={{ color: 'var(--accent-text)' }}>{held} YOURS</span>}
        {empty > 0 && <span style={{ color: 'var(--danger)' }}>{empty} EMPTY</span>}
        {notes > 0 && (
          <span style={{ color: 'var(--accent-text)', cursor: 'pointer' }}>{notes} NOTES</span>
        )}
      </div>
      <span
        className="font-mono text-xs"
        style={{ color: lastCuratedAt ? 'var(--ink-faint)' : 'var(--danger)' }}
      >
        {curatedLabel}
      </span>
    </div>
  )
}
