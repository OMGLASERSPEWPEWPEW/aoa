import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useReviews } from '../hooks/useReviews'
import { base, fill, bright, emotionBySlug, type Emotion, type RoomVolume } from '../lib/emotions'
import type { Event, Venue } from '../lib/types'

const PROMPTS = [
  'What surprised you?',
  'One image you\'ll keep',
  'Who should go?',
] as const

interface LocationState {
  emotions: Emotion[]
  volume: RoomVolume | null
  event: Event & { venue?: Venue }
}

export function WriteReview() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const { submitReview } = useReviews(eventId ?? '')

  const [prompt, setPrompt] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [spoilers, setSpoilers] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!state || !eventId) {
    navigate('/app/watchlist', { replace: true })
    return null
  }

  const { emotions, event } = state
  const venueName = event.venue?.name ?? 'the venue'

  const handlePost = async () => {
    if (!body.trim()) return
    setSaving(true)
    await submitReview({
      title: '',
      body: body.trim(),
      contains_spoilers: spoilers,
      emotions,
      prompt: prompt ?? undefined,
    })
    navigate('/app/watchlist', { replace: true })
  }

  const handleJustLog = () => {
    navigate('/app/watchlist', { replace: true })
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="flex justify-between items-center px-5 py-4"
        style={{ borderBottom: '1px solid var(--rule)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--ink-dim)',
            textTransform: 'uppercase',
          }}
        >
          ← BACK
        </button>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--ink-faint)',
            textTransform: 'uppercase',
          }}
        >
          STEP 2 OF 2
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-5">
        {/* Emotion Pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {emotions.map(slug => {
            const e = emotionBySlug(slug)
            return (
              <span
                key={slug}
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '4px 10px',
                  borderRadius: 14,
                  border: `1px solid ${base(e)}`,
                  backgroundColor: fill(e),
                  color: bright(e),
                }}
              >
                {e.label}
              </span>
            )
          })}
          <button
            onClick={() => navigate(-1)}
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9.5,
              color: 'var(--ink-ghost)',
            }}
          >
            edit
          </button>
        </div>

        {/* Prompt Selection */}
        <p
          className="mb-3"
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--ink-faint)',
            textTransform: 'uppercase',
          }}
        >
          PICK A PROMPT, OR JUST TALK
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {PROMPTS.map(p => {
            const isSelected = prompt === p
            return (
              <button
                key={p}
                onClick={() => setPrompt(isSelected ? null : p)}
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10.5,
                  padding: '6px 11px',
                  borderRadius: 14,
                  border: isSelected ? 'none' : '1px solid var(--rule)',
                  backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? 'var(--accent-on)' : 'var(--ink-dim)',
                  transition: 'all 150ms',
                }}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Editor Well */}
        <div
          style={{
            border: '1px solid var(--rule)',
            borderRadius: 3,
            backgroundColor: 'var(--bg-card)',
            padding: 16,
            minHeight: 236,
          }}
        >
          {prompt && (
            <p
              className="mb-3"
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'var(--accent)',
                textTransform: 'uppercase',
              }}
            >
              {prompt}
            </p>
          )}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Start writing..."
            className="w-full bg-transparent border-none outline-none resize-none"
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--ink)',
              caretColor: 'var(--accent)',
              minHeight: prompt ? 190 : 220,
            }}
          />
        </div>

        {/* Spoiler Toggle + Character Count */}
        <div className="flex items-center justify-between mt-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSpoilers(!spoilers)}
              className="relative"
              style={{
                width: 38,
                height: 22,
                borderRadius: 11,
                backgroundColor: spoilers ? 'var(--accent-bg)' : 'var(--rule)',
                transition: 'background-color 160ms ease',
                flexShrink: 0,
              }}
              role="switch"
              aria-checked={spoilers}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: spoilers ? undefined : 2,
                  right: spoilers ? 2 : undefined,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: spoilers ? 'var(--accent)' : 'var(--ink-faint)',
                  transition: 'all 160ms ease',
                }}
              />
            </button>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 10.5,
                color: 'var(--ink-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              CONTAINS SPOILERS
            </span>
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              color: 'var(--ink-ghost)',
            }}
          >
            {body.length}
          </span>
        </div>

        {/* Privacy Note */}
        <div
          className="py-3"
          style={{ borderTop: '1px dotted var(--rule)' }}
        >
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 13.5,
              color: 'var(--ink-faint)',
              lineHeight: 1.45,
            }}
          >
            Goes on your record and to your people. {venueName} sees the count, never your name.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex gap-3 px-5 pb-5 pt-3"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        <button
          onClick={handleJustLog}
          disabled={saving}
          style={{
            width: 96,
            height: 50,
            borderRadius: 6,
            border: '1px solid var(--rule)',
            backgroundColor: 'transparent',
            fontFamily: "'Courier Prime', monospace",
            fontSize: 11,
            color: 'var(--ink-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          JUST LOG IT
        </button>
        <button
          onClick={handlePost}
          disabled={saving || !body.trim()}
          style={{
            flex: 1,
            height: 50,
            borderRadius: 6,
            backgroundColor: body.trim() ? 'var(--accent)' : 'var(--rule)',
            color: body.trim() ? 'var(--accent-on)' : 'var(--ink-faint)',
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: 400,
            transition: 'background-color 200ms, color 200ms',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Posting...' : 'Post to the house'}
        </button>
      </div>
    </div>
  )
}
