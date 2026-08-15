import { useParams, useNavigate } from 'react-router-dom'
import { usePlayDetail } from '../hooks/usePlayDetail'
import { usePlayInterest } from '../hooks/usePlayInterest'
import { usePlaySpectrum } from '../hooks/usePlaySpectrum'
import { usePlayFriends } from '../hooks/usePlayFriends'
import { PlayActionBar } from '../components/play/PlayActionBar'
import { WaitingBlock } from '../components/play/WaitingBlock'
import { PlaySpectrumBlock } from '../components/play/PlaySpectrumBlock'
import { StagedProductionsBlock } from '../components/play/StagedProductionsBlock'
import { UnstagedBlock } from '../components/play/UnstagedBlock'
import { FriendSection } from '../components/play/FriendSection'

export function PlayDetail() {
  const { playId } = useParams<{ playId: string }>()
  const navigate = useNavigate()
  const interest = usePlayInterest(playId ?? '')
  const spectrum = usePlaySpectrum(playId ?? '')
  const { data, isLoading: loading } = usePlayDetail(playId)
  const { friendCount, waitingFriends } = usePlayFriends(playId ?? '')
  const play = data?.play ?? null
  const productions = data?.productions ?? []

  if (loading) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>Loading...</div>
  }
  if (!play) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>Play not found.</div>
  }

  const today = new Date().toISOString().split('T')[0]
  const hasActive = productions.some(p => p.event.end_date && p.event.end_date >= today)
  const upcoming = productions.find(p => p.event.end_date && p.event.end_date >= today)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Chrome row */}
      <div className="flex items-center justify-between" style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink)', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center' }}>
          ←
        </button>
        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-faint)' }}>THE PLAY</span>
        <span style={{ width: 44 }} />
      </div>

      {/* Title block */}
      <div style={{ padding: '14px 20px 14px' }}>
        <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 31, fontWeight: 400, lineHeight: 1.04, color: 'var(--ink)', margin: '0 0 4px' }}>
          {play.title}
        </h1>
        <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 15, color: 'var(--ink-dim)' }}>
          {play.playwright}
          {play.year_written && <span style={{ color: 'var(--ink-faint)' }}> · {play.year_written}</span>}
        </div>

        {(play.premise || play.synopsis) && (
          <div style={{ borderLeft: '3px solid var(--accent-border)', paddingLeft: 12, marginTop: 12 }}>
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.45, color: 'var(--ink)', margin: 0 }}>
              {play.premise ?? play.synopsis}
            </p>
          </div>
        )}

        {play.awards.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            {play.awards.map(award => (
              <span key={award} style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: '0.06em', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 2, padding: '2px 6px', textTransform: 'uppercase' }}>
                {award}
              </span>
            ))}
          </div>
        )}
      </div>

      <PlayActionBar
        isWaiting={interest.isWaiting}
        onWantToggle={interest.toggle}
        onLogSeen={() => { if (upcoming) navigate(`/app/log/${upcoming.event.id}`) }}
      />

      <WaitingBlock
        city="chicago"
        waitingCount={interest.waitingCount}
        trend={interest.trend.length > 0 ? interest.trend : undefined}
        hasActiveProduction={hasActive}
      />

      <PlaySpectrumBlock slices={spectrum.slices} totalCards={spectrum.totalCards} mode={hasActive ? 'staged' : 'unstaged'} />

      {hasActive ? (
        <StagedProductionsBlock productions={productions} onProductionClick={(id) => navigate(`/app/show/${id}`)} />
      ) : (
        <UnstagedBlock playTitle={play.title} playwright={play.playwright} libraryUrl={play.library_url} readPrompt={play.read_prompt} />
      )}

      <FriendSection friendCount={friendCount} waitingFriends={waitingFriends} />
    </div>
  )
}
