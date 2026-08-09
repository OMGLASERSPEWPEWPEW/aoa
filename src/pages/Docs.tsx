import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCostDashboard } from '../hooks/useCostDashboard'

const tabs = ['Design', 'AI Prompts', 'Costs'] as const
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
    id: 'chicago-default',
    label: 'Event Scraper',
    title: 'ChicagoDefault',
    model: 'DeepSeek V4 Flash',
    desc: 'Sent once per venue with their calendar page HTML. Extracts shows, dates, prices, cast, and show times into structured JSON.',
    venues: 12,
    template: `You are an event data extractor for Chicago theater venues. Extract all upcoming shows, classes, workshops, festivals, and readings from the provided webpage text for "\${venue_name}".

URLs appear in the text as [https://...] after link text. These are CRITICAL — extract them as ticket_url values.
Image URLs appear in the text as [img: https://...]. These are promotional images — extract the best one per event as photo_url.

Return valid JSON with this exact structure:
{
  "events": [
    {
      "title": "Show Title",
      "description": "1-2 sentence description of the show/event",
      "event_type": "show|class|workshop|festival|open-call",
      "genre_tags": ["drama", "comedy", "improv", "musical", "new-work", "classic", "experimental"],
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null if single-day",
      "price_min": 25,
      "price_max": 65,
      "ticket_url": "https://... the specific URL for THIS show's page or ticket page",
      "hottix_available": false,
      "photo_url": "https://... the promotional image/poster for THIS show, or null",
      "cast_members": [{"name": "Actor Name", "role": "Character Name or null"}],
      "show_times": {
        "thu": ["19:30"],
        "fri": ["19:30", "22:00"],
        "sat": ["14:00", "19:30"],
        "sun": ["14:00"]
      }
    }
  ]
}

Rules:
- Only include events with dates in the future (after today's date)
- ticket_url: Look for URLs in [brackets] near each event title. Use the most specific URL for that show — the individual show page or ticket purchase link, NOT the general season page
- Use "show" for performances, "class" for multi-week courses, "workshop" for one-day/weekend sessions
- genre_tags should use lowercase kebab-case, pick from: drama, comedy, improv, sketch, musical, new-work, classic, experimental, interactive, physical-theater, adaptation, social-justice, community, diverse-voices, shakespeare, revue, writing, beginner, intermediate, advanced
- If price is "pay what you can" or "free", set price_min to 0
- Set hottix_available to true only if HotTix or half-price is explicitly mentioned
- show_times: extract the weekly performance schedule using 3-letter lowercase day keys (mon, tue, wed, thu, fri, sat, sun) with times in 24h "HH:MM" format. Only include days that have performances. If the schedule is not listed, set show_times to null
- If no events are found, return {"events": []}
- photo_url: extract the promotional image URL for each show — look for [img: ...] markers near each event. Prefer show posters or production photos over generic venue images. Return null if no image is found for that event
- cast_members: extract performer names and their roles/characters if listed. Return as array of {name, role} objects. If only names are listed without roles, set role to null. Return null if no cast is listed
- Do NOT invent events — only extract what is actually on the page`,
  },
  {
    id: 'mentor-chat',
    label: 'Mentor Chat',
    title: 'MentorSystem',
    model: 'AI Gateway (configurable)',
    desc: 'System prompt for the AI mentor. Adapts tone based on belt level — guiding for newcomers, peer-like for experienced users.',
    venues: null,
    template: `You are the AI mentor for The Art of Art, a theater discovery app for Chicago.

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

function CostsTab() {
  const { today, rolling7d, rolling30d, byModel, byFeature, dailySeries, loading } = useCostDashboard()

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
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
        AI Costs
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.5, margin: '8px 0 20px' }}>
        Token usage and estimated costs across all AI features.
      </p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'TODAY', value: today },
          { label: '7 DAYS', value: rolling7d },
          { label: '30 DAYS', value: rolling30d },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              padding: '12px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', marginBottom: 4 }}>
              {c.label}
            </div>
            <div style={{ ...mono, fontSize: 16, color: 'var(--ink)' }}>
              {formatCost(c.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Daily bar chart */}
      {dailySeries.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
            Daily Cost (14 days)
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
