import type { SessionStatus } from '../../lib/types'

const STATUS_STYLES: Record<SessionStatus, { text: string; border: string; bg: string; dashed: boolean }> = {
  open:     { text: 'OPEN',    border: 'oklch(0.80 0.08 150)', bg: 'oklch(0.94 0.03 150)', dashed: false },
  full:     { text: 'FULL',    border: 'oklch(0.84 0.07 35)',  bg: 'oklch(0.96 0.02 35)',  dashed: false },
  waitlist: { text: 'WAITLIST', border: 'oklch(0.82 0.09 75)',  bg: 'oklch(0.95 0.03 75)',  dashed: false },
  unknown:  { text: 'UNKNOWN', border: 'var(--rule)',           bg: 'transparent',          dashed: true  },
}

export function ClassStatusPill({ status }: { status: SessionStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: '8px',
        letterSpacing: '0.06em',
        color: s.dashed ? 'var(--ink-faint)' : `oklch(0.42 0.12 ${status === 'open' ? 150 : status === 'full' ? 35 : 75})`,
        border: `1px ${s.dashed ? 'dashed' : 'solid'} ${s.border}`,
        background: s.bg,
        borderRadius: '9px',
        padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {s.text}
    </span>
  )
}
