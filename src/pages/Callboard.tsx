export function Callboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div
        className="flex items-baseline gap-2"
        style={{ padding: '8px 20px 14px', borderBottom: '1px solid var(--rule)' }}
      >
        <span
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 26,
            color: 'var(--ink)',
          }}
        >
          The Callboard
        </span>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            color: 'var(--ink-faint)',
          }}
        >
          · what's next
        </span>
      </div>
      <div
        className="flex-1 flex items-center justify-center"
        style={{ padding: 20 }}
      >
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--ink-dim)',
            textAlign: 'center',
          }}
        >
          Your weekly call is coming soon.
        </p>
      </div>
    </div>
  )
}
