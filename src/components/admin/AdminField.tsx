import { useState, type FC } from 'react'
import type { AdminFieldModel } from '../../lib/types'

interface Props {
  model: AdminFieldModel
  draft: unknown | undefined
  onChange: (v: unknown) => void
  onRelease: () => void
}

export const AdminField: FC<Props> = ({ model, draft, onChange, onRelease }) => {
  const [editing, setEditing] = useState(false)
  const displayValue = draft !== undefined ? draft : model.value

  const borderStyle = model.state === 'held'
    ? { border: '1px solid var(--accent-border)', borderLeft: '3px solid var(--accent)', background: 'var(--accent-bg)' }
    : model.state === 'empty'
    ? { border: '1px dashed var(--rule)', background: 'transparent' }
    : { border: '1px solid var(--rule)', background: 'var(--bg-card)' }

  const chipColor = model.state === 'held'
    ? 'var(--accent-text)'
    : model.state === 'empty'
    ? 'var(--danger)'
    : 'var(--ink-faint)'

  const chipText = model.state === 'held' && model.override
    ? `YOURS · ${new Date(model.override.edited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`
    : model.state === 'empty' && model.consequence
    ? `EMPTY · ${model.consequence}`
    : 'CURATOR'

  return (
    <div className="min-h-[44px] px-4 py-3" style={borderStyle}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono tracking-wide" style={{ color: chipColor }}>
          {model.label} · {chipText}
        </span>
        {model.state === 'held' && (
          <button
            onClick={onRelease}
            className="text-xs font-mono min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ color: 'var(--ink-faint)' }}
          >
            ⋯
          </button>
        )}
      </div>

      {model.state === 'held' && model.override?.previous_value != null && (
        <div className="text-[9px] font-mono mb-1" style={{ color: 'var(--ink-dim)' }}>
          WAS {String(model.override.previous_value).toUpperCase()} · THE CURATOR WON&apos;T CHANGE THIS AGAIN
        </div>
      )}

      {model.hint && model.state === 'held' && (
        <div className="text-[9px] font-mono mb-1" style={{ color: 'var(--accent-text)' }}>
          YOURS · {model.hint}
        </div>
      )}

      {/* Field editor */}
      {model.editor === 'enum' && model.options ? (
        <div className="flex gap-2 mt-1">
          {model.options.map(opt => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="min-h-[44px] px-3 rounded font-mono text-xs flex-1"
              style={{
                background: String(displayValue) === opt ? 'var(--accent)' : 'var(--bg-card)',
                color: String(displayValue) === opt ? 'var(--bg)' : 'var(--ink)',
                border: '1px solid var(--rule)',
              }}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      ) : model.editor === 'boolean' ? (
        <button
          onClick={() => onChange(!displayValue)}
          className="min-h-[44px] w-full flex items-center justify-between px-3 rounded"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--rule)' }}
        >
          <span className="text-sm" style={{ color: 'var(--ink)' }}>
            {displayValue ? 'Yes' : 'No'}
          </span>
          <div
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: displayValue ? 'var(--accent)' : 'var(--rule)' }}
          >
            <div
              className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
              style={{
                background: 'var(--bg-card)',
                left: displayValue ? '22px' : '2px',
              }}
            />
          </div>
        </button>
      ) : model.editor === 'textarea' ? (
        <textarea
          value={String(displayValue ?? '')}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          className="w-full min-h-[44px] p-2 rounded text-sm resize-none"
          style={{
            background: editing ? 'var(--bg)' : 'transparent',
            color: displayValue ? 'var(--ink)' : 'var(--ink-faint)',
            border: editing ? '1px solid var(--accent)' : 'none',
            outline: 'none',
          }}
          placeholder={model.state === 'empty' ? model.consequence ?? '' : ''}
        />
      ) : model.editor === 'tags' ? (
        <input
          type="text"
          value={Array.isArray(displayValue) ? (displayValue as string[]).join(', ') : String(displayValue ?? '')}
          onChange={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          className="w-full min-h-[44px] p-2 rounded text-sm"
          style={{
            background: 'transparent',
            color: 'var(--ink)',
            border: 'none',
            outline: 'none',
          }}
          placeholder="tag1, tag2, tag3"
        />
      ) : model.editor === 'image' ? (
        <div
          className="h-[112px] rounded flex items-center justify-center"
          style={{
            background: displayValue ? `url(${displayValue}) center/cover` : 'transparent',
            border: displayValue ? 'none' : '1px dashed var(--rule)',
          }}
        >
          {!displayValue && (
            <span className="text-xs font-mono" style={{ color: 'var(--ink-faint)' }}>
              {model.consequence ?? 'NO PHOTO'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type={model.editor === 'url' ? 'url' : 'text'}
            value={String(displayValue ?? '')}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            className="w-full min-h-[44px] p-2 rounded text-sm"
            style={{
              background: editing ? 'var(--bg)' : 'transparent',
              color: displayValue ? 'var(--ink)' : 'var(--ink-faint)',
              border: editing ? '1px solid var(--accent)' : 'none',
              outline: 'none',
            }}
            placeholder={model.state === 'empty' ? model.consequence ?? '' : ''}
          />
          {model.maxLength && (
            <span className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--ink-dim)' }}>
              {String(displayValue ?? '').length}/{model.maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
