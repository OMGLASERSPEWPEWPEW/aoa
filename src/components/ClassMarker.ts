import type { Discipline, SchoolWithSession } from '../lib/types'
import { isEnrolling } from '../lib/classData'

const DISCIPLINE_COLORS: Record<Discipline, string> = {
  improv: 'oklch(.80 .16 110)',
  acting: 'oklch(.64 .19 20)',
  // Reserved hues for future disciplines:
  // writing: 'oklch(.68 .13 235)', musical: 'oklch(.68 .18 330)',
  // devised: 'oklch(.72 .14 165)', youth: 'oklch(.78 .15 65)',
}

const DISCIPLINE_GLYPHS: Record<Discipline, string> = {
  improv: '◍',
  acting: '▭',
  // Reserved glyphs: writing ✎, musical ♪, devised ◎, youth ★
}

export { DISCIPLINE_COLORS, DISCIPLINE_GLYPHS }

function formatStartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  return `${month} ${d.getDate()}`
}

interface Props {
  school: SchoolWithSession
  isSelected: boolean
  dimmed: boolean
  onClick: () => void
}

export function createClassMarkerElement({ school, isSelected, dimmed, onClick }: Props): HTMLDivElement {
  const dc = DISCIPLINE_COLORS[school.discipline]
  const glyph = DISCIPLINE_GLYPHS[school.discipline]
  const enrolling = isEnrolling(school.next_session)

  const el = document.createElement('div')
  el.className = 'cm'
  el.style.position = 'absolute'
  el.style.top = '0'
  el.style.left = '0'
  el.style.width = '56px'
  el.style.height = '56px'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.alignItems = 'center'
  el.style.cursor = 'pointer'
  el.style.transition = 'opacity 120ms'
  el.style.opacity = dimmed ? '0.22' : '1'

  const ring = document.createElement('div')
  ring.className = 'ring'
  ring.style.width = '38px'
  ring.style.height = '38px'
  ring.style.borderRadius = '50%'
  ring.style.display = 'flex'
  ring.style.alignItems = 'center'
  ring.style.justifyContent = 'center'
  ring.style.fontSize = '16px'
  ring.style.transition = 'transform 120ms'
  ring.textContent = glyph

  if (enrolling) {
    ring.style.background = 'var(--bg)'
    ring.style.border = `2px solid ${dc}`
    ring.style.color = dc
    ring.style.boxShadow = `0 3px 10px rgba(0,0,0,.45), 0 0 15px -4px ${dc}`
  } else {
    ring.style.background = 'var(--bg)'
    ring.style.border = '2px dashed var(--ink-ghost)'
    ring.style.color = 'var(--ink-faint)'
    ring.style.boxShadow = '0 3px 10px rgba(0,0,0,.45)'
  }

  if (isSelected) {
    ring.style.transform = 'scale(1.16)'
    ring.style.boxShadow = `0 0 0 5px color-mix(in srgb, ${dc} 18%, transparent), 0 4px 12px rgba(0,0,0,.8)`
  }

  el.appendChild(ring)

  // Label
  const lab = document.createElement('div')
  lab.className = 'lab'
  lab.style.marginTop = '2px'
  lab.style.fontFamily = "'Courier Prime', monospace"
  lab.style.fontSize = '8px'
  lab.style.letterSpacing = '0.06em'
  lab.style.background = 'color-mix(in srgb, var(--bg) 90%, transparent)'
  lab.style.border = '1px solid var(--rule)'
  lab.style.padding = '1px 5px'
  lab.style.borderRadius = '2px'
  lab.style.whiteSpace = 'nowrap'
  lab.style.color = enrolling ? dc : 'var(--ink-faint)'
  lab.textContent = school.short_name
  el.appendChild(lab)

  // Start date badge (enrolling only)
  if (enrolling && school.next_session?.starts_on) {
    const soon = document.createElement('div')
    soon.className = 'soon'
    soon.style.position = 'absolute'
    soon.style.right = '6px'
    soon.style.top = '-3px'
    soon.style.fontFamily = "'JetBrains Mono', monospace"
    soon.style.fontSize = '8px'
    soon.style.color = 'var(--accent-on)'
    soon.style.background = dc
    soon.style.borderRadius = '2px'
    soon.style.padding = '1px 3px'
    soon.style.lineHeight = '1.2'
    soon.textContent = formatStartDate(school.next_session.starts_on)
    el.appendChild(soon)
  }

  el.onclick = (e) => {
    e.stopPropagation()
    onClick()
  }

  return el
}
