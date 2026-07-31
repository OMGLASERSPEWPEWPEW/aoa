import { useState } from 'react'
import { useFriendships } from '../hooks/useFriendships'
import { FriendsList } from '../components/FriendsList'
import { AddFriend } from '../components/AddFriend'
import { ActivityFeed } from '../components/ActivityFeed'

export function Social() {
  const { friends, pending, loading, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers } = useFriendships()
  const [showAddFriend, setShowAddFriend] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between"
        style={{ padding: 12, borderBottom: '1px solid #2b2720' }}
      >
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#625b4c',
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
            color: 'oklch(0.80 0.14 55)',
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

        {friends.length > 0 && (
          <ActivityFeed friendIds={friends.map(f => f.profile?.id).filter(Boolean) as string[]} />
        )}
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
