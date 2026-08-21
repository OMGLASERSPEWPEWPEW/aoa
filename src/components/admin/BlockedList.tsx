import type { BlockedSource } from '../../lib/types'
import { BLOCK_REASON_LABELS } from '../../lib/blocklist'

const mono = { fontFamily: "'Courier Prime', monospace" } as const
const news = { fontFamily: "'Newsreader', serif" } as const

interface BlockedListProps {
  items: BlockedSource[]
  onUnblock: (id: string) => Promise<void>
}

export function BlockedList({ items, onUnblock }: BlockedListProps) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <div style={{ ...news, fontSize: 15, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
          Nothing blocked yet.
        </div>
        <div style={{ ...mono, fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 6, lineHeight: 1.5 }}>
          Blocking a source removes it from the app<br />and stops the curator returning to it.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <div
          key={item.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: 'var(--bg-card)',
            border: '1px solid var(--rule)', borderRadius: 4,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...news, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name_snapshot ?? item.domain}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--ink-dim)', marginTop: 2 }}>
              {item.domain}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <span style={{
                ...mono, fontSize: 8, letterSpacing: '0.06em',
                padding: '2px 6px', borderRadius: 3,
                background: 'var(--danger-bg)', color: 'var(--danger)',
                textTransform: 'uppercase',
              }}>
                {BLOCK_REASON_LABELS[item.reason]}
              </span>
              <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)' }}>
                {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
          <button
            onClick={() => onUnblock(item.id)}
            style={{
              ...mono, fontSize: 9, letterSpacing: '0.08em',
              minHeight: 44, padding: '0 12px',
              background: 'none', border: '1px solid var(--rule)',
              borderRadius: 4, color: 'var(--ink-dim)', cursor: 'pointer',
              textTransform: 'uppercase', flexShrink: 0,
            }}
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  )
}
