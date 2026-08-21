import { useState, useEffect } from 'react'
import type { BlockScope, BlockReason, BlockableEntity } from '../../lib/types'
import { BLOCK_REASON_LABELS } from '../../lib/blocklist'

const mono = { fontFamily: "'Courier Prime', monospace" } as const
const news = { fontFamily: "'Newsreader', serif" } as const

interface BlockTarget {
  entityType: BlockableEntity
  id: string
  name: string
  domain: string
  affectedEvents: number
  affectedClasses: number
}

interface BlockSheetProps {
  target: BlockTarget
  onConfirm: (scope: BlockScope, reason: BlockReason, note: string | null) => Promise<void>
  onCancel: () => void
}

const REASONS: BlockReason[] = ['aggregator', 'closed', 'duplicate', 'not_chicago', 'other']

export function BlockSheet({ target, onConfirm, onCancel }: BlockSheetProps) {
  const [reason, setReason] = useState<BlockReason | null>(null)
  const [scope, setScope] = useState<BlockScope>('entry')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (reason === 'aggregator') setScope('domain')
    else if (reason) setScope('entry')
  }, [reason])

  const handleConfirm = async () => {
    if (!reason) return
    setSubmitting(true)
    try {
      await onConfirm(scope, reason, note.trim() || null)
    } finally {
      setSubmitting(false)
    }
  }

  const affectedCount = target.entityType === 'venue' ? target.affectedEvents : target.affectedClasses
  const affectedLabel = target.entityType === 'venue' ? 'shows' : 'classes'

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg)', borderRadius: '16px 16px 0 0',
        borderTop: '1px solid var(--rule)',
        boxShadow: '0 -14px 44px rgba(0,0,0,0.18)',
        zIndex: 1001, padding: '12px 20px 24px',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Grab handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 22, height: 22, background: 'var(--danger)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>⊘</div>
          <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--danger)', textTransform: 'uppercase' }}>Block this source</span>
        </div>
        <div style={{ ...news, fontStyle: 'italic', fontSize: 25, color: 'var(--ink)', marginBottom: 2 }}>{target.name}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink-dim)', marginBottom: 20 }}>{target.domain}</div>

        {/* WHY — reason chips */}
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8, textTransform: 'uppercase' }}>Why</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={{
                ...mono, fontSize: 10, letterSpacing: '0.06em',
                minHeight: 44, display: 'inline-flex', alignItems: 'center',
                padding: '0 15px', borderRadius: 22, cursor: 'pointer',
                background: reason === r ? 'var(--danger)' : 'transparent',
                color: reason === r ? 'var(--accent-on)' : 'var(--ink-dim)',
                border: reason === r ? '1px solid var(--danger)' : '1px solid var(--rule)',
                textTransform: 'uppercase',
              }}
            >
              {BLOCK_REASON_LABELS[r]}
            </button>
          ))}
        </div>

        {reason === 'other' && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why is this being blocked?"
            style={{
              ...mono, fontSize: 11, width: '100%', minHeight: 60,
              padding: 10, borderRadius: 4, border: '1px solid var(--rule)',
              background: 'var(--bg-card)', color: 'var(--ink)',
              resize: 'vertical', marginBottom: 16,
            }}
          />
        )}

        {/* HOW WIDE — scope radios */}
        {reason && (
          <>
            <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8, textTransform: 'uppercase' }}>How wide</div>
            {([
              { value: 'domain' as BlockScope, title: 'The whole domain', sub: `NOTHING FROM ${target.domain.toUpperCase()} IS EVER CURATED AGAIN` },
              { value: 'entry' as BlockScope, title: 'Just this entry', sub: 'HIDDEN NOW, BUT THE DOMAIN CAN RETURN' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setScope(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  minHeight: 44, width: '100%', padding: '8px 0',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: scope === opt.value ? '6px solid var(--danger)' : '1.5px solid var(--rule)',
                  background: 'var(--bg)', flexShrink: 0,
                }} />
                <div>
                  <div style={{ ...news, fontSize: 15, color: 'var(--ink)' }}>{opt.title}</div>
                  <div style={{ ...mono, fontSize: 9.5, color: 'var(--ink-dim)', letterSpacing: '0.04em' }}>{opt.sub}</div>
                </div>
              </button>
            ))}

            {/* Consequences */}
            <div style={{ ...news, fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.5, margin: '16px 0' }}>
              Removes it from the map and every list
              {affectedCount > 0 ? `, drops ${affectedCount} ${affectedLabel}` : ''}
              {scope === 'domain' ? `, and adds the domain to the curator's permanent blocklist` : ''}.
              {' '}Reversible from BLOCKED.
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={onCancel}
                style={{
                  ...mono, fontSize: 11, width: 104, height: 50,
                  background: 'none', border: '1px solid var(--rule)',
                  borderRadius: 4, color: 'var(--ink-dim)', cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                style={{
                  ...news, fontStyle: 'italic', fontSize: 16, flex: 1, height: 50,
                  background: submitting ? 'var(--ink-faint)' : 'var(--danger)',
                  color: 'var(--accent-on)', border: 'none',
                  borderRadius: 4, cursor: submitting ? 'default' : 'pointer',
                }}
              >
                {submitting ? 'Blocking...' : 'Block and remove'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
