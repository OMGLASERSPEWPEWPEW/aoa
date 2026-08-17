import { useScrape, type RecentSchoolEntry } from '../contexts/ScrapeContext'

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
const mono = { fontFamily: "'Courier Prime', monospace" } as const

const AMBER = '#D4A017'
const AMBER_DIM = '#8a6a10'
const AMBER_BG = '#1a1005'

const PIPELINE_STEPS = ['FETCH', 'EXTRACT', 'FOLLOW', 'VERIFY', 'SEARCH'] as const

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
          stroke={AMBER}
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
          OF {total} SCHOOLS
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
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: completed ? AMBER : active ? AMBER : 'var(--rule)',
                boxShadow: active ? `0 0 8px ${AMBER}` : 'none',
                transition: 'all 0.5s ease',
                animation: active ? 'class-pipeline-pulse 2s ease-in-out infinite' : undefined,
              }} />
              <div style={{
                ...mono, fontSize: 7, letterSpacing: '0.12em',
                color: completed ? AMBER : future ? 'var(--ink-whisper)' : 'var(--ink-faint)',
                marginTop: 6, transition: 'color 0.5s ease',
              }}>
                {step}
              </div>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div style={{
                width: 20, height: 1,
                background: completed ? AMBER : 'var(--rule)',
                marginBottom: 16, transition: 'background 0.5s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActivityLog({ schools }: { schools: RecentSchoolEntry[] }) {
  if (schools.length === 0) return null
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      <div style={{ ...mono, fontSize: 8, letterSpacing: '0.12em', color: 'var(--ink-faint)', marginBottom: 8 }}>
        RECENT SCHOOLS
      </div>
      {schools.map((s, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 0', borderBottom: '1px solid var(--rule)',
        }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--ink)' }}>{s.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {s.eventsFound > 0 && (
              <span style={{ ...mono, fontSize: 9, color: AMBER }}>{s.eventsCreated} new</span>
            )}
            <span style={{
              ...mono, fontSize: 8, letterSpacing: '0.08em',
              color: s.status === 'success' ? 'var(--ink-faint)' : '#ef4444',
            }}>
              {s.status === 'success' ? `${s.eventsFound} found` : s.status.toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatsBar({ eventsFound, eventsCreated, processed, total, newSchoolsQueued }: {
  eventsFound: number; eventsCreated: number; processed: number; total: number; newSchoolsQueued: number
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 16, padding: '12px 16px',
      ...mono, fontSize: 9, letterSpacing: '0.06em', color: 'var(--ink-faint)',
    }}>
      <span>{eventsFound} found</span>
      <span style={{ color: 'var(--rule)' }}>·</span>
      <span>{eventsCreated} created</span>
      <span style={{ color: 'var(--rule)' }}>·</span>
      <span>{total > 0 ? Math.round((processed / total) * 100) : 0}%</span>
      {newSchoolsQueued > 0 && (
        <>
          <span style={{ color: 'var(--rule)' }}>·</span>
          <span>{newSchoolsQueued} queued</span>
        </>
      )}
    </div>
  )
}

export function ClassDiscoveryDashboard({ onMinimize }: { onMinimize: () => void }) {
  const { classDiscovery: cd } = useScrape()
  const isDone = cd.phase === 'done'
  const isError = cd.phase === 'error'

  const pipelineStage = isDone ? 5 : cd.newSchoolsQueued > 0 ? 4 : cd.schoolsScraped > 0 ? 3 : 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `1px solid ${AMBER_DIM}`, background: AMBER_BG,
      }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.12em', color: AMBER }}>
          {isDone ? 'DISCOVERY COMPLETE' : isError ? 'DISCOVERY ERROR' : 'DISCOVERING CLASSES'}
        </div>
        <button onClick={onMinimize} style={{
          ...mono, fontSize: 9, letterSpacing: '0.08em', color: AMBER_DIM,
          background: 'none', border: `1px solid ${AMBER_DIM}`, borderRadius: 4,
          padding: '3px 10px', cursor: 'pointer',
        }}>
          MINIMIZE
        </button>
      </div>

      {cd.phase === 'scraping' && (
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${AMBER}, transparent)`,
          backgroundSize: '200% 100%',
          animation: 'class-shimmer 2.5s ease-in-out infinite',
        }} />
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ProgressArc processed={cd.schoolsScraped} total={cd.totalSchools || cd.schoolsScraped} />

        {cd.currentSchool && cd.phase === 'scraping' && (
          <div style={{ textAlign: 'center', padding: '4px 16px 12px' }}>
            <div style={{ ...serif, fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>
              {cd.currentSchool}
            </div>
          </div>
        )}

        {isDone && (
          <div style={{ textAlign: 'center', padding: '4px 16px 16px' }}>
            <div style={{ ...serif, fontStyle: 'italic', fontSize: 16, color: AMBER }}>
              Complete
            </div>
          </div>
        )}

        {isError && (
          <div style={{ textAlign: 'center', padding: '4px 16px 16px' }}>
            <div style={{ ...mono, fontSize: 11, color: '#ef4444' }}>
              {cd.error}
            </div>
          </div>
        )}

        {cd.phase === 'scraping' && <PipelineDots stage={pipelineStage} />}

        <div style={{ height: 12 }} />

        <ActivityLog schools={cd.recentSchools} />
      </div>

      <div style={{ borderTop: `1px solid ${AMBER_DIM}`, background: AMBER_BG }}>
        <StatsBar
          eventsFound={cd.eventsFound}
          eventsCreated={cd.eventsCreated}
          processed={cd.schoolsScraped}
          total={cd.totalSchools || cd.schoolsScraped}
          newSchoolsQueued={cd.newSchoolsQueued}
        />
      </div>

      <style>{`
        @keyframes class-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes class-pipeline-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.6; transform: scale(1.3) } }
      `}</style>
    </div>
  )
}
