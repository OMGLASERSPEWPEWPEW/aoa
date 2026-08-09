import { Link } from 'react-router-dom'

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

export function Docs() {
  return (
    <div style={{ padding: '24px 16px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9.5,
          letterSpacing: '0.18em',
          color: 'var(--ink-faint)',
          textTransform: 'uppercase',
        }}
      >
        Design Prototypes
      </div>
      <h2
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--ink)',
          margin: '8px 0 6px',
        }}
      >
        The Art of Art
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--ink-dim)',
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        Interactive HTML prototypes showing the product vision, screen designs, and design system.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prototypes.map((p) => (
          <Link
            key={p.slug}
            to={`/app/docs/${p.slug}`}
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
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9,
                letterSpacing: '0.14em',
                color: 'var(--ink-faint)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {p.label}
            </div>
            <div
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 20,
                fontWeight: 400,
                color: 'var(--ink)',
                marginBottom: 4,
              }}
            >
              {p.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.45 }}>
              {p.desc}
            </div>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11,
                color: 'var(--accent)',
                marginTop: 8,
                display: 'inline-block',
              }}
            >
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
