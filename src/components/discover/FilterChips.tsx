export interface FilterChipsProps {
  eventTypes: readonly string[]
  venueTypes: readonly string[]
  activeEventType: string
  activeVenueType: string
  onEventTypeChange: (type: string) => void
  onVenueTypeChange: (type: string) => void
}

export function FilterChips({
  eventTypes,
  venueTypes,
  activeEventType,
  activeVenueType,
  onEventTypeChange,
  onVenueTypeChange,
}: FilterChipsProps) {
  return (
    <>
      <div className="flex gap-1.5" style={{ marginTop: 8, overflowX: 'auto' }}>
        {eventTypes.map(type => (
          <button
            key={type}
            onClick={() => onEventTypeChange(type)}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9.5,
              letterSpacing: '0.06em',
              padding: '5px 10px',
              borderRadius: 2,
              border: activeEventType === type ? '1px solid var(--accent)' : '1px solid var(--rule)',
              backgroundColor: activeEventType === type ? 'var(--accent-bg)' : 'transparent',
              color: activeEventType === type ? 'var(--accent)' : 'var(--ink-faint)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {type === 'all' ? 'All' : type + 's'}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5" style={{ marginTop: 6, overflowX: 'auto' }}>
        {venueTypes.map(type => (
          <button
            key={type}
            onClick={() => onVenueTypeChange(type)}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9.5,
              letterSpacing: '0.06em',
              padding: '5px 10px',
              borderRadius: 2,
              border: activeVenueType === type ? '1px solid var(--accent)' : '1px solid var(--rule)',
              backgroundColor: activeVenueType === type ? 'var(--accent-bg)' : 'transparent',
              color: activeVenueType === type ? 'var(--accent)' : 'var(--ink-faint)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {type === 'all' ? 'All Venues' : type}
          </button>
        ))}
      </div>
    </>
  )
}
