import type { ClassSessionRow } from '../../lib/types'
import { ClassStatusPill } from './ClassStatusPill'
import type { HTMLAttributes } from 'react'

interface ClassRowProps {
  session: ClassSessionRow
  expanded: boolean
  onToggle: () => void
  handleProps?: HTMLAttributes<HTMLElement>
  isDragging?: boolean
}

function formatSchedule(s: ClassSessionRow): string {
  const parts: string[] = []

  if (s.day_of_week || s.schedule) {
    const day = s.day_of_week
      ? s.day_of_week.slice(0, 3).toUpperCase()
      : s.schedule?.split(',')[0]?.trim() ?? ''
    parts.push(day)
  }

  if (s.start_time && s.end_time) {
    const fmt = (t: string) => {
      const [h, m] = t.split(':')
      const hour = parseInt(h)
      const suffix = hour >= 12 ? 'P' : 'A'
      const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      return m === '00' ? `${h12}${suffix}` : `${h12}:${m}${suffix}`
    }
    parts.push(`${fmt(s.start_time)}–${fmt(s.end_time)}`)
  }

  if (s.starts_on) {
    const d = new Date(s.starts_on + 'T00:00:00')
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    parts.push(`${months[d.getMonth()]} ${d.getDate()}`)
  }

  return parts.join(' · ')
}

export function ClassRow({ session, expanded, onToggle, handleProps, isDragging }: ClassRowProps) {
  const showDiagnosis = session.diagnosis.label != null

  return (
    <div
      className="grid items-center"
      onClick={onToggle}
      style={{
        gridTemplateColumns: '16px 1fr auto 12px',
        gap: '9px',
        minHeight: '46px',
        borderBottom: expanded ? 'none' : '1px solid var(--rule-soft)',
        cursor: 'pointer',
        ...(isDragging ? {
          background: 'var(--bg)',
          border: '1px solid var(--rule)',
          borderRadius: '3px',
          padding: '0 10px',
          boxShadow: '0 10px 22px -8px rgba(0,0,0,0.4)',
          transform: 'rotate(-0.6deg)',
        } : {}),
      }}
    >
      {/* Handle */}
      <span
        {...handleProps}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: '12px',
          color: isDragging ? 'var(--ink-dim)' : 'var(--ink-ghost)',
          textAlign: 'center',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        ⠿
      </span>

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        <div className="flex items-baseline gap-1.5">
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.instructor_name ?? session.title}
          </p>
          {session.delivery === 'online' && (
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: '7.5px',
                letterSpacing: '0.08em',
                color: 'oklch(0.44 0.13 235)',
                border: '1px solid oklch(0.80 0.06 235)',
                borderRadius: '2px',
                padding: '1px 4px',
                whiteSpace: 'nowrap',
              }}
            >
              ONLINE
            </span>
          )}
        </div>
        <p
          style={{
            margin: '1px 0 0',
            fontFamily: "'Courier Prime', monospace",
            fontSize: '8.5px',
            letterSpacing: '0.02em',
            color: showDiagnosis
              ? (session.diagnosis.severity === 'danger' ? 'var(--danger)' : 'var(--ink-dim)')
              : 'var(--ink-dim)',
          }}
        >
          {showDiagnosis ? session.diagnosis.label : formatSchedule(session)}
        </p>
      </div>

      {/* Status pill */}
      <ClassStatusPill status={session.status} />

      {/* Chevron */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          color: 'var(--ink-ghost)',
        }}
      >
        {expanded ? '⌄' : '›'}
      </span>
    </div>
  )
}
