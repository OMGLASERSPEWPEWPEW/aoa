interface Props {
  isWaiting: boolean
  onWantToggle: () => void
  onLogSeen: () => void
}

export function PlayActionBar({ isWaiting, onWantToggle, onLogSeen }: Props) {
  return (
    <div className="flex" style={{ padding: '0 20px 14px', gap: 9 }}>
      <button
        onClick={onWantToggle}
        aria-pressed={isWaiting}
        style={{
          flex: 1, height: 48, borderRadius: 3, cursor: 'pointer',
          fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 16,
          ...(isWaiting
            ? {
                color: 'var(--accent-text)',
                backgroundColor: 'var(--accent-bg)',
                border: '1.5px solid var(--accent)',
              }
            : {
                color: 'var(--accent-on)',
                backgroundColor: 'var(--accent)',
                border: 'none',
              }),
        }}
      >
        {isWaiting ? 'You\'re waiting ✓' : 'Want to see it'}
      </button>
      <button
        onClick={onLogSeen}
        style={{
          width: 104, height: 48, borderRadius: 3, cursor: 'pointer',
          fontFamily: "'Courier Prime', monospace", fontSize: 10,
          color: 'var(--ink-dim)', backgroundColor: 'transparent',
          border: '1px solid var(--rule)',
        }}
      >
        I'VE SEEN IT
      </button>
    </div>
  )
}
