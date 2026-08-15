import type { QueueItem } from '../../lib/types'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

interface Props {
  items: QueueItem[]
  onPromote: (item: QueueItem) => void
  onDismiss: (id: string) => void
}

export function DiscoveryQueueSection({ items, onPromote, onDismiss }: Props) {
  if (items.length === 0) {
    return (
      <div style={{ ...mono, fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
        No pending venues in discovery queue.
      </div>
    )
  }

  return (
    <div>
      <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
        Discovery Queue ({items.length} pending)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500, marginBottom: 2 }}>{item.raw_name}</div>
                {item.raw_address && (
                  <div style={{ ...mono, fontSize: 10, color: 'var(--ink-dim)' }}>{item.raw_address}</div>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                  {item.enriched_venue_type && (
                    <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', border: '1px solid var(--rule)', padding: '1px 6px', borderRadius: 2 }}>
                      {item.enriched_venue_type}
                    </span>
                  )}
                  {item.enriched_calendar_url && (
                    <span style={{ ...mono, fontSize: 9, color: 'var(--accent)' }}>Has calendar</span>
                  )}
                  {item.enriched_latitude && (
                    <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)' }}>Geocoded</span>
                  )}
                </div>
              </div>
              {item.enriched_photo_url && (
                <img
                  src={item.enriched_photo_url}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 3, objectFit: 'cover', marginLeft: 12, flexShrink: 0 }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => onPromote(item)}
                aria-label={`Promote ${item.raw_name} to live database`}
                style={{
                  ...mono,
                  fontSize: 10,
                  padding: '5px 12px',
                  background: 'var(--accent)',
                  color: 'var(--accent-on)',
                  border: 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                Promote
              </button>
              <button
                onClick={() => onDismiss(item.id)}
                aria-label={`Dismiss ${item.raw_name}`}
                style={{
                  ...mono,
                  fontSize: 10,
                  padding: '5px 12px',
                  background: 'none',
                  color: 'var(--ink-faint)',
                  border: '1px solid var(--rule)',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
