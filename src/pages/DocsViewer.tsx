import { useParams, Link, Navigate } from 'react-router-dom'

const pages: Record<string, { file: string; title: string }> = {
  landscape: { file: 'competitive-analysis.html', title: 'The Landscape' },
  pitch: { file: 'pitch-deck.html', title: 'The Pitch Deck' },
  map: { file: 'map.html', title: 'The Map' },
  house: { file: 'house-record.html', title: 'The House Record' },
}

export function DocsViewer() {
  const { page } = useParams<{ page: string }>()
  const entry = page ? pages[page] : undefined

  if (!entry) return <Navigate to="/app/admin" replace />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid var(--rule)',
          flexShrink: 0,
        }}
      >
        <Link
          to="/app/admin"
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          ← Admin
        </Link>
        <span
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--ink-dim)',
          }}
        >
          {entry.title}
        </span>
      </div>
      <iframe
        src={`/prototypes/${entry.file}`}
        title={entry.title}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          backgroundColor: '#08070a',
        }}
      />
    </div>
  )
}
