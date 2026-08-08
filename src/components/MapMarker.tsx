import type { Venue, WatchlistStatus } from '../lib/types'

const ROOM_GLYPHS: Record<string, string> = {
  institutional: '▣',
  storefront: '◧',
  experimental: '◬',
  school: '◈',
}

interface Props {
  venue: Venue
  relationship: WatchlistStatus | null
  dominantColor: string | null
  isTonight: boolean
  isSelected: boolean
  dimmed: boolean
  onClick: () => void
}

export function createMarkerElement({
  venue,
  relationship,
  dominantColor,
  isTonight,
  isSelected,
  dimmed,
  onClick,
}: Props): HTMLDivElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.top = '0'
  el.style.left = '0'
  el.style.width = '34px'
  el.style.height = '40px'
  el.style.cursor = 'pointer'
  el.style.transition = 'opacity 120ms'
  el.style.opacity = dimmed ? '0.22' : '1'

  const chip = document.createElement('div')
  chip.style.width = '30px'
  chip.style.height = '30px'
  chip.style.borderRadius = '4px'
  chip.style.backgroundColor = 'var(--bg-card)'
  chip.style.display = 'flex'
  chip.style.alignItems = 'center'
  chip.style.justifyContent = 'center'
  chip.style.fontSize = '14px'
  chip.style.boxShadow = isSelected
    ? '0 3px 8px rgba(0,0,0,.7), 0 0 12px var(--accent)'
    : '0 3px 8px rgba(0,0,0,.7)'
  chip.style.position = 'relative'

  const glyph = ROOM_GLYPHS[venue.venue_type ?? ''] ?? '◧'

  const tonightBorder = isTonight ? '2px solid var(--live)' : null

  if (relationship === 'booked') {
    chip.style.border = tonightBorder ?? '1.5px solid var(--accent)'
    chip.style.backgroundColor = 'var(--accent)'
    chip.textContent = glyph
    chip.style.color = 'var(--accent-on)'
  } else if (relationship === 'want_to_see') {
    chip.style.border = tonightBorder ?? '1.5px dashed var(--accent)'
    chip.textContent = glyph
    chip.style.color = 'var(--accent)'
  } else if (relationship === 'seen') {
    const color = dominantColor ?? 'var(--ink-dim)'
    chip.style.border = tonightBorder ?? `1.5px solid ${color}`
    chip.textContent = glyph
    chip.style.color = color
  } else {
    chip.style.border = tonightBorder ?? '1.5px solid var(--rule)'
    chip.textContent = glyph
    chip.style.color = isTonight ? 'var(--live)' : 'var(--ink-dim)'
  }

  chip.style.transition = 'transform 120ms'
  chip.style.transform = isSelected ? 'scale(1.18)' : 'scale(1)'

  el.appendChild(chip)

  // Tail
  const tail = document.createElement('div')
  tail.style.width = '6px'
  tail.style.height = '6px'
  tail.style.backgroundColor = 'var(--bg-card)'
  tail.style.transform = 'rotate(45deg)'
  tail.style.position = 'absolute'
  tail.style.left = '12px'
  tail.style.top = '29px'
  const tailBorder = tonightBorder
    ? '2px solid var(--live)'
    : chip.style.border.replace('dashed', 'solid')
  tail.style.borderRight = tailBorder
  tail.style.borderBottom = tailBorder
  el.appendChild(tail)

  el.onclick = (e) => {
    e.stopPropagation()
    onClick()
  }
  return el
}
