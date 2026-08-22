import { useState, useCallback } from 'react'
import type { ClassSessionRow, Delivery } from '../../lib/types'
import { ClassStatusPill } from './ClassStatusPill'

interface ClassRowExpandedProps {
  session: ClassSessionRow
  onCollapse: () => void
  onEditField: (sessionId: string, field: string, value: unknown) => Promise<void>
  onRemove: (sessionId: string) => Promise<void>
}

const LEVEL_LABELS = ['NO EXPERIENCE NEEDED', 'SOME TRAINING', 'INTERMEDIATE', 'ADVANCED', 'MASTER']

function LevelPips({ level, onChange }: { level: number | null; onChange: (v: number) => void }) {
  const filled = level ?? 0
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            style={{
              width: i <= filled ? '16px' : '10px',
              height: '4px',
              borderRadius: '2px',
              background: i <= filled ? 'oklch(0.48 0.16 20)' : 'var(--rule)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </span>
      <span style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: '9px',
        letterSpacing: '0.04em',
        color: 'var(--ink-dim)',
      }}>
        {LEVEL_LABELS[(filled || 1) - 1]}
      </span>
    </div>
  )
}

function FieldLabel({ label, isHeld, isEmpty, consequence }: {
  label: string
  isHeld: boolean
  isEmpty: boolean
  consequence?: string
}) {
  return (
    <div className="flex items-baseline justify-between" style={{ marginBottom: '4px' }}>
      <span style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: '8.5px',
        letterSpacing: '0.14em',
        color: isHeld ? 'var(--accent-text)' : isEmpty ? 'var(--danger)' : 'var(--ink-faint)',
      }}>
        {isHeld && '⊙ '}{label}
      </span>
      {isEmpty && consequence && (
        <span style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: '8px',
          color: 'var(--danger)',
        }}>
          EMPTY
        </span>
      )}
    </div>
  )
}

export function ClassRowExpanded({
  session, onCollapse, onEditField, onRemove,
}: ClassRowExpandedProps) {
  const [drafts, setDrafts] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const getValue = (field: string) =>
    field in drafts ? drafts[field] : (session as unknown as Record<string, unknown>)[field]

  const isHeld = (field: string) => field in session.overrides
  const isEmpty = (field: string) => {
    const v = getValue(field)
    return v == null || v === ''
  }

  const handleSave = useCallback(async (field: string, value: unknown) => {
    setSaving(field)
    try {
      await onEditField(session.id, field, value)
      setDrafts(prev => { const next = { ...prev }; delete next[field]; return next })
    } finally {
      setSaving(null)
    }
  }, [session.id, onEditField])

  const sourcePath = session.source_url
    ? session.source_url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '')
    : null

  const deliveryValue = (getValue('delivery') ?? 'in_person') as Delivery

  return (
    <div
      style={{
        margin: '8px 0 0',
        border: '1px solid var(--accent-border)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: '3px',
        background: 'var(--accent-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Row header in accent tint */}
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: '16px 1fr auto 12px',
          gap: '9px',
          minHeight: '46px',
          padding: '0 11px',
          borderBottom: '1px solid var(--accent-border)',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--accent-text)', textAlign: 'center' }}>⠿</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.25 }}>
            {session.instructor_name ?? session.title}
          </p>
          <p style={{
            margin: '1px 0 0',
            fontFamily: "'Courier Prime', monospace",
            fontSize: '8.5px',
            color: 'var(--accent-text)',
          }}>
            {session.schedule ? `${session.day_of_week?.slice(0, 3).toUpperCase() ?? ''} ${session.start_time && session.end_time ? `${session.start_time}–${session.end_time}` : ''}`.trim() : ''}
            {session.starts_on ? ` · ${new Date(session.starts_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}` : ''}
          </p>
        </div>
        <ClassStatusPill status={session.status} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--accent-text)' }}>⌄</span>
      </div>

      {/* Field panel */}
      <div style={{ background: 'var(--bg)', padding: '12px 13px 13px' }}>
        {/* Row 1: Starts + Price */}
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '9px' }}>
          <div>
            <FieldLabel label="STARTS" isHeld={isHeld('starts_on')} isEmpty={isEmpty('starts_on')} consequence="WON'T SHOW" />
            <input
              type="date"
              value={(getValue('starts_on') as string) ?? ''}
              onChange={(e) => {
                setDrafts(prev => ({ ...prev, starts_on: e.target.value || null }))
              }}
              onBlur={() => { if ('starts_on' in drafts) handleSave('starts_on', drafts.starts_on) }}
              disabled={saving === 'starts_on'}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0 10px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12.5px',
                color: 'var(--ink)',
                background: 'var(--bg-card)',
                border: `1px solid ${isHeld('starts_on') ? 'var(--accent-border)' : 'var(--rule)'}`,
                borderRadius: '3px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <FieldLabel label="PRICE" isHeld={isHeld('price')} isEmpty={isEmpty('price')} consequence="NO PRICE ON THE SHEET" />
            {isEmpty('price') && !('price' in drafts) ? (
              <button
                type="button"
                onClick={() => setDrafts(prev => ({ ...prev, price: '' }))}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px dashed var(--danger-border)',
                  borderRadius: '3px',
                  background: 'none',
                  padding: '0 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'Newsreader, Georgia, serif',
                  fontSize: '14px',
                  color: 'var(--ink-faint)',
                }}
              >
                Add a price
              </button>
            ) : (
              <input
                type="number"
                value={getValue('price') as number ?? ''}
                onChange={(e) => setDrafts(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : null }))}
                onBlur={() => { if ('price' in drafts) handleSave('price', drafts.price) }}
                disabled={saving === 'price'}
                placeholder="$"
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0 10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12.5px',
                  color: 'var(--ink)',
                  background: 'var(--bg-card)',
                  border: `1px solid ${isHeld('price') ? 'var(--accent-border)' : 'var(--rule)'}`,
                  borderRadius: '3px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
        </div>

        {/* Row 2: Sessions + Where */}
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '9px' }}>
          <div>
            <FieldLabel label="SESSIONS" isHeld={isHeld('weeks')} isEmpty={isEmpty('weeks')} />
            <div
              className="flex items-center gap-1.5"
              style={{
                border: `1px solid ${isHeld('weeks') ? 'var(--accent-border)' : 'var(--rule)'}`,
                borderRadius: '3px',
                background: 'var(--bg-card)',
                minHeight: '44px',
                padding: '0 10px',
              }}
            >
              <input
                type="number"
                value={getValue('weeks') as number ?? ''}
                onChange={(e) => setDrafts(prev => ({ ...prev, weeks: e.target.value ? Number(e.target.value) : null }))}
                onBlur={() => { if ('weeks' in drafts) handleSave('weeks', drafts.weeks) }}
                disabled={saving === 'weeks'}
                style={{
                  width: '40px',
                  border: 'none',
                  background: 'transparent',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12.5px',
                  color: 'var(--ink)',
                  outline: 'none',
                  padding: 0,
                }}
              />
              <span style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: '9px',
                color: 'var(--ink-dim)',
              }}>
                WEEKS
              </span>
            </div>
          </div>
          <div>
            <FieldLabel label="WHERE" isHeld={isHeld('delivery')} isEmpty={false} />
            <div className="flex gap-1">
              {(['in_person', 'online'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setDrafts(prev => ({ ...prev, delivery: opt }))
                    handleSave('delivery', opt)
                  }}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: '9.5px',
                    letterSpacing: '0.04em',
                    color: deliveryValue === opt ? 'var(--bg)' : 'var(--ink-dim)',
                    background: deliveryValue === opt ? 'var(--accent)' : 'none',
                    border: deliveryValue === opt ? 'none' : '1px solid var(--rule)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {opt === 'in_person' ? 'IN PERSON' : 'ONLINE'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Instructor */}
        <div style={{ marginBottom: '9px' }}>
          <FieldLabel label="INSTRUCTOR" isHeld={isHeld('instructor_name')} isEmpty={isEmpty('instructor_name')} />
          <div
            className="flex items-center justify-between"
            style={{
              border: `1px solid ${isHeld('instructor_name') ? 'var(--accent-border)' : 'var(--rule)'}`,
              borderRadius: '3px',
              background: 'var(--bg-card)',
              minHeight: '44px',
              padding: '0 10px',
            }}
          >
            <input
              type="text"
              value={(getValue('instructor_name') as string) ?? ''}
              onChange={(e) => setDrafts(prev => ({ ...prev, instructor_name: e.target.value || null }))}
              onBlur={() => { if ('instructor_name' in drafts) handleSave('instructor_name', drafts.instructor_name) }}
              disabled={saving === 'instructor_name'}
              placeholder="Instructor name"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: '14.5px',
                color: 'var(--ink)',
                outline: 'none',
                padding: 0,
              }}
            />
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: '8px',
              letterSpacing: '0.06em',
              color: 'var(--accent-text)',
              whiteSpace: 'nowrap',
              marginLeft: '8px',
            }}>
              LINK AN ARTIST →
            </span>
          </div>
        </div>

        {/* Level pips */}
        <div style={{ marginBottom: '9px' }}>
          <FieldLabel label="WHERE IT STARTS" isHeld={isHeld('level')} isEmpty={isEmpty('level')} />
          <LevelPips
            level={getValue('level') as number | null}
            onChange={(v) => {
              setDrafts(prev => ({ ...prev, level: v }))
              handleSave('level', v)
            }}
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            minHeight: '44px',
            borderTop: '1px solid var(--rule-soft)',
            paddingTop: '4px',
          }}
        >
          <span style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: '8.5px',
            letterSpacing: '0.04em',
            color: 'var(--ink-faint)',
          }}>
            {sourcePath ? `CURATED FROM ${sourcePath}` : ''}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onRemove(session.id)}
              style={{
                minHeight: '44px',
                padding: '0 11px',
                fontFamily: "'Courier Prime', monospace",
                fontSize: '9.5px',
                letterSpacing: '0.04em',
                color: 'var(--danger)',
                background: 'none',
                border: '1px solid var(--danger-border)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              REMOVE
            </button>
            <button
              type="button"
              onClick={onCollapse}
              style={{
                minHeight: '44px',
                padding: '0 13px',
                fontFamily: "'Courier Prime', monospace",
                fontSize: '9.5px',
                letterSpacing: '0.04em',
                color: 'var(--bg)',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              DONE
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
