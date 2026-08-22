import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { useCostDashboard } from '../hooks/useCostDashboard'
import { useVenueCoverage } from '../hooks/useVenueCoverage'
import { useDiscoveryQueue } from '../hooks/useDiscoveryQueue'
import { useClassCoverage } from '../hooks/useClassCoverage'
import { useSchoolAudit } from '../hooks/useSchoolAudit'
import type { QueueItem } from '../lib/types'
import { useVenueAudit } from '../hooks/useVenueAudit'
import { useScrape } from '../contexts/ScrapeContext'
import { useBlockSource } from '../hooks/useBlockSource'
import { useBlockedSources } from '../hooks/useBlockedSources'
import { normalizeDomain } from '../lib/blocklist'
import { DiscoveryQueueSection } from '../components/admin/DiscoveryQueueSection'
import { VenuePromoteModal } from '../components/admin/VenuePromoteModal'
import { BlockSheet } from '../components/admin/BlockSheet'
import { BlockedList } from '../components/admin/BlockedList'
import { CoverageDomainTabs } from '../components/admin/CoverageDomainTabs'
import { CoverageBar } from '../components/admin/CoverageBar'
import { AuditRow } from '../components/admin/AuditRow'
import { DryPipelineCard } from '../components/admin/DryPipelineCard'
import { DisciplineBar } from '../components/admin/DisciplineBar'
import { ClassFieldTiles } from '../components/admin/ClassFieldTiles'
import { WorkActions } from '../components/admin/WorkActions'
import { NeedsALookTiles } from '../components/admin/NeedsALookTiles'

const tabs = ['Design', 'AI Prompts', 'Costs', 'Coverage'] as const
type Tab = (typeof tabs)[number]

const prototypes = [
  {
    slug: 'landscape',
    label: 'Competitive Intelligence',
    title: 'The Landscape',
    desc: 'Twenty competitors analyzed across four categories with an interactive feature gap matrix, scale comparison chart, and strategic insights.',
  },
  {
    slug: 'pitch',
    label: 'Overview',
    title: 'The Pitch Deck',
    desc: 'The full product vision: the problem, the competitive landscape, all seven screens with phone mockups, the emotion system, and the Goodreads-for-plays concept.',
  },
  {
    slug: 'map',
    label: 'Interactive Prototype',
    title: 'The Map',
    desc: 'Working Leaflet prototype with real Chicago coordinates, custom venue markers, filter chips, the venue detail sheet, and the warm-night basemap tint.',
  },
  {
    slug: 'house',
    label: 'Full Screen Canvas',
    title: 'The House Record',
    desc: 'Fifteen mobile screens on one pannable canvas — Tonight, My Shows, Show Detail, Log a Show, Write a Review, You, Discover, The Lobby, Artist, Play, and more.',
  },
]

const prompts = [
  {
    id: 'scraper-extract',
    label: 'Event Scraper — Pass 1: Extract',
    title: 'ExtractionPrompt',
    model: 'DeepSeek V4 Flash',
    desc: 'Sent once per venue with their calendar page HTML. Extracts ONLY structural data: titles, dates, prices, ticket URLs, show times. Explicit rules prevent price=0 defaults and venue misattribution. Pass 2 adds descriptions and genres.',
    venues: 135,
    template: `You are an event data extractor for Chicago theater venues. Extract all upcoming shows from the provided webpage text.

CRITICAL: Only extract events PERFORMED AT "\${venue_name}". Exclude events at other venues.

PRICE RULES:
- If no price is listed, set BOTH price_min and price_max to null — NOT 0
- Set price_min to 0 ONLY when explicitly "free" or "$0"
- NEVER guess prices. When in doubt, use null.

VENUE RULES:
- Only events AT "\${venue_name}" — exclude "at [Other Venue]"
- Touring shows AT this venue ARE included

DATE RULES:
- Future dates only
- Year-round programs: use NEXT specific performance dates, not season span
- Single performances: end_date = null

Returns: { events: [{ title, event_type, start_date, end_date, price_min, price_max, ticket_url, show_times }] }`,
  },
  {
    id: 'scraper-verify',
    label: 'Event Scraper — Pass 2: Verify & Enrich',
    title: 'VerificationPrompt',
    model: 'DeepSeek V4 Flash',
    desc: 'Runs after Pass 1. Receives extracted event JSON (NOT the HTML). Verifies prices, venue attribution, date ranges. Adds descriptions, genre tags, cast. Returns confidence score 0-1. Rejects misattributed or hallucinated events.',
    venues: null,
    template: `You are a theater event data verifier for "\${venue_name}" in Chicago.

Input: \${events_json} (from Pass 1)

For each event, return:
- status: "verified" | "corrected" | "rejected"
- confidence: 0.0-1.0
- corrections: { price_min?, price_max?, start_date?, end_date? } (null = no correction)
- description: 1-2 sentences
- genre_tags: from standard list
- cast_members: only if genuinely known, otherwise null

REJECTION: wrong venue, duplicate, parsing artifact, past dates
PRICE CHECK: if price_min=0 but venue is paid, correct to null
DATE CHECK: if range > 180 days, correct end_date to null
CAST: do NOT hallucinate names`,
  },
  {
    id: 'mentor-chat',
    label: 'Mentor Chat',
    title: 'MentorSystem',
    model: 'AI Gateway (configurable)',
    desc: 'System prompt for the AI mentor. Adapts tone based on belt level — guiding for newcomers, peer-like for experienced users.',
    venues: null,
    template: `You are the AI mentor for House, a theater discovery app for Chicago.

PERSONA:
You're a theater-obsessed Chicagoan who's seen everything, knows everyone, and genuinely wants to share the love. Not pretentious. You think the Neo-Futurists are just as important as Steppenwolf. You have opinions but respect the user's taste.

VOICE:
- Warm, knowledgeable, slightly irreverent
- Use "you'd love this" not "you should see this"
- Drop real insider knowledge naturally
- Never condescending, never gatekeeping
- \${belt_level >= 3 ? "Be more conversational and peer-like" : "Be more guiding and encouraging"}

USER CONTEXT:
- Belt level: \${belt} (\${showsSeen} shows seen, \${venuesVisited} venues visited)
- Age range: \${age}
- Experience: \${experience}
- Interests: \${interests}

KNOWLEDGE:
- Chicago theater scene: storefront to institutional, improv to drama
- Venues, playwrights, genres, history, industry dynamics
- Age-appropriate recommendations based on life stage
- HotTix, opening nights, ushering, auditions, classes

BOUNDARIES:
- You know Chicago theater deeply
- Defer on: ticket purchasing, personal schedules, non-theater topics
- If asked about other cities, say you're a Chicago specialist but offer general theater advice
- Keep responses concise — 2-3 paragraphs max unless the user asks for detail`,
  },
]

const mono = { fontFamily: "'Courier Prime', monospace" } as const

export function Docs() {
  const [tab, setTab] = useState<Tab>('Design')
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 640, margin: '0 auto' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--rule)',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...mono,
              fontSize: 11,
              letterSpacing: '0.08em',
              padding: '12px 16px 10px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              color: tab === t ? 'var(--ink)' : 'var(--ink-faint)',
              cursor: 'pointer',
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {tab === 'Design' && <DesignTab />}
        {tab === 'AI Prompts' && (
          <PromptsTab expanded={expanded} setExpanded={setExpanded} />
        )}
        {tab === 'Costs' && <CostsTab />}
        {tab === 'Coverage' && <CoverageTab />}
      </div>
    </div>
  )
}

function DesignTab() {
  return (
    <>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
        Design Prototypes
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.5, margin: '8px 0 20px' }}>
        Interactive HTML prototypes showing the product vision, screen designs, and design system.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prototypes.map((p) => (
          <Link
            key={p.slug}
            to={`/app/admin/${p.slug}`}
            style={{
              display: 'block',
              background: 'var(--bg-card)',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              padding: '16px 20px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 4 }}>
              {p.label}
            </div>
            <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 20, fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>
              {p.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.45 }}>{p.desc}</div>
            <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', marginTop: 8, display: 'inline-block' }}>Open →</span>
          </Link>
        ))}
      </div>
    </>
  )
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

const COST_WINDOWS = [
  { key: 1, label: 'TODAY' },
  { key: 7, label: '7 DAYS' },
  { key: 30, label: '30 DAYS' },
  { key: 3650, label: 'ALL TIME' },
] as const

function CostsTab() {
  const [costDays, setCostDays] = useState(7)
  const { total, byModel, byFeature, dailySeries, loading } = useCostDashboard(costDays)

  if (loading) {
    return (
      <div style={{ ...mono, fontSize: 11, color: 'var(--ink-faint)', padding: '40px 0', textAlign: 'center' }}>
        Loading usage data...
      </div>
    )
  }

  const maxDaily = Math.max(...dailySeries.map((d) => d.total_cost), 0.0001)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            AI Costs
          </div>
          <div style={{ ...mono, fontSize: 22, color: 'var(--ink)', marginTop: 4 }}>
            {formatCost(total)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {COST_WINDOWS.map((w) => {
            const active = costDays === w.key
            return (
              <button
                key={w.key}
                onClick={() => setCostDays(w.key)}
                style={{
                  ...mono,
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  padding: '5px 10px',
                  borderRadius: 3,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  backgroundColor: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--ink-dim)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Daily bar chart */}
      {dailySeries.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
            Daily Cost
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dailySeries.map((d) => (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...mono, fontSize: 10, color: 'var(--ink-faint)', width: 44, flexShrink: 0 }}>
                  {new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div style={{ flex: 1, height: 10, background: 'var(--bg-chrome)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max((d.total_cost / maxDaily) * 100, 1)}%`,
                      background: 'var(--accent)',
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span style={{ ...mono, fontSize: 10, color: 'var(--ink-dim)', width: 52, textAlign: 'right', flexShrink: 0 }}>
                  {formatCost(d.total_cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By feature */}
      {byFeature.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
            By Feature
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {byFeature.map((f) => (
              <div
                key={f.feature}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--rule)', borderRadius: 3,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{f.feature}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ ...mono, fontSize: 10, color: 'var(--ink-faint)' }}>{f.call_count} calls</span>
                  <span style={{ ...mono, fontSize: 13, color: 'var(--ink)' }}>{formatCost(f.total_cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By model */}
      {byModel.length > 0 && (
        <div>
          <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
            By Model
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {byModel.map((m) => (
              <div
                key={m.model}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--rule)', borderRadius: 3,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ ...mono, fontSize: 10, color: 'var(--ink-faint)' }}>{m.call_count} calls</span>
                  <span style={{ ...mono, fontSize: 13, color: 'var(--ink)' }}>{formatCost(m.total_cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {byFeature.length === 0 && byModel.length === 0 && (
        <div style={{ ...mono, fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
          No AI usage recorded yet.
        </div>
      )}
    </>
  )
}

function CoverageTab() {
  const navigate = useNavigate()
  const [domain, setDomain] = useState<'theaters' | 'schools'>(() =>
    (sessionStorage.getItem('admin-domain-tab') as 'theaters' | 'schools') || 'theaters'
  )
  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useVenueCoverage(domain === 'theaters')
  const { items: queueItems, loading: queueLoading, dismiss, refetch: refetchQueue } = useDiscoveryQueue()
  const audit = useVenueAudit(domain === 'theaters')
  const [promotingItem, setPromotingItem] = useState<QueueItem | null>(null)
  const { discovery: progress, scraper, classDiscovery, setDashboardOpen, setClassDashboardOpen, runDiscovery, runScraper, runClassDiscovery } = useScrape()
  const eventBusy = progress.phase === 'discovering' || progress.phase === 'enriching' || scraper.phase === 'scraping'
  const classBusy = classDiscovery.phase === 'scraping'
  const [, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ exact_matches: number; fuzzy_matches: number; ai_matches: number; plays_created: number; events_unmatched: number; events_processed: number } | null>(null)
  const [discoveryRunning, setDiscoveryRunning] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<{ inserted: number; known: number; blocked: number; queries_run: number; warning?: string; schools?: Array<{ name: string; url: string; domain: string }> } | null>(null)
  const [unlinkedCount, setUnlinkedCount] = useState<number | null>(null)
  const { block, unblock } = useBlockSource()
  const { items: blockedItems } = useBlockedSources()
  const [blockTarget, setBlockTarget] = useState<{ entityType: 'venue' | 'school'; id: string; name: string; url: string | null; affectedClasses: number; affectedEvents: number } | null>(null)
  const [showBlockedList, setShowBlockedList] = useState(false)
  const classCov = useClassCoverage(domain === 'schools')
  const schoolAudit = useSchoolAudit(domain === 'schools')

  useEffect(() => {
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .is('play_id', null)
      .eq('event_type', 'show')
      .then(({ count }) => setUnlinkedCount(count ?? 0))
  }, [backfillResult])

  const handleRunBackfill = async () => {
    setBackfillRunning(true)
    setBackfillResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/play-catalog-backfill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ batch_size: 100 }),
        },
      )
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBackfillResult(data)
    } catch (e) {
      setBackfillResult({ exact_matches: 0, fuzzy_matches: 0, ai_matches: 0, plays_created: 0, events_unmatched: 0, events_processed: -1 })
    }
    setBackfillRunning(false)
  }

  const handleRunDiscovery = async () => {
    await runDiscovery()
    refetchMetrics()
    refetchQueue()
  }

  const handleRunScraper = async () => {
    await runScraper()
    refetchMetrics()
  }

  const handleSchoolDiscovery = async () => {
    setDiscoveryRunning(true)
    setDiscoveryResult(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDiscoveryRunning(false); return }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120_000)
      let res: Response
      try {
        res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/school-discovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'discover' }),
          signal: controller.signal,
        })
      } catch {
        await new Promise(r => setTimeout(r, 3000))
        const controller2 = new AbortController()
        const timer2 = setTimeout(() => controller2.abort(), 120_000)
        try {
          res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/school-discovery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'discover' }),
            signal: controller2.signal,
          })
        } finally {
          clearTimeout(timer2)
        }
      } finally {
        clearTimeout(timer)
      }
      const d = await res!.json()
      setDiscoveryResult(d)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      const userMsg = msg === 'Failed to fetch' || msg.includes('load failed') || msg.includes('aborted')
        ? 'Network error — the server took too long or the connection dropped. Try again.'
        : msg
      setDiscoveryResult({ inserted: 0, known: 0, blocked: 0, queries_run: 0, warning: userMsg })
    }
    setDiscoveryRunning(false)
  }

  const handleDomainChange = (d: 'theaters' | 'schools') => {
    setDomain(d)
    sessionStorage.setItem('admin-domain-tab', d)
  }

  return (
    <>
      <CoverageDomainTabs
        domain={domain}
        counts={{ theaters: metrics?.total_aoa_venues ?? 0, schools: classCov.metrics?.school_count ?? 0 }}
        onChange={handleDomainChange}
      />

      {domain === 'theaters' && (<>
      {metrics && (
        <CoverageBar
          totalKnown={metrics.total_known_chicago}
          totalOurs={metrics.total_aoa_venues}
          withCalendar={metrics.venues_with_calendar_url}
          missingCalendar={metrics.venues_missing_calendar ?? (metrics.total_aoa_venues - metrics.venues_with_calendar_url)}
          animate
        />
      )}
      <WorkActions
        domain="theaters"
        lastRunAt={null}
        queueCount={scraper.total || 0}
        backfillCount={unlinkedCount ?? 0}
        running={eventBusy ? (progress.phase === 'discovering' || progress.phase === 'enriching' ? 'find' : 'curate') : null}
        onFind={handleRunDiscovery}
        onCurate={handleRunScraper}
        onBackfill={handleRunBackfill}
        onQueue={() => setDashboardOpen(true)}
      />
      {discoveryResult && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ ...mono, fontSize: 10, color: discoveryResult.warning ? '#ef4444' : '#D4A017' }}>
            {discoveryResult.warning
              ? `Discovery: ${discoveryResult.warning}`
              : `Discovery: ${discoveryResult.queries_run} queries · ${discoveryResult.inserted} new schools added · ${discoveryResult.blocked} blocked · ${discoveryResult.known} known`}
          </div>
          {discoveryResult.schools && discoveryResult.schools.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {discoveryResult.schools.map((s, i) => (
                <div key={i} style={{ ...mono, fontSize: 9, color: 'var(--ink-dim)', padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-faint)', textDecoration: 'none', flexShrink: 0 }}>
                    {s.domain} ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {backfillResult && backfillResult.events_processed >= 0 && (
        <div style={{ ...mono, fontSize: 10, color: 'var(--accent)', marginBottom: 8 }}>
          {backfillResult.exact_matches} exact · {backfillResult.fuzzy_matches} fuzzy · {backfillResult.ai_matches} AI · {backfillResult.plays_created} new plays · {backfillResult.events_unmatched} unmatched
        </div>
      )}
      {backfillResult && backfillResult.events_processed < 0 && (
        <div style={{ ...mono, fontSize: 10, color: 'var(--danger)', marginBottom: 8 }}>
          Backfill failed — check Edge Function logs
        </div>
      )}
      <div style={{ ...mono, fontSize: 10, color: 'var(--ink-dim)', marginBottom: 16 }}>
        {progress.phase === 'discovering' && 'Parsing ChicagoPlays...'}
        {progress.phase === 'enriching' && `Enriching & adding venues... ${progress.promoted} added so far`}
        {progress.phase === 'done' && progress.promoted > 0 && `Done — ${progress.promoted} venues added to the app.`}
        {progress.phase === 'done' && progress.promoted === 0 && progress.total === 0 && 'All venues up to date.'}
        {progress.phase === 'error' && <span style={{ color: '#ef4444' }}>Error: {progress.error}</span>}
        {scraper.phase === 'scraping' && (<>{scraper.currentVenue && <><strong>{scraper.currentVenue}</strong> → {scraper.lastStrategy ?? 'processing...'}<br /></>}{scraper.scraped} of {scraper.total || '?'} venues · {scraper.events} events found</>)}
        {scraper.phase === 'done' && `Done — ${scraper.events} events found across ${scraper.scraped} venues.`}
        {scraper.phase === 'error' && <span style={{ color: '#ef4444' }}>Scraper error: {scraper.error}</span>}
        {progress.phase === 'idle' && scraper.phase === 'idle' && 'Chicago theater venue discovery and data completeness.'}
      </div>

      {metricsLoading && (
        <div style={{ ...mono, fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
          Loading metrics...
        </div>
      )}

      {metricsError && (
        <div style={{ ...mono, fontSize: 11, color: '#ef4444', textAlign: 'center', padding: '20px 0' }}>
          {metricsError} <button onClick={refetchMetrics} style={{ ...mono, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      <NeedsALookTiles
        tiles={[
          { key: 'zeroEvents', label: '0 events', count: metrics?.venues_zero_events ?? 0, severity: 'warn', active: audit.filters.zeroEvents },
          { key: 'missingCalendar', label: 'No cal', count: metrics?.venues_missing_calendar ?? 0, severity: 'warn', active: audit.filters.missingCalendar },
          { key: 'missingPhoto', label: 'No photo', count: metrics?.venues_missing_photo ?? 0, severity: 'neutral', active: audit.filters.missingPhoto },
          { key: 'blocked', label: 'Blocked', count: blockedItems.length, severity: 'danger', active: false },
        ]}
        onToggle={(key) => {
          if (key === 'blocked') { setShowBlockedList(true); return }
          const k = key as keyof typeof audit.filters
          audit.setFilters({ [k]: !audit.filters[k] })
        }}
      />

      {!audit.loading && audit.venues.length > 0 && (() => {
        const activeFilter = audit.filters.zeroEvents ? '0 events' : audit.filters.missingCalendar ? 'no cal' : audit.filters.missingPhoto ? 'no photo' : null
        return (
        <div style={{ marginTop: 8 }}>
          <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: activeFilter ? 'var(--accent)' : 'var(--ink-faint)' }}>
              {audit.venues.length} venues · {activeFilter ?? 'all'}
            </span>
            {activeFilter && <span style={{ ...mono, fontSize: 8, color: 'var(--ink-ghost)', letterSpacing: '0.06em' }}>TAP FOR WHY</span>}
          </div>
          {audit.venues.map(v => (
            <AuditRow
              key={v.id}
              row={v}
              onOpen={(id) => navigate(`/app/admin/venue/${id}`)}
              onBlock={() => setBlockTarget({ entityType: 'venue', id: v.id, name: v.name, url: v.website_url, affectedClasses: 0, affectedEvents: v.event_count })}
            />
          ))}
        </div>
        )
      })()}

      {!queueLoading && (
        <DiscoveryQueueSection
          items={queueItems}
          onPromote={(item) => setPromotingItem(item)}
          onDismiss={(id) => dismiss(id)}
        />
      )}

      {promotingItem && (
        <VenuePromoteModal
          item={promotingItem}
          onClose={() => setPromotingItem(null)}
          onPromoted={() => {
            setPromotingItem(null)
            refetchQueue()
            refetchMetrics()
          }}
        />
      )}
      </>)}

      {domain === 'schools' && (<>
        <WorkActions
          domain="schools"
          lastRunAt={classCov.metrics?.last_curated_at ?? null}
          queueCount={classCov.metrics?.school_count ?? 0}
          backfillCount={classCov.metrics?.schools_never_curated ?? 0}
          running={discoveryRunning ? 'find' : classBusy ? 'curate' : null}
          onFind={handleSchoolDiscovery}
          onCurate={() => { runClassDiscovery(); refetchMetrics() }}
          onBackfill={() => { runClassDiscovery(); refetchMetrics() }}
          onQueue={() => setClassDashboardOpen(true)}
        />
        {classCov.metrics && (
          <>
            {classCov.metrics.school_count > 0 && (
              <DisciplineBar byDiscipline={classCov.metrics.by_discipline} total={classCov.metrics.school_count} />
            )}
            {classCov.metrics.session_count === 0 && classCov.metrics.school_count > 0 && (
              <DryPipelineCard schoolCount={classCov.metrics.school_count} onCurateAll={() => { runClassDiscovery(); classCov.refetch() }} />
            )}
            {classCov.metrics.session_count > 0 && (
              <ClassFieldTiles
                sessionCount={classCov.metrics.session_count}
                fields={[
                  { label: 'START DATE', count: classCov.metrics.with_start_date },
                  { label: 'PRICE', count: classCov.metrics.with_price },
                  { label: 'LEVEL', count: classCov.metrics.with_level },
                  { label: 'TEACHER', count: classCov.metrics.with_teacher },
                ]}
              />
            )}
          </>
        )}
        {!schoolAudit.loading && schoolAudit.schools.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, color: 'var(--ink-faint)' }}>
              {schoolAudit.schools.length} schools
            </div>
            {schoolAudit.schools.map(s => (
              <AuditRow
                key={s.id}
                row={s}
                onOpen={(id) => navigate(`/app/admin/school/${id}`)}
                onCurate={s.diagnosis.kind !== 'aggregator' ? async () => {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session) return
                  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-scrape-batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ action: 'start', venue_id: s.id }),
                  })
                } : undefined}
                onBlock={() => setBlockTarget({ entityType: 'school', id: s.id, name: s.name, url: s.url, affectedClasses: s.session_count, affectedEvents: 0 })}
              />
            ))}
          </div>
        )}
      </>)}

      {blockTarget && (
        <BlockSheet
          target={{
            entityType: blockTarget.entityType,
            id: blockTarget.id,
            name: blockTarget.name,
            domain: normalizeDomain(blockTarget.url) ?? '',
            affectedEvents: blockTarget.affectedEvents,
            affectedClasses: blockTarget.affectedClasses,
          }}
          onConfirm={async (scope, reason, note) => {
            await block({
              entity_type: blockTarget.entityType,
              entity_id: blockTarget.id,
              name: blockTarget.name,
              url: blockTarget.url ?? '',
              scope,
              reason,
              note: note ?? undefined,
            })
            setBlockTarget(null)
          }}
          onCancel={() => setBlockTarget(null)}
        />
      )}

      {showBlockedList && (
        <>
          <div
            onClick={() => setShowBlockedList(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--bg)', borderRadius: '16px 16px 0 0',
            borderTop: '1px solid var(--rule)',
            boxShadow: '0 -14px 44px rgba(0,0,0,0.18)',
            zIndex: 1001, padding: '16px 20px 24px',
            maxHeight: '70vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
            </div>
            <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 12 }}>
              Blocked sources ({blockedItems.length})
            </div>
            <BlockedList items={blockedItems} onUnblock={async (id) => { await unblock(id) }} />
            <button
              onClick={() => setShowBlockedList(false)}
              style={{ ...mono, fontSize: 10, marginTop: 16, padding: '10px 20px', background: 'none', border: '1px solid var(--rule)', borderRadius: 4, color: 'var(--ink-dim)', cursor: 'pointer', width: '100%' }}
            >
              CLOSE
            </button>
          </div>
        </>
      )}
    </>
  )
}

function PromptsTab({ expanded, setExpanded }: { expanded: string | null; setExpanded: (id: string | null) => void }) {
  return (
    <>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
        AI Prompts
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.5, margin: '8px 0 20px' }}>
        System prompts used by the AI features. Variables shown as <code style={{ ...mono, fontSize: 12, color: 'var(--accent)' }}>${'{'}...{'}'}</code> placeholders.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prompts.map((p) => (
          <div
            key={p.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                  {p.label}
                </div>
                <div style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)' }}>
                  {p.model}{p.venues ? ` · ${p.venues} venues` : ''}
                </div>
              </div>
              <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 20, fontWeight: 400, color: 'var(--ink)', margin: '4px 0' }}>
                {p.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.45 }}>{p.desc}</div>
              <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', marginTop: 8, display: 'inline-block' }}>
                {expanded === p.id ? '▾ Collapse' : '▸ View prompt'}
              </span>
            </button>
            {expanded === p.id && (
              <div
                style={{
                  borderTop: '1px solid var(--rule)',
                  padding: '16px 20px',
                  background: 'var(--bg-chrome)',
                }}
              >
                <pre
                  style={{
                    ...mono,
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: 'var(--ink-dim)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {p.template}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
