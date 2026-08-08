import { useFriendActivity } from '../hooks/useFriendActivity'
import { EmotionPill } from './EmotionPill'

export function TonightFriends() {
  const { activities, loading } = useFriendActivity()

  if (loading) return null

  return (
    <div style={{ padding: '16px 20px 14px' }}>
      <div
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          color: 'var(--ink-faint)',
          marginBottom: 12,
        }}
      >
        YOUR PEOPLE WENT OUT
      </div>

      {activities.length === 0 ? (
        <div>
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 14.5,
              color: 'var(--ink-dim)',
              fontStyle: 'italic',
            }}
          >
            Nobody here yet.
          </p>
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 13.5,
              color: 'var(--ink-faint)',
              marginTop: 4,
            }}
          >
            Theater is better with one other person. Bring one.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activities.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'var(--rule)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 16, color: 'var(--ink-faint)' }}>
                    {a.friendName[0]?.toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                {/* Sentence */}
                <p
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 14.5,
                    lineHeight: 1.35,
                    color: 'var(--ink-dim)',
                    margin: 0,
                  }}
                >
                  <span style={{ color: 'var(--ink)' }}>{a.friendName}</span>
                  {' saw '}
                  <span style={{ fontStyle: 'italic', color: 'var(--ink)' }}>{a.showTitle}</span>
                </p>

                {/* Emotion pills */}
                {a.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-1" style={{ marginTop: 6 }}>
                    {a.emotions.map(e => (
                      <EmotionPill key={e} emotion={e} />
                    ))}
                  </div>
                )}

                {/* Quote */}
                {a.quote && (
                  <p
                    style={{
                      fontFamily: "'Newsreader', Georgia, serif",
                      fontStyle: 'italic',
                      fontSize: 13.5,
                      color: 'var(--ink-dim)',
                      borderLeft: '2px solid var(--rule)',
                      paddingLeft: 10,
                      marginTop: 6,
                      marginBottom: 0,
                    }}
                  >
                    {a.quote}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
