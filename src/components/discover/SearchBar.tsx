export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div style={{ position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--ink-ghost)',
          fontSize: 14,
        }}
      >
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="A play, a theater, a feeling..."
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--ink)',
          border: '1px solid var(--rule)',
          borderRadius: 3,
          paddingLeft: 34,
          paddingRight: 16,
          paddingTop: 10,
          paddingBottom: 10,
          fontFamily: "'Courier Prime', monospace",
          fontSize: 16,
          outline: 'none',
        }}
      />
    </div>
  )
}
