import { useState } from 'react'
import { useScrape, type RecentSchoolEntry, type ModelResult } from '../contexts/ScrapeContext'
import { PinLedger } from './admin/PinLedger'

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
const mono = { fontFamily: "'Courier Prime', monospace" } as const

const AMBER = '#D4A017'
const AMBER_DIM = '#8a6a10'
const AMBER_BG = '#1a1005'

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function ModelResultsRow({ results }: { results: ModelResult[] }) {
  const sorted = [...results].sort((a, b) => b.events_found - a.events_found)
  const winner = sorted[0]

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
      {sorted.map((r) => {
        const isWinner = r === winner && r.events_found > 0
        const color = r.status === 'ok' ? (isWinner ? AMBER : 'var(--ink-faint)')
          : r.status === 'timeout' ? '#ef4444'
          : 'var(--ink-whisper)'
        const label = r.model.replace('deepseek-v4-flash', 'DS').replace('gemini-3.5-flash', 'Gem').replace('gpt-5.6-luna', 'GPT').replace('claude-haiku-4-5', 'Haiku')
        return (
          <span key={r.model} style={{
            ...mono, fontSize: 8, color,
            border: isWinner ? `1px solid ${AMBER}` : '1px solid var(--rule)',
            borderRadius: 2, padding: '1px 4px',
            background: isWinner ? '#2a1a05' : 'transparent',
          }}>
            {label} {r.events_found} · {formatDuration(r.duration_ms)}
            {r.status === 'timeout' && ' ⏱'}
            {r.status === 'error' && ' ✗'}
          </span>
        )
      })}
    </div>
  )
}

function SchoolRow({ s }: { s: RecentSchoolEntry }) {
  const [expanded, setExpanded] = useState(false)
  const isPending = s.status === 'pending'
  const isError = !isPending && s.status !== 'success'
  const statusColor = isPending ? 'var(--ink-faint)' : isError ? '#ef4444' : AMBER

  return (
    <div
      style={{ padding: '8px 0', borderBottom: '1px solid var(--rule)', cursor: 'pointer', opacity: isPending ? 0.5 : 1, transition: 'opacity 0.3s' }}
      onClick={() => setExpanded(prev => !prev)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ ...mono, fontSize: 11, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 8, marginRight: 4, display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&#9654;</span>
          {s.name}
        </div>
        <div style={{ ...mono, fontSize: 9, color: statusColor, marginLeft: 8, flexShrink: 0 }}>
          {isPending
            ? 'QUEUED'
            : isError
              ? s.status.toUpperCase().replace('_', ' ')
              : `${s.eventsCreated} new ${s.eventsFound} found`}
          {s.invocations && s.invocations > 1 ? ` · INV ${s.invocations}` : ''}
        </div>
      </div>

      {isPending && !expanded && (
        <div style={{ ...mono, fontSize: 8, color: 'var(--ink-faint)', marginTop: 2 }}>
          classes · format · instructor · schedule · skill level
        </div>
      )}

      {s.trace && (
        <div style={{ ...mono, fontSize: 8, color: 'var(--ink-faint)', marginTop: 2 }}>
          {s.trace.programsExtracted != null ? `${s.trace.programsExtracted} programs · ` : ''}
          {s.trace.aiCalls} AI calls · {s.trace.fetches} pages · {formatDuration(s.trace.durationMs)}
          {s.trace.costUsd != null ? ` · $${s.trace.costUsd.toFixed(3)}` : ''}
          {s.trace.stopReason ? ` · ${s.trace.stopReason}` : ''}
        </div>
      )}

      {s.trace?.modelResults && <ModelResultsRow results={s.trace.modelResults} />}

      {!expanded && s.errorMessage && (
        <div style={{ ...mono, fontSize: 8, color: '#ef4444', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.errorMessage}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 6, paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {s.address && (
            <div style={{ ...mono, fontSize: 8, color: 'var(--ink-faint)' }}>
              ⌖ {s.address}
            </div>
          )}
          {s.calendarUrl && (
            <a href={s.calendarUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ ...mono, fontSize: 9, color: AMBER, textDecoration: 'underline', wordBreak: 'break-all' }}>
              {s.calendarUrl}
            </a>
          )}
          {s.websiteUrl && s.websiteUrl !== s.calendarUrl && (
            <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', textDecoration: 'underline', wordBreak: 'break-all' }}>
              {s.websiteUrl}
            </a>
          )}
          {isPending && (
            <div style={{ ...mono, fontSize: 8, color: 'var(--ink-faint)' }}>
              Waiting — will extract: classes, format, instructor, schedule, skill level
            </div>
          )}
          {s.errorMessage && (
            <div style={{ ...mono, fontSize: 8, color: '#ef4444', wordBreak: 'break-all' }}>
              {s.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatsBar({ eventsFound, eventsCreated, processed, total, newSchoolsQueued, costUsd }: {
  eventsFound: number; eventsCreated: number; processed: number; total: number; newSchoolsQueued: number; costUsd: number
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 16, padding: '12px 16px',
      ...mono, fontSize: 9, letterSpacing: '0.06em', color: 'var(--ink-faint)',
    }}>
      <span>{eventsFound} found</span>
      <span style={{ color: 'var(--rule)' }}>·</span>
      <span>{eventsCreated} persisted</span>
      <span style={{ color: 'var(--rule)' }}>·</span>
      <span>{total > 0 ? Math.round((processed / total) * 100) : 0}%</span>
      {costUsd > 0 && (
        <>
          <span style={{ color: 'var(--rule)' }}>·</span>
          <span>${costUsd.toFixed(4)}</span>
        </>
      )}
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
          {isDone ? 'SCRAPE COMPLETE' : isError ? 'SCRAPE ERROR' : 'SCRAPING CLASSES'}
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

        <div style={{ height: 12 }} />

        {cd.recentSchools.length > 0 && (
          <div style={{ overflowY: 'auto', padding: '0 16px 16px' }}>
            <div style={{ ...mono, fontSize: 8, letterSpacing: '0.12em', color: 'var(--ink-faint)', marginBottom: 8 }}>
              RECENT SCHOOLS
            </div>
            {cd.recentSchools.map((s, i) => <SchoolRow key={i} s={s} />)}
          </div>
        )}

        <div style={{ padding: '0 16px 16px' }}>
          <PinLedger />
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${AMBER_DIM}`, background: AMBER_BG }}>
        <StatsBar
          eventsFound={cd.eventsFound}
          eventsCreated={cd.eventsCreated}
          processed={cd.schoolsScraped}
          total={cd.totalSchools || cd.schoolsScraped}
          newSchoolsQueued={cd.newSchoolsQueued}
          costUsd={cd.totalCostUsd}
        />
      </div>

      <style>{`
        @keyframes class-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      `}</style>
    </div>
  )
}
