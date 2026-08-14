import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePlayInterest } from '../hooks/usePlayInterest'
import { usePlaySpectrum } from '../hooks/usePlaySpectrum'
import { PlayActionBar } from '../components/play/PlayActionBar'
import { WaitingBlock } from '../components/play/WaitingBlock'
import { PlaySpectrumBlock } from '../components/play/PlaySpectrumBlock'
import { StagedProductionsBlock } from '../components/play/StagedProductionsBlock'
import { UnstagedBlock } from '../components/play/UnstagedBlock'
import type { Play, Event } from '../lib/types'

interface ProductionRow {
  event: Event
  userSeen: boolean
  userSeenDate: string | null
}

export function PlayDetail() {
  const { playId } = useParams<{ playId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [play, setPlay] = useState<Play | null>(null)
  const [productions, setProductions] = useState<ProductionRow[]>([])
  const [loading, setLoading] = useState(true)

  const interest = usePlayInterest(playId ?? '')
  const spectrum = usePlaySpectrum(playId ?? '')

  useEffect(() => {
    if (!playId) return
    async function load() {
      const [playRes, eventsRes] = await Promise.all([
        supabase.from('plays').select('*').eq('id', playId!).single(),
        supabase
          .from('events')
          .select('*, venue:venues(*)')
          .eq('play_id', playId!)
          .order('start_date', { ascending: false }),
      ])

      setPlay(playRes.data as Play | null)
      const events = (eventsRes.data as Event[]) ?? []

      let seenEventIds = new Set<string>()
      let seenDates: Record<string, string> = {}
      if (user && events.length > 0) {
        const { data: watchlist } = await supabase
          .from('watchlist')
          .select('event_id, seen_date')
          .eq('user_id', user.id)
          .eq('status', 'seen')
          .in('event_id', events.map(e => e.id))
        for (const w of watchlist ?? []) {
          seenEventIds.add(w.event_id)
          if (w.seen_date) seenDates[w.event_id] = w.seen_date
        }
      }

      setProductions(events.map(event => ({
        event,
        userSeen: seenEventIds.has(event.id),
        userSeenDate: seenDates[event.id] ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [playId, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  if (!play) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Play not found.
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const hasActiveProduction = productions.some(p => p.event.end_date && p.event.end_date >= today)
  const upcomingProduction = productions.find(p => p.event.end_date && p.event.end_date >= today)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Chrome row */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink)',
            minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center',
          }}
        >
          ←
        </button>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 10,
            letterSpacing: '0.14em', color: 'var(--ink-faint)',
          }}
        >
          THE PLAY
        </span>
        <span style={{ width: 44 }} />
      </div>

      {/* Title block */}
      <div style={{ padding: '14px 20px 14px' }}>
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
            fontSize: 31, fontWeight: 400, lineHeight: 1.04,
            color: 'var(--ink)', margin: '0 0 4px',
          }}
        >
          {play.title}
        </h1>

        <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 15, color: 'var(--ink-dim)' }}>
          {play.playwright}
          {play.year_written && <span style={{ color: 'var(--ink-faint)' }}> · {play.year_written}</span>}
        </div>

        {/* Premise quote */}
        {(play.premise || play.synopsis) && (
          <div
            style={{
              borderLeft: '3px solid var(--accent-border)',
              paddingLeft: 12, marginTop: 12,
            }}
          >
            <p
              style={{
                fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                fontSize: 15.5, lineHeight: 1.45, color: 'var(--ink)', margin: 0,
              }}
            >
              {play.premise ?? play.synopsis}
            </p>
          </div>
        )}

        {/* Award chips */}
        {play.awards.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            {play.awards.map(award => (
              <span
                key={award}
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 9,
                  letterSpacing: '0.06em', color: 'var(--accent)',
                  border: '1px solid var(--accent-border)', borderRadius: 2,
                  padding: '2px 6px', textTransform: 'uppercase',
                }}
              >
                {award}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <PlayActionBar
        isWaiting={interest.isWaiting}
        onWantToggle={interest.toggle}
        onLogSeen={() => {
          if (upcomingProduction) {
            navigate(`/app/log/${upcomingProduction.event.id}`)
          }
        }}
      />

      {/* WAITING IN CHICAGO */}
      <WaitingBlock
        city="chicago"
        waitingCount={interest.waitingCount}
        trend={interest.trend.length > 0 ? interest.trend : undefined}
        hasActiveProduction={hasActiveProduction}
      />

      {/* EVERY ROOM spectrum */}
      <PlaySpectrumBlock
        slices={spectrum.slices}
        totalCards={spectrum.totalCards}
        mode={hasActiveProduction ? 'staged' : 'unstaged'}
      />

      {/* Staged: JUST ANNOUNCED + past productions */}
      {hasActiveProduction ? (
        <StagedProductionsBlock
          productions={productions}
          onProductionClick={(eventId) => navigate(`/app/show/${eventId}`)}
        />
      ) : (
        /* Unstaged: UNTIL SOMEBODY STAGES IT */
        <UnstagedBlock
          playTitle={play.title}
          playwright={play.playwright}
          libraryUrl={play.library_url}
          readPrompt={play.read_prompt}
        />
      )}

      {/* YOUR PEOPLE — placeholder for friend data */}
      <FriendSection playId={playId!} />
    </div>
  )
}

function FriendSection({ playId }: { playId: string }) {
  const { user } = useAuth()
  const [friendCount, setFriendCount] = useState(0)
  const [waitingFriends, setWaitingFriends] = useState(0)

  useEffect(() => {
    if (!user || !playId) return

    async function loadFriends() {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
        .eq('status', 'accepted')

      if (!friendships || friendships.length === 0) return

      const friendIds = friendships.map(f =>
        f.requester_id === user!.id ? f.addressee_id : f.requester_id
      )

      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('play_id', playId)

      if (events && events.length > 0) {
        const { count } = await supabase
          .from('watchlist')
          .select('id', { count: 'exact', head: true })
          .in('user_id', friendIds)
          .in('event_id', events.map(e => e.id))
          .eq('status', 'seen')
        setFriendCount(count ?? 0)
      }

      const { count: waitCount } = await supabase
        .from('play_interest')
        .select('id', { count: 'exact', head: true })
        .in('user_id', friendIds)
        .eq('play_id', playId)
      setWaitingFriends(waitCount ?? 0)
    }

    loadFriends()
  }, [user, playId])

  if (friendCount === 0 && waitingFriends === 0) return null

  return (
    <div style={{ padding: '14px 20px 24px', borderTop: '1px solid var(--rule)' }}>
      <span
        style={{
          fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
          letterSpacing: '0.18em', color: 'var(--ink-faint)',
          display: 'block', marginBottom: 10,
        }}
      >
        YOUR PEOPLE
      </span>
      <p
        style={{
          fontFamily: "'Courier Prime', monospace", fontSize: 10,
          color: 'var(--ink-ghost)', margin: 0,
        }}
      >
        {friendCount > 0 && `${friendCount} ${friendCount === 1 ? 'FRIEND HAS' : 'FRIENDS HAVE'} SEEN IT`}
        {friendCount > 0 && waitingFriends > 0 && ' · '}
        {waitingFriends > 0 && `${waitingFriends} ${waitingFriends === 1 ? 'IS' : 'ARE'} WAITING`}
      </p>
    </div>
  )
}
