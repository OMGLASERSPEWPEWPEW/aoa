import type { RoomVolume } from '../lib/emotions'

const OPTIONS: { value: RoomVolume; label: string }[] = [
  { value: 'murmur', label: 'A MURMUR' },
  { value: 'applause', label: 'REAL APPLAUSE' },
  { value: 'standing', label: 'EVERYONE STOOD' },
]

interface Props {
  value: RoomVolume | null
  onChange: (v: RoomVolume | null) => void
}

export function RoomVolumeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map(opt => {
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(isSelected ? null : opt.value)}
            className="flex-1 transition-colors"
            style={{
              height: 46,
              borderRadius: 3,
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10.5,
              letterSpacing: '0.04em',
              border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--rule)',
              backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
              color: isSelected ? 'var(--accent)' : 'var(--ink-dim)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
