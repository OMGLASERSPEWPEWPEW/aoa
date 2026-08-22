const mono = { fontFamily: "'Courier Prime', monospace" } as const
const display = { fontFamily: "'Newsreader', serif" } as const

interface AuditRowData {
  id: string
  name: string
  venue_type?: string
  neighborhood?: string | null
  diagnosis: { kind: string; label: string; severity: string }
  event_count?: number
  session_count?: number
  consecutive_failures?: number
  domain?: string | null
  has_open_suggestions?: boolean
}

interface AuditRowProps {
  row: AuditRowData
  onOpen: (id: string) => void
  onCurate?: (id: string) => void
  onBlock?: (id: string) => void
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'danger': return 'var(--danger)'
    case 'warn': return 'var(--accent)'
    case 'ok':
    case 'success': return 'var(--access)'
    default: return 'var(--ink-faint)'
  }
}

export function AuditRow({ row, onOpen, onCurate, onBlock }: AuditRowProps) {
  const metaSegments: string[] = []
  if (row.venue_type) metaSegments.push(row.venue_type)
  if (row.neighborhood) metaSegments.push(row.neighborhood)
  if (row.event_count !== undefined) metaSegments.push(`${row.event_count} events`)
  else if (row.session_count !== undefined) metaSegments.push(`${row.session_count} sessions`)

  // Cap at 3 segments
  const metaLine = metaSegments.slice(0, 3).join(' · ')
  const diagColor = severityColor(row.diagnosis.severity)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--rule)',
        gap: 8,
      }}
    >
      {/* Left: name + meta + diagnosis */}
      <button
        onClick={() => onOpen(row.id)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          minWidth: 0,
        }}
      >
        <div
          style={{
            ...display,
            fontSize: 15.5,
            color: 'var(--ink)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.name}
        </div>
        <div
          style={{
            ...mono,
            fontSize: 9,
            color: 'var(--ink-faint)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {metaLine}
        </div>
        <span
          style={{
            ...mono,
            fontSize: 8.5,
            color: diagColor,
            letterSpacing: '0.04em',
            marginTop: 3,
            display: 'inline-block',
          }}
        >
          {row.diagnosis.label}
        </span>
        {row.consecutive_failures !== undefined && row.consecutive_failures > 0 && (
          <span
            style={{
              ...mono,
              fontSize: 8.5,
              color: 'var(--danger)',
              marginLeft: 8,
            }}
          >
            {row.consecutive_failures}x fail
          </span>
        )}
        {row.has_open_suggestions && (
          <span
            style={{
              ...mono,
              fontSize: 8.5,
              color: 'var(--accent)',
              marginLeft: 8,
            }}
          >
            suggestion
          </span>
        )}
      </button>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onCurate && (
          <button
            onClick={() => onCurate(row.id)}
            aria-label={`Curate ${row.name}`}
            title="Curate"
            style={{
              ...mono,
              height: 44,
              padding: '0 10px',
              background: 'none',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              letterSpacing: '0.06em',
              color: 'var(--accent)',
            }}
          >
            CURATE
          </button>
        )}
        {onBlock && (
          <button
            onClick={() => onBlock(row.id)}
            aria-label={`Block ${row.name}`}
            title="Block"
            style={{
              width: 44,
              height: 44,
              background: 'none',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: 'var(--danger)',
            }}
          >
            &oslash;
          </button>
        )}
      </div>
    </div>
  )
}
