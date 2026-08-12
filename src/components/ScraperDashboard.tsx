import { useMemo } from 'react'
import { useScrape, type RecentVenueEntry } from '../contexts/ScrapeContext'

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
const mono = { fontFamily: "'Courier Prime', monospace" } as const

const PIPELINE_STEPS = ['FETCH', 'EXTRACT', 'TIC', 'LINKS', 'VERIFY'] as const

function inferPipelineStage(strategy: string | undefined): number {
  if (!strategy) return 1
  const s = strategy.toLowerCase()
  if (s.includes('complete') || s.includes('done')) return 5
  if (s.includes('verify')) return 4
  if (s.includes('follow') || s.includes('link')) return 3
  if (s.includes('tic') || s.includes('crossref')) return 2
  return 1
}

function ProgressArc({ processed, total }: { processed: number; total: number }) {
  const pct = total > 0 ? Math.min(processed / total, 1) : 0
  const radius = 70
  const strokeWidth = 6
  const circumference = Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 8px' }}>
      <svg width={160} height={95} viewBox="0 0 160 95">
        <path
          d={`M ${80 - radius} 85 A ${radius} ${radius} 0 0 1 ${80 + radius} 85`}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${80 - radius} 85 A ${radius} ${radius} 0 0 1 ${80 + radius} 85`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div style={{ marginTop: -60, textAlign: 'center' }}>
        <div style={{ ...serif, fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>
          {processed}
        </div>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginTop: 2 }}>
          OF {total} VENUES
        </div>
      </div>
    </div>
  )
}

function PipelineDots({ stage }: { stage: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '16px 20px' }}>
      {PIPELINE_STEPS.map((step, i) => {
        const completed = i < stage
        const active = i === stage
        const future = i > stage
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: completed ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--rule)',
                  boxShadow: active ? '0 0 8px var(--accent)' : 'none',
                  transition: 'all 0.5s ease',
                  animation: active ? 'pipeline-pulse 2s ease-in-out infinite' : undefined,
                }}
              />
              <div style={{
                ...mono,
                fontSize: 7,
                letterSpacing: '0.12em',
                color: completed ? 'var(--accent-text)' : future ? 'var(--ink-whisper)' : 'var(--ink-faint)',
                marginTop: 6,
                transition: 'color 0.5s ease',
              }}>
                {step}
              </div>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div style={{
                width: 20,
                height: 1,
                background: completed ? 'var(--accent)' : 'var(--rule)',
                marginBottom: 16,
                transition: 'background 0.5s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActivityLog({ venues }: { venues: RecentVenueEntry[] }) {
  if (venues.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 8,
      border: '1px solid var(--rule)',
      margin: '0 16px',
      maxHeight: '40vh',
      overflowY: 'auto',
    }}>
      <div style={{
        ...mono,
        fontSize: 8,
        letterSpacing: '0.12em',
        color: 'var(--ink-faint)',
        padding: '10px 14px 4px',
      }}>
        ACTIVITY LOG
      </div>
      {venues.map((v, i) => (
        <div
          key={`${v.name}-${i}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '6px 14px',
            borderTop: i > 0 ? '1px solid var(--rule-soft)' : undefined,
            opacity: i === 0 ? 1 : Math.max(0.4, 1 - i * 0.08),
          }}
        >
          <div style={{
            ...serif,
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--ink)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: 8,
          }}>
            {v.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ ...mono, fontSize: 9, color: 'var(--ink-dim)' }}>
              {v.strategy || (v.events_found > 0 ? `${v.events_found} events` : 'no events')}
            </span>
            {v.events_found > 0 && (
              <span style={{
                ...mono,
                fontSize: 7,
                letterSpacing: '0.08em',
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--accent-bg)',
                color: 'var(--accent-text)',
                border: '1px solid var(--accent-border)',
              }}>
                {v.events_found}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatsBar({ events, processed, total, startedAt }: {
  events: number; processed: number; total: number; startedAt?: string
}) {
  const timeLeft = useMemo(() => {
    if (!startedAt || processed <= 0 || total <= 0) return null
    const elapsed = Date.now() - new Date(startedAt).getTime()
    const perVenue = elapsed / processed
    const remaining = (total - processed) * perVenue
    const mins = Math.ceil(remaining / 60000)
    if (mins < 1) return '< 1m'
    return `~${mins}m`
  }, [startedAt, processed, total])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      padding: '12px 16px',
      ...mono,
      fontSize: 9,
      letterSpacing: '0.06em',
      color: 'var(--ink-faint)',
    }}>
      <span>{events} events</span>
      <span style={{ color: 'var(--rule)' }}>·</span>
      <span>{Math.round((processed / Math.max(total, 1)) * 100)}%</span>
      {timeLeft && (
        <>
          <span style={{ color: 'var(--rule)' }}>·</span>
          <span>{timeLeft} left</span>
        </>
      )}
    </div>
  )
}

export function ScraperDashboard({ onMinimize }: { onMinimize: () => void }) {
  const { scraper } = useScrape()
  const pipelineStage = inferPipelineStage(scraper.lastStrategy)
  const recentVenues = scraper.recentVenues ?? []
  const startedAt = scraper.startedAt

  const isDone = scraper.phase === 'done'
  const isError = scraper.phase === 'error'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--rule)',
        background: 'var(--bg-chrome)',
      }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-faint)' }}>
          {isDone ? 'SCRAPE COMPLETE' : isError ? 'SCRAPE ERROR' : 'SCRAPING VENUES'}
        </div>
        <button
          onClick={onMinimize}
          style={{
            ...mono,
            fontSize: 9,
            letterSpacing: '0.08em',
            color: 'var(--ink-dim)',
            background: 'none',
            border: '1px solid var(--rule)',
            borderRadius: 4,
            padding: '3px 10px',
            cursor: 'pointer',
          }}
        >
          MINIMIZE
        </button>
      </div>

      {/* Shimmer bar */}
      {scraper.phase === 'scraping' && (
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2.5s ease-in-out infinite',
        }} />
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ProgressArc processed={scraper.scraped} total={scraper.total} />

        {/* Current venue */}
        {scraper.currentVenue && scraper.phase === 'scraping' && (
          <div style={{ textAlign: 'center', padding: '4px 16px 12px' }}>
            <div style={{ ...serif, fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>
              {scraper.currentVenue}
            </div>
          </div>
        )}

        {isDone && (
          <div style={{ textAlign: 'center', padding: '4px 16px 16px' }}>
            <div style={{ ...serif, fontStyle: 'italic', fontSize: 16, color: 'var(--accent-text)' }}>
              Complete
            </div>
          </div>
        )}

        {isError && (
          <div style={{ textAlign: 'center', padding: '4px 16px 16px' }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--danger)' }}>
              {scraper.error}
            </div>
          </div>
        )}

        {scraper.phase === 'scraping' && <PipelineDots stage={pipelineStage} />}

        <div style={{ height: 12 }} />

        <ActivityLog venues={recentVenues} />
      </div>

      {/* Footer stats */}
      <div style={{ borderTop: '1px solid var(--rule)', background: 'var(--bg-chrome)' }}>
        <StatsBar
          events={scraper.events}
          processed={scraper.scraped}
          total={scraper.total}
          startedAt={startedAt}
        />
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes pipeline-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.6; transform: scale(1.3) } }
      `}</style>
    </div>
  )
}
