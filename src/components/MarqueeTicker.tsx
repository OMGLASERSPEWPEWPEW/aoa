interface Props {
  tonightCount: number
  under20Count: number
  openingsCount: number
}

export function MarqueeTicker({ tonightCount, under20Count, openingsCount }: Props) {
  const items = [
    `${tonightCount} CURTAINS UP TONIGHT`,
    `${under20Count} UNDER $20`,
    `${openingsCount} OPENINGS`,
  ]
  const content = items.join(' • ')

  return (
    <div
      style={{
        background: 'var(--gold-gradient)',
        borderBottom: '1px solid var(--rule)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        className="marquee-track"
        style={{
          display: 'inline-flex',
          gap: 28,
          padding: '9px 0',
          fontFamily: "'Courier Prime', monospace",
          fontSize: 10.5,
          letterSpacing: '0.14em',
          color: 'var(--accent)',
          animation: 'marquee-scroll 26s linear infinite',
        }}
      >
        <span>{content}</span>
        <span style={{ color: 'var(--ink-faint)' }}>•</span>
        <span>{content}</span>
        <span style={{ color: 'var(--ink-faint)' }}>•</span>
      </div>

      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
