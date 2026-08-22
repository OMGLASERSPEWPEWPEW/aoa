interface DropWellProps {
  visible: boolean
  onDrop: () => void
}

export function DropWell({ visible, onDrop }: DropWellProps) {
  if (!visible) return null

  return (
    <div
      onClick={onDrop}
      style={{
        height: '46px',
        border: '1px dashed var(--accent-border)',
        borderRadius: '3px',
        background: 'var(--accent-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '4px 0',
      }}
    >
      <span style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: '8.5px',
        letterSpacing: '0.14em',
        color: 'var(--accent-text)',
      }}>
        DROP HERE
      </span>
    </div>
  )
}
