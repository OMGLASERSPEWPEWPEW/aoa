const mono = { fontFamily: "'Courier Prime', monospace" } as const
const display = { fontFamily: "'Newsreader', serif" } as const

interface DryPipelineCardProps {
  schoolCount: number
  onCurateAll: () => void
}

export function DryPipelineCard({ schoolCount, onCurateAll }: DryPipelineCardProps) {
  return (
    <div
      style={{
        background: 'var(--danger-bg)',
        border: '1.5px solid var(--danger)',
        borderRadius: 4,
        padding: '16px 20px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--danger)',
            display: 'inline-block',
            flexShrink: 0,
            animation: 'dry-pulse 2s ease-in-out infinite',
          }}
        />
        <span style={{ ...mono, fontSize: 9, letterSpacing: '0.18em', color: 'var(--danger)', textTransform: 'uppercase' }}>
          The pipeline is dry
        </span>
      </div>
      <div style={{ ...display, fontSize: 16, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.5, marginBottom: 12 }}>
        <span style={{ fontSize: 26 }}>{schoolCount}</span>{' '}
        school{schoolCount !== 1 ? 's' : ''} registered, none curated yet.
      </div>
      <button
        onClick={onCurateAll}
        style={{
          ...display,
          fontSize: 16,
          fontStyle: 'italic',
          width: '100%',
          minHeight: 46,
          background: 'var(--danger)',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        Curate all {schoolCount} schools
      </button>
      <style>{`
        @keyframes dry-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="dry-pulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
