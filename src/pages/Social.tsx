import { useState } from 'react'
import { useFriendships } from '../hooks/useFriendships'
import { FriendsList } from '../components/FriendsList'
import { AddFriend } from '../components/AddFriend'

export function Social() {
  const { friends, pending, loading, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers } = useFriendships()
  const [showAddFriend, setShowAddFriend] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between"
        style={{ padding: 12, borderBottom: '1px solid var(--rule)' }}
      >
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
          }}
        >
          YOUR PEOPLE
        </span>
        <button
          onClick={() => setShowAddFriend(true)}
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + ADD FRIEND
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
        <FriendsList
          friends={friends}
          pending={pending}
          onAccept={acceptRequest}
          onDecline={declineRequest}
          onRemove={removeFriend}
        />

      </div>

      {showAddFriend && (
        <AddFriend
          onSearch={searchUsers}
          onSendRequest={sendRequest}
          onClose={() => setShowAddFriend(false)}
        />
      )}
    </div>
  )
}
