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
        border: '1px solid var(--danger-border)',
        borderRadius: 4,
        padding: '16px 20px',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          ...display,
          fontSize: 15,
          fontStyle: 'italic',
          color: 'var(--danger)',
          marginBottom: 8,
          lineHeight: 1.4,
        }}
      >
        No classes found yet.{' '}
        <span style={{ color: 'var(--ink-dim)', fontStyle: 'normal' }}>
          {schoolCount} school{schoolCount !== 1 ? 's' : ''} in registry without sessions.
        </span>
      </div>
      <button
        onClick={onCurateAll}
        style={{
          ...mono,
          fontSize: 11,
          padding: '0 16px',
          minHeight: 44,
          background: 'var(--danger)',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        Curate all {schoolCount} schools
      </button>
    </div>
  )
}
