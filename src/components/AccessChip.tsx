const ACCESS_LABELS = new Set([
  'PAY-WHAT-YOU-CAN', 'FREE', 'USHER', 'ASL',
  'RELAXED', 'AUDIO DESCRIBED', 'OPEN CAPTION', 'TOUCH TOUR',
])

export function AccessChip({ label }: { label: string }) {
  const upper = label.toUpperCase()
  const isAccess = ACCESS_LABELS.has(upper)

  return (
    <span
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9.5,
        letterSpacing: '0.1em',
        padding: '3px 8px',
        borderRadius: 2,
        textTransform: 'uppercase',
        color: isAccess ? 'oklch(0.68 0.13 150)' : '#9c9586',
        border: isAccess ? '1px solid oklch(0.36 0.07 150)' : '1px solid #2b2720',
      }}
    >
      {upper}
    </span>
  )
}
