import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
    >
      <h1
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 38,
          fontWeight: 400,
          marginBottom: 8,
        }}
      >
        House
      </h1>
      <p
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 16,
          color: 'var(--ink-dim)',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.5,
          marginBottom: 32,
        }}
      >
        Your guide to the scene. Discover theater, track what you've seen, and find your seat in the house.
      </p>
      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
        <Link
          to="/signup"
          className="text-center transition-colors"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-on)',
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 16,
            padding: '14px 24px',
            borderRadius: 3,
            textDecoration: 'none',
          }}
        >
          Get Started
        </Link>
        <Link
          to="/login"
          className="text-center transition-colors"
          style={{
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
            fontFamily: "'Courier Prime', monospace",
            fontSize: 13,
            padding: '14px 24px',
            borderRadius: 3,
            textDecoration: 'none',
          }}
        >
          Sign In
        </Link>
      </div>
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: 'var(--ink-ghost)',
          marginTop: 48,
        }}
      >
        v{__APP_VERSION__}
      </p>
    </div>
  )
}
