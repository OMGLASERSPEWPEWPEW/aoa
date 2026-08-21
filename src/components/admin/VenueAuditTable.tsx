import type { AuditVenue } from '../../lib/types'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

interface Props {
  venues: AuditVenue[]
  sort: string
  setSort: (s: string) => void
  filters: { missingCalendar: boolean; missingPhoto: boolean; zeroEvents: boolean }
  setFilters: (f: Partial<Props['filters']>) => void
  onBlock?: (venue: AuditVenue) => void // SCAFFOLD: removed by acr-6a-tiles-audit
}

export function VenueAuditTable({ venues, sort, setSort, filters, setFilters, onBlock }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
          Venue Audit ({venues.length})
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['missingCalendar', 'missingPhoto', 'zeroEvents'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilters({ [f]: !filters[f] })}
              style={{
                ...mono,
                fontSize: 9,
                padding: '3px 8px',
                border: '1px solid var(--rule)',
                borderRadius: 2,
                background: filters[f] ? 'var(--accent)' : 'none',
                color: filters[f] ? 'var(--accent-on)' : 'var(--ink-faint)',
                cursor: 'pointer',
              }}
            >
              {f === 'missingCalendar' ? 'NO CAL' : f === 'missingPhoto' ? 'NO PHOTO' : '0 EVENTS'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--rule)' }}>
              {[
                { key: 'name', label: 'Name' },
                { key: 'venue_type', label: 'Type' },
                { key: 'event_count_asc', label: 'Events' },
                { key: 'source', label: 'Source' },
              ].map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sort === col.key || sort === `${col.key}_asc` ? 'ascending' : sort === `${col.key}_desc` ? 'descending' : undefined}
                  onClick={() => setSort(sort === col.key || sort === `${col.key}_asc` ? `${col.key}_desc` : `${col.key}_asc`)}
                  style={{
                    ...mono,
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: 'var(--ink-faint)',
                    textAlign: 'left',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                </th>
              ))}
              <th scope="col" style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', padding: '6px 4px', textAlign: 'center' }}>Cal</th>
              <th scope="col" style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', padding: '6px 4px', textAlign: 'center' }}>Pic</th>
              {/* SCAFFOLD: removed by acr-6a-tiles-audit */}
              {onBlock && <th scope="col" style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', padding: '6px 4px' }} />}
            </tr>
          </thead>
          <tbody>
            {venues.slice(0, 50).map((v) => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--rule-soft, var(--rule))' }}>
                <td style={{ padding: '6px 8px', color: 'var(--ink)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name}
                </td>
                <td style={{ ...mono, padding: '6px 8px', fontSize: 10, color: 'var(--ink-dim)' }}>{v.venue_type}</td>
                <td style={{ ...mono, padding: '6px 8px', fontSize: 10, color: v.event_count === 0 ? 'var(--accent)' : 'var(--ink-dim)', textAlign: 'center' }}>
                  {v.event_count}
                </td>
                <td style={{ ...mono, padding: '6px 8px', fontSize: 10, color: 'var(--ink-dim)' }}>{v.source}</td>
                <td style={{ textAlign: 'center', padding: '6px 4px' }}>{v.has_calendar_url ? '✓' : '—'}</td>
                <td style={{ textAlign: 'center', padding: '6px 4px' }}>{v.has_photo ? '✓' : '—'}</td>
                {/* SCAFFOLD: removed by acr-6a-tiles-audit */}
                {onBlock && (
                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                    <button
                      onClick={() => onBlock(v)}
                      title="Block this source"
                      style={{
                        ...mono, fontSize: 12, width: 44, height: 44,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--danger)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      ⊘
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
