interface Props {
  playTitle: string
  playwright: string
  libraryUrl?: string | null
  readPrompt?: string | null
}

export function UnstagedBlock({ playTitle, playwright, libraryUrl, readPrompt }: Props) {
  const libraryHref = libraryUrl
    ?? `https://chipublib.bibliocommons.com/v2/search?query=${encodeURIComponent(playTitle + ' ' + playwright)}&searchType=smart`

  return (
    <div style={{ padding: '0 20px 14px' }}>
      <span
        style={{
          fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
          letterSpacing: '0.18em', color: 'var(--ink-faint)',
          display: 'block', marginBottom: 12,
        }}
      >
        UNTIL SOMEBODY STAGES IT
      </span>

      <div style={{ borderTop: '1px dotted var(--rule)' }}>
        <div style={{ padding: '12px 0' }}>
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
              fontSize: 15, color: 'var(--ink)', margin: '0 0 4px',
            }}
          >
            {readPrompt ?? 'Read it. It\'s ninety pages.'}
          </p>
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                letterSpacing: '0.08em', color: 'var(--access)',
              }}
            >
              AT THE HAROLD WASHINGTON LIBRARY · FREE
            </span>
            <a
              href={libraryHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                color: 'var(--accent)', textDecoration: 'none',
              }}
            >
              FIND IT →
            </a>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px dotted var(--rule)', padding: '12px 0' }}>
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
            fontSize: 15, color: 'var(--ink)', margin: '0 0 4px',
          }}
        >
          Something by {playwright} might be on.
        </p>
        <span
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
            letterSpacing: '0.06em', color: 'var(--ink-ghost)',
          }}
        >
          SAME WRITER · SAME STRANGENESS
        </span>
      </div>
    </div>
  )
}
