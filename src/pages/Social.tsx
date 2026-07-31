import { useState } from 'react'
import { Users, UserPlus } from 'lucide-react'
import { useFriendships } from '../hooks/useFriendships'
import { FriendsList } from '../components/FriendsList'
import { AddFriend } from '../components/AddFriend'
import { ActivityFeed } from '../components/ActivityFeed'

export function Social() {
  const { friends, pending, loading, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers } = useFriendships()
  const [showAddFriend, setShowAddFriend] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-amber-400" />
          <h2 className="text-white font-medium">Social</h2>
        </div>
        <button
          onClick={() => setShowAddFriend(true)}
          className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1.5 rounded-md hover:bg-amber-400/20 transition-colors"
        >
          <UserPlus size={14} />
          Add Friend
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
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
