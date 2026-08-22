export function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        backgroundColor: 'var(--bg)',
      }}
    >
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--ink-faint)',
        }}
      >
        loading
      </span>
    </div>
  )
}
