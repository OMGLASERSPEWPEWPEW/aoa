import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { HOUSE_RANKS, type HouseRank } from '../lib/house'
import { RANK_CRITERIA } from '../lib/house'
import { SeatingChart } from '../components/SeatingChart'
import { StatStrip } from '../components/StatStrip'
import { HouseChips } from '../components/HouseChips'

export function Profile() {
  const { user } = useAuth()
  const { profile, loading } = useProfile()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  const rank = (profile?.house_rank ?? 0) as HouseRank
  const rankName = HOUSE_RANKS[rank]
  const displayName = profile?.username ?? user?.email?.split('@')[0] ?? 'Theater Explorer'
  const sinceDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
    : ''

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Gold gradient header */}
      <div
        style={{
          background: 'linear-gradient(180deg, oklch(0.16 0.04 55), #0c0a05)',
          padding: '14px 20px 18px',
          borderBottom: '1px solid #2b2720',
        }}
      >
        {/* Avatar + Name */}
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              backgroundColor: '#2b2720',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 22, color: '#625b4c' }}>
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 23,
                color: 'var(--ink)',
              }}
            >
              {displayName}
            </div>
            {sinceDate && (
              <div
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10,
                  color: '#625b4c',
                  letterSpacing: '0.06em',
                }}
              >
                CHICAGO · SINCE {sinceDate}
              </div>
            )}
          </div>
        </div>

        {/* Rank row */}
        <div className="flex items-baseline gap-2" style={{ marginBottom: 12 }}>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              letterSpacing: '0.1em',
              color: '#625b4c',
            }}
          >
            YOUR SEAT
          </span>
          <span
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 20,
              color: 'oklch(0.84 0.13 55)',
            }}
          >
            {rankName}
          </span>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9.5,
              color: '#4f4a3e',
            }}
          >
            {rank + 1} OF 7
          </span>
        </div>

        {/* Seating chart */}
        <SeatingChart rank={rank} />

        {/* Next-step sentence */}
        {rank < 6 && (
          <NextStepSentence rank={rank} />
        )}
      </div>

      {/* Stat strip */}
      <StatStrip
        shows={profile?.shows_seen_count ?? 0}
        venues={profile?.venues_visited_count ?? 0}
        wrote={profile?.reviews_written_count ?? 0}
        ushered={profile?.ushered_count ?? 0}
      />

      {/* Your palette this season */}
      <div style={{ padding: '16px 20px' }}>
        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#625b4c',
            marginBottom: 10,
          }}
        >
          YOUR PALETTE THIS SEASON
        </div>
        <div
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: '#9c9586',
            fontStyle: 'italic',
          }}
        >
          Log more shows to see your palette.
        </div>
      </div>

      {/* The House */}
      <div style={{ padding: '0 20px 24px' }}>
        <div
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#625b4c',
            marginBottom: 10,
          }}
        >
          THE HOUSE
        </div>
        <HouseChips currentRank={rank} />
      </div>
    </div>
  )
}

function NextStepSentence({ rank }: { rank: HouseRank }) {
  if (rank >= 6) return null
  const nextRank = HOUSE_RANKS[(rank + 1) as HouseRank]
  const criteria = RANK_CRITERIA[(rank + 1) as HouseRank]

  return (
    <p
      style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: 14.5,
        color: '#9c9586',
        marginTop: 14,
        lineHeight: 1.45,
      }}
    >
      {criteria} and you're in the{' '}
      <span style={{ fontStyle: 'italic', color: '#ebe5d6' }}>{nextRank}</span>.
    </p>
  )
}
