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
              border: isSelected ? '1.5px solid oklch(0.80 0.14 55)' : '1px solid #2b2720',
              backgroundColor: isSelected ? 'oklch(0.20 0.04 55)' : 'transparent',
              color: isSelected ? 'oklch(0.80 0.14 55)' : '#9c9586',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
