import { useParams, useNavigate } from 'react-router-dom'
import { useArtist } from '../hooks/useArtist'
import { useAuth } from '../contexts/AuthContext'
import { SpectrumBar } from '../components/SpectrumBar'
import { InterpretationSentence } from '../components/InterpretationSentence'

export function ArtistDetail() {
  const { artistId } = useParams<{ artistId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    artist, credits, spectrum, totalCards,
    isFollowing, userSeenCount, loading, toggleFollow,
  } = useArtist(artistId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Artist not found.
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const currentCredits = credits.filter(c => c.event && c.event.end_date && c.event.end_date >= today)
  const pastCredits = credits.filter(c => !currentCredits.includes(c))

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero */}
      <div
        style={{
          height: 158, position: 'relative',
          background: 'var(--gold-gradient)',
        }}
      >
        {artist.headshot_url && (
          <img
            src={artist.headshot_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          />
        )}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(12,10,5,0.5) 0%, rgba(12,10,5,0.05) 38%, rgba(12,10,5,0.97))',
          }}
        />
        <div style={{ position: 'absolute', bottom: 12, left: 20, right: 20 }}>
          {artist.affiliation && (
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                letterSpacing: '0.16em', color: 'var(--accent)',
                display: 'block', marginBottom: 4,
              }}
            >
              {artist.affiliation.toUpperCase()}
            </span>
          )}
          <h1
            style={{
              fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
              fontSize: 32, fontWeight: 400, color: 'var(--ink)', margin: 0,
              lineHeight: 1.05,
            }}
          >
            {artist.name}
          </h1>
        </div>
      </div>

      {/* Your relationship row */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}
      >
        <div>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
              letterSpacing: '0.06em', color: 'var(--ink-ghost)',
            }}
          >
            {userSeenCount > 0
              ? <>YOU'VE SEEN {userSeenCount === 1 ? 'HER' : 'THEM'} <span style={{ color: 'var(--accent)' }}>{userSeenCount}</span> {userSeenCount === 1 ? 'TIME' : 'TIMES'}</>
              : 'NEW TO YOU'}
          </span>
        </div>
        {user && (
          <button
            onClick={toggleFollow}
            style={{
              height: 44, padding: '0 14px', borderRadius: 3, cursor: 'pointer',
              fontFamily: "'Courier Prime', monospace", fontSize: 10,
              ...(isFollowing
                ? {
                    color: 'var(--accent-text)',
                    backgroundColor: 'var(--accent-bg)',
                    border: '1px solid var(--accent-border)',
                  }
                : {
                    color: 'var(--ink-dim)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--rule)',
                  }),
            }}
          >
            {isFollowing ? 'FOLLOWING ✓' : 'FOLLOW'}
          </button>
        )}
      </div>

      {/* WHAT ROOMS FEEL WHEN SHE'S IN THEM */}
      {(spectrum.length > 0 || totalCards >= 0) && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <span
            style={{
              fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
              letterSpacing: '0.18em', color: 'var(--ink-faint)',
              display: 'block', marginBottom: 10,
            }}
          >
            WHAT ROOMS FEEL WHEN {artist.name.split(' ')[0].toUpperCase()}'S IN THEM
          </span>
          <SpectrumBar slices={spectrum} height={11} totalCards={totalCards} />
          {spectrum.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <InterpretationSentence slices={spectrum} totalCards={totalCards} />
            </div>
          )}
        </div>
      )}

      {/* ON STAGE NOW */}
      {currentCredits.length > 0 && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <div
              style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: 'var(--live)',
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                letterSpacing: '0.12em', color: 'var(--ink-faint)',
              }}
            >
              ON STAGE NOW
            </span>
          </div>
          {currentCredits.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/app/show/${c.event_id}`)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                  fontSize: 20, color: 'var(--ink)',
                }}
              >
                {c.event?.title ?? c.role ?? 'Unknown production'}
              </div>
              {c.event?.venue && (
                <div
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif", fontSize: 14,
                    color: 'var(--ink-dim)', marginTop: 2,
                  }}
                >
                  at {c.event.venue.name}
                </div>
              )}
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 10,
                  color: 'var(--accent)', display: 'inline-block', marginTop: 4,
                }}
              >
                GET A TICKET →
              </span>
            </button>
          ))}
        </div>
      )}

      {/* EVERYTHING ELSE */}
      {pastCredits.length > 0 && (
        <div style={{ padding: '14px 20px' }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                letterSpacing: '0.18em', color: 'var(--ink-faint)',
              }}
            >
              EVERYTHING ELSE
            </span>
            <span
              style={{
                fontFamily: "'Courier Prime', monospace", fontSize: 9.5,
                color: 'var(--ink-ghost)',
              }}
            >
              {pastCredits.length} PRODUCTION{pastCredits.length !== 1 ? 'S' : ''}
            </span>
          </div>
          {pastCredits.map((c, i) => {
            const year = c.event?.start_date
              ? new Date(c.event.start_date + 'T00:00:00').getFullYear()
              : null
            return (
              <div key={c.id}>
                {i > 0 && <div style={{ borderTop: '1px solid var(--rule-soft)', margin: '8px 0' }} />}
                <button
                  onClick={() => navigate(`/app/show/${c.event_id}`)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      style={{
                        fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic',
                        fontSize: 15.5, color: 'var(--ink)',
                      }}
                    >
                      {c.event?.title ?? c.role ?? 'Unknown'}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Courier Prime', monospace", fontSize: 10,
                        color: 'var(--ink-ghost)',
                      }}
                    >
                      {year}
                    </span>
                  </div>
                  {c.event?.venue && (
                    <span
                      style={{
                        fontFamily: "'Courier Prime', monospace", fontSize: 10,
                        color: 'var(--ink-faint)',
                      }}
                    >
                      {c.event.venue.name.toUpperCase()}
                      {c.event.venue.neighborhood ? ` · ${c.event.venue.neighborhood.toUpperCase()}` : ''}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Provenance footer */}
      <div style={{ padding: '14px 20px 24px', borderTop: '1px solid var(--rule)' }}>
        <p
          style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 9,
            color: 'var(--ink-ghost)', margin: 0, lineHeight: 1.5,
          }}
        >
          CREDITS FROM OUR OWN RECORD SINCE 2021, PLUS PUBLIC LISTINGS. MISSING SOMETHING? <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>TELL US →</span>
        </p>
      </div>
    </div>
  )
}
