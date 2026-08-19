import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useCostDashboard } from '../hooks/useCostDashboard'
import { useVenueCoverage } from '../hooks/useVenueCoverage'
import { useDiscoveryQueue } from '../hooks/useDiscoveryQueue'
import type { QueueItem } from '../lib/types'
import { useVenueAudit } from '../hooks/useVenueAudit'
import { useScrape } from '../contexts/ScrapeContext'
import { CoverageMetricsCards } from '../components/admin/CoverageMetricsCards'
import { VenueAuditTable } from '../components/admin/VenueAuditTable'
import { DiscoveryQueueSection } from '../components/admin/DiscoveryQueueSection'
import { VenuePromoteModal } from '../components/admin/VenuePromoteModal'

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

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
  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useVenueCoverage()
  const { items: queueItems, loading: queueLoading, dismiss, refetch: refetchQueue } = useDiscoveryQueue()
  const audit = useVenueAudit()
  const [promotingItem, setPromotingItem] = useState<QueueItem | null>(null)
  const { discovery: progress, scraper, classDiscovery, setDashboardOpen, setClassDashboardOpen, runDiscovery, runScraper, runClassDiscovery } = useScrape()
  const eventBusy = progress.phase === 'discovering' || progress.phase === 'enriching' || scraper.phase === 'scraping'
  const classBusy = classDiscovery.phase === 'scraping'
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ exact_matches: number; fuzzy_matches: number; ai_matches: number; plays_created: number; events_unmatched: number; events_processed: number } | null>(null)
  const [schoolQueue, setSchoolQueue] = useState<Array<{ id: string; raw_name: string; raw_website_url: string | null; raw_description: string | null; created_at: string }>>([])
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [discoveryRunning, setDiscoveryRunning] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<{ queued: number; known: number; blocked: number; queries_run: number; warning?: string; schools?: Array<{ name: string; url: string; domain: string }> } | null>(null)

  useEffect(() => {
    supabase
      .from('venue_discovery_queue')
      .select('id, raw_name, raw_website_url, raw_description, created_at')
      .eq('raw_category', 'school')
      .eq('promoted', false)
      .is('rejected_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setSchoolQueue(data ?? []))
  }, [classDiscovery.phase, discoveryResult])

  const handlePromoteSchool = async (entry: typeof schoolQueue[0]) => {
    setPromotingId(entry.id)
    setPromoteError(null)
    try {
      const slug = entry.raw_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const { data: newVenue, error: venueError } = await supabase.from('venues').insert({
        name: entry.raw_name,
        slug,
        venue_type: 'school',
        website_url: entry.raw_website_url,
        calendar_url: entry.raw_website_url,
        city: 'chicago',
        source: 'discovery',
      }).select('id').single()

      if (venueError) {
        setPromoteError(`Venue insert failed: ${venueError.message}`)
        setPromotingId(null)
        return
      }

      await supabase.from('schools').insert({
        name: entry.raw_name,
        short_name: entry.raw_name.slice(0, 14).toUpperCase(),
        slug,
        latitude: 41.8781,
        longitude: -87.6298,
        neighborhood: 'Chicago',
        discipline: 'acting',
        venue_id: newVenue.id,
        url: entry.raw_website_url,
      })

      await supabase.from('venue_discovery_queue').update({ promoted: true }).eq('id', entry.id)
      setSchoolQueue(prev => prev.filter(q => q.id !== entry.id))
    } catch (e) {
      setPromoteError(e instanceof Error ? e.message : 'Promote failed')
    }
    setPromotingId(null)
  }

  const handleRejectSchool = async (id: string) => {
    await supabase.from('venue_discovery_queue').update({ rejected_at: new Date().toISOString() }).eq('id', id)
    setSchoolQueue(prev => prev.filter(q => q.id !== id))
  }
  const [unlinkedCount, setUnlinkedCount] = useState<number | null>(null)
  const [classMetrics, setClassMetrics] = useState<{ class_venue_count: number; class_event_count: number; class_with_instructor: number; class_with_level: number } | null>(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .is('play_id', null)
      .eq('event_type', 'show')
      .then(({ count }) => setUnlinkedCount(count ?? 0))
  }, [backfillResult])

  useEffect(() => {
    supabase.rpc('get_class_coverage_metrics').then(({ data }) => {
      if (data) setClassMetrics(data as typeof classMetrics)
    })
  }, [classDiscovery.phase])

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

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            Venue Coverage
          </div>
        </div>
        <button
          onClick={handleRunDiscovery}
          disabled={eventBusy}
          style={{
            ...mono,
            fontSize: 10,
            padding: '6px 14px',
            background: eventBusy ? 'var(--bg-chrome)' : 'var(--accent)',
            color: eventBusy ? 'var(--ink-dim)' : 'var(--accent-on)',
            border: 'none',
            borderRadius: 2,
            cursor: eventBusy ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {progress.phase === 'discovering' && 'Finding...'}
          {progress.phase === 'enriching' && `Adding ${progress.promoted}...`}
          {(progress.phase === 'idle' || progress.phase === 'done' || progress.phase === 'error') && 'Find Venues'}
        </button>
        <button
          onClick={scraper.phase === 'scraping' ? () => setDashboardOpen(true) : handleRunScraper}
          disabled={eventBusy && scraper.phase !== 'scraping'}
          style={{
            ...mono,
            fontSize: 10,
            padding: '6px 14px',
            background: scraper.phase === 'scraping' ? 'var(--accent-bg)' : 'var(--bg-card)',
            color: scraper.phase === 'scraping' ? 'var(--accent-text)' : 'var(--ink)',
            border: scraper.phase === 'scraping' ? '1px solid var(--accent-border)' : '1px solid var(--rule)',
            borderRadius: 2,
            cursor: scraper.phase === 'scraping' ? 'pointer' : eventBusy ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {scraper.phase === 'scraping' ? `View Progress ${scraper.total > 0 ? `${scraper.scraped}/${scraper.total}` : ''}` : 'Scrape Shows'}
        </button>
        <button
          onClick={handleRunBackfill}
          disabled={backfillRunning || eventBusy}
          style={{
            ...mono,
            fontSize: 10,
            padding: '6px 14px',
            background: backfillRunning ? 'var(--bg-chrome)' : 'var(--bg-card)',
            color: backfillRunning ? 'var(--ink-dim)' : 'var(--ink)',
            border: '1px solid var(--rule)',
            borderRadius: 2,
            cursor: backfillRunning || eventBusy ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {backfillRunning ? 'Matching...' : `Play Backfill${unlinkedCount !== null ? ` (${unlinkedCount})` : ''}`}
        </button>
        <button
          onClick={async () => {
            setDiscoveryRunning(true)
            setDiscoveryResult(null)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { setDiscoveryRunning(false); return }
            try {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-discovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ action: 'discover' }),
              })
              const d = await res.json()
              setDiscoveryResult(d)
            } catch (e) {
              setDiscoveryResult({ queued: 0, known: 0, blocked: 0, queries_run: 0, warning: e instanceof Error ? e.message : 'Failed' })
            }
            setDiscoveryRunning(false)
          }}
          disabled={discoveryRunning}
          style={{
            ...mono,
            fontSize: 10,
            padding: '6px 14px',
            background: discoveryRunning ? '#0a1a05' : '#0a1a05',
            color: discoveryRunning ? '#166534' : '#22C55E',
            border: `1px solid ${discoveryRunning ? '#166534' : '#22C55E'}`,
            borderRadius: 2,
            cursor: discoveryRunning ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {discoveryRunning ? 'Searching...' : 'Find Schools'}
        </button>
        <button
          onClick={classDiscovery.phase === 'scraping' ? () => setClassDashboardOpen(true) : () => { runClassDiscovery(); refetchMetrics() }}
          disabled={classBusy && classDiscovery.phase !== 'scraping'}
          style={{
            ...mono,
            fontSize: 10,
            padding: '6px 14px',
            background: classDiscovery.phase === 'scraping' ? '#2a1a05' : '#1a1005',
            color: '#D4A017',
            border: '1px solid #D4A017',
            borderRadius: 2,
            cursor: classDiscovery.phase === 'scraping' ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {classDiscovery.phase === 'scraping' ? `View Progress ${classDiscovery.totalSchools > 0 ? `${classDiscovery.schoolsScraped}/${classDiscovery.totalSchools}` : ''}` : 'Scrape Classes'}
        </button>
      </div>
      {discoveryResult && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ ...mono, fontSize: 10, color: discoveryResult.warning ? '#ef4444' : '#D4A017' }}>
            {discoveryResult.warning
              ? `Discovery: ${discoveryResult.warning}`
              : `Discovery: ${discoveryResult.queries_run} queries · ${discoveryResult.queued} new schools queued · ${discoveryResult.blocked} blocked · ${discoveryResult.known} known`}
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

      {metrics && <CoverageMetricsCards metrics={metrics} />}

      {classMetrics && (
        <div style={{ marginTop: 14, marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: '#D4A017', marginBottom: 6 }}>
            CLASS COVERAGE
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { value: classMetrics.class_venue_count, label: 'SCHOOLS' },
              { value: classMetrics.class_event_count, label: 'CLASSES' },
              { value: classMetrics.class_with_instructor, label: 'W/ INSTRUCTOR' },
              { value: classMetrics.class_with_level, label: 'W/ LEVEL' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ ...mono, fontSize: 18, color: 'var(--ink)' }}>{s.value}</div>
                <div style={{ ...mono, fontSize: 8, letterSpacing: '0.08em', color: 'var(--ink-faint)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {schoolQueue.length > 0 && (
        <div style={{ marginTop: 14, marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: '#22C55E', marginBottom: 8 }}>
            SCHOOL DISCOVERY QUEUE ({schoolQueue.length})
          </div>
          {promoteError && (
            <div style={{ ...mono, fontSize: 10, color: '#ef4444', marginBottom: 8 }}>{promoteError}</div>
          )}
          {schoolQueue.map(entry => (
            <div key={entry.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--rule)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...mono, fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.raw_name}
                </div>
                {entry.raw_website_url && (
                  <a href={entry.raw_website_url} target="_blank" rel="noopener noreferrer"
                    style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>
                    {extractDomain(entry.raw_website_url ?? '')} ↗
                  </a>
                )}
                {entry.raw_description && (
                  <div style={{ ...mono, fontSize: 9, color: 'var(--ink-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.raw_description.slice(0, 120)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handlePromoteSchool(entry)}
                  disabled={promotingId === entry.id}
                  style={{
                    ...mono, fontSize: 9, padding: '3px 8px',
                    background: '#0a1a05', color: '#22C55E', border: '1px solid #22C55E',
                    borderRadius: 2, cursor: promotingId === entry.id ? 'default' : 'pointer',
                  }}
                >
                  {promotingId === entry.id ? '...' : 'Promote'}
                </button>
                <button
                  onClick={() => handleRejectSchool(entry.id)}
                  style={{
                    ...mono, fontSize: 9, padding: '3px 8px',
                    background: 'none', color: 'var(--ink-faint)', border: '1px solid var(--rule)',
                    borderRadius: 2, cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!audit.loading && (
        <VenueAuditTable
          venues={audit.venues}
          sort={audit.sort}
          setSort={audit.setSort}
          filters={audit.filters}
          setFilters={audit.setFilters}
        />
      )}

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
