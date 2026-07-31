import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWatchlist } from '../hooks/useWatchlist'
import { EmotionWheel } from '../components/EmotionWheel'
import { RoomVolumeSelector } from '../components/RoomVolumeSelector'
import type { Emotion, RoomVolume } from '../lib/emotions'
import type { Event, Venue } from '../lib/types'

export function LogShow() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { updateStatus } = useWatchlist()

  const [event, setEvent] = useState<(Event & { venue?: Venue }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [emotions, setEmotions] = useState<Emotion[]>([])
  const [volume, setVolume] = useState<RoomVolume | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!eventId) return
    supabase
      .from('events')
      .select('*, venue:venues(*)')
      .eq('id', eventId)
      .single()
      .then(({ data }) => {
        setEvent(data as Event & { venue?: Venue })
        setLoading(false)
      })
  }, [eventId])

  const writeWatchlist = async () => {
    if (!eventId || emotions.length === 0) return
    setSaving(true)
    await updateStatus(eventId, 'seen', {
      emotions,
      room_volume: volume,
      seen_date: new Date().toISOString().split('T')[0],
    })
  }

  const handleNext = async () => {
    await writeWatchlist()
    navigate(`/app/log/${eventId}/review`, {
      replace: true,
      state: { emotions, volume, event },
    })
  }

  const handleJustLog = async () => {
    await writeWatchlist()
    navigate('/app/watchlist', { replace: true })
  }

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const venueName = event.venue?.name?.toUpperCase() ?? ''

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex justify-between items-center px-5 pt-5 pb-3">
        <button
          onClick={() => navigate(-1)}
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 11,
            letterSpacing: '0.06em',
            color: '#9c9586',
            textTransform: 'uppercase',
          }}
        >
          CANCEL
        </button>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: '#625b4c',
            textTransform: 'uppercase',
          }}
        >
          STEP 1 OF 2
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="mb-6">
          <p
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
            }}
          >
            {dateStr} · {venueName}
          </p>
          <h1
            className="mt-1"
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 27,
              fontWeight: 400,
              color: 'var(--ink)',
              lineHeight: 1.15,
            }}
          >
            {event.title}
          </h1>
        </div>

        <p
          className="mb-6"
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 15,
            color: '#9c9586',
          }}
        >
          So. What did it do to you?
        </p>

        <EmotionWheel selected={emotions} onChange={setEmotions} />

        <div className="mt-8 mb-6">
          <p
            className="mb-3"
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: '#625b4c',
              textTransform: 'uppercase',
            }}
          >
            How loud was the room?
          </p>
          <RoomVolumeSelector value={volume} onChange={setVolume} />
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        <button
          onClick={handleNext}
          disabled={saving || emotions.length === 0}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 8,
            backgroundColor: emotions.length > 0 ? 'var(--accent)' : '#2b2720',
            color: emotions.length > 0 ? 'var(--bg)' : '#625b4c',
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: 400,
            transition: 'background-color 200ms, color 200ms',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Logging...' : 'Next — say a little more →'}
        </button>
        <button
          onClick={handleJustLog}
          disabled={saving || emotions.length === 0}
          className="w-full text-center"
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: '#625b4c',
            textTransform: 'uppercase',
            padding: '8px 0',
          }}
        >
          JUST LOG IT
        </button>
      </div>
    </div>
  )
}
