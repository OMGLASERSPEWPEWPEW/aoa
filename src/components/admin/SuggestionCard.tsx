import type { FC } from 'react'
import type { CuratorSuggestion } from '../../lib/types'
import { preferSuggestion } from '../../lib/suggestions'

interface Props {
  suggestion: CuratorSuggestion
  currentValue: unknown
  label: string
  onAccept: () => void
  onDismiss: () => void
}

export const SuggestionCard: FC<Props> = ({ suggestion, currentValue, label, onAccept, onDismiss }) => {
  const prefer = preferSuggestion(suggestion)
  const ev = suggestion.evidence

  const evidenceLines: string[] = []
  if (ev?.events_found != null) {
    const current = ev.events_found_current ?? 0
    evidenceLines.push(`FOUND ${ev.events_found} EVENTS THERE · YOURS FOUND ${current}`)
  }
  if (ev?.confidence != null) {
    evidenceLines.push(`${ev.confidence.toFixed(2)} CONFIDENCE · IT HAS SUGGESTED THIS ${suggestion.times_suggested === 1 ? 'ONCE' : `${suggestion.times_suggested} TIMES`}`)
  }
  if (ev?.source_url) {
    evidenceLines.push(`SOURCE: ${ev.source_url}`)
  }

  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 4, overflow: 'hidden' }}>
      {/* Top: current value (yours) */}
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--accent-bg)',
          borderLeft: '3px solid var(--accent)',
        }}
      >
        <div className="font-mono text-[9px] tracking-wider" style={{ color: 'var(--accent-text)' }}>
          {label} · ⊙ YOURS · LIVE
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--ink)' }}>
          {currentValue != null ? String(currentValue) : '(empty)'}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed var(--rule)' }} />

      {/* Bottom: suggested value */}
      <div style={{ padding: '10px 12px', background: 'var(--bg-card)' }}>
        <div className="font-mono text-[9px] tracking-wider" style={{ color: 'var(--ink-dim)' }}>
          CURATOR SUGGESTS
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--ink)' }}>
          {suggestion.suggested_value != null ? String(suggestion.suggested_value) : '(empty)'}
        </div>
        {evidenceLines.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {evidenceLines.map((line, i) => (
              <div key={i} className="font-mono text-[8.5px]" style={{ color: 'var(--ink-dim)' }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--rule)' }}>
        <button
          onClick={onDismiss}
          className="min-h-[44px] flex-1 rounded font-mono text-xs"
          style={{
            background: !prefer ? 'var(--accent)' : 'var(--bg-card)',
            color: !prefer ? 'var(--bg)' : 'var(--ink)',
            border: '1px solid var(--rule)',
          }}
        >
          KEEP MINE
        </button>
        <button
          onClick={onAccept}
          className="min-h-[44px] flex-1 rounded font-mono text-xs"
          style={{
            background: prefer ? 'var(--accent)' : 'var(--bg-card)',
            color: prefer ? 'var(--bg)' : 'var(--ink)',
            border: '1px solid var(--rule)',
          }}
        >
          TAKE THEIRS
        </button>
      </div>

      {suggestion.times_suggested >= 2 && (
        <div className="px-3 pb-2 font-mono text-[8px]" style={{ color: 'var(--ink-faint)' }}>
          KEEPING YOURS TWICE STOPS IT ASKING.
        </div>
      )}
    </div>
  )
}
