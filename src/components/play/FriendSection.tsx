export interface FriendSectionProps {
  friendCount: number
  waitingFriends: number
}

export function FriendSection({ friendCount, waitingFriends }: FriendSectionProps) {
  if (friendCount === 0 && waitingFriends === 0) return null

  return (
    <div style={{ padding: '14px 20px 24px', borderTop: '1px solid var(--rule)' }}>
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9.5,
          letterSpacing: '0.18em',
          color: 'var(--ink-faint)',
          display: 'block',
          marginBottom: 10,
        }}
      >
        YOUR PEOPLE
      </span>
      <p
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 10,
          color: 'var(--ink-ghost)',
          margin: 0,
        }}
      >
        {friendCount > 0 && `${friendCount} ${friendCount === 1 ? 'FRIEND HAS' : 'FRIENDS HAVE'} SEEN IT`}
        {friendCount > 0 && waitingFriends > 0 && ' · '}
        {waitingFriends > 0 && `${waitingFriends} ${waitingFriends === 1 ? 'IS' : 'ARE'} WAITING`}
      </p>
    </div>
  )
}
