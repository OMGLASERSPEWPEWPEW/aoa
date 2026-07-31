import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Friendship, Profile } from '../lib/types'

export function useFriendships() {
  const { user } = useAuth()
  const [friends, setFriends] = useState<Friendship[]>([])
  const [pending, setPending] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFriendships = useCallback(async () => {
    if (!user) return

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (!data) { setLoading(false); return }

    const otherUserIds = data.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, belt_level, avatar_url')
      .in('id', otherUserIds)

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

    const enriched = data.map(f => ({
      ...f,
      profile: profileMap.get(f.requester_id === user.id ? f.addressee_id : f.requester_id) as Friendship['profile'],
    }))

    setFriends(enriched.filter(f => f.status === 'accepted'))
    setPending(enriched.filter(f => f.status === 'pending' && f.addressee_id === user.id))
    setLoading(false)
  }, [user])

  useEffect(() => { fetchFriendships() }, [fetchFriendships])

  const sendRequest = useCallback(async (addresseeId: string) => {
    if (!user) return
    await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: 'pending',
    })
    await fetchFriendships()
  }, [user, fetchFriendships])

  const acceptRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    await fetchFriendships()
  }, [fetchFriendships])

  const declineRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships')
      .update({ status: 'declined' })
      .eq('id', friendshipId)
    await fetchFriendships()
  }, [fetchFriendships])

  const removeFriend = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await fetchFriendships()
  }, [fetchFriendships])

  const searchUsers = useCallback(async (query: string): Promise<Pick<Profile, 'id' | 'username' | 'belt_level' | 'avatar_url'>[]> => {
    if (!query || query.length < 2) return []
    const { data } = await supabase
      .from('profiles')
      .select('id, username, belt_level, avatar_url')
      .ilike('username', `%${query}%`)
      .neq('id', user?.id)
      .limit(10)
    return (data ?? []) as Pick<Profile, 'id' | 'username' | 'belt_level' | 'avatar_url'>[]
  }, [user])

  return { friends, pending, loading, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers, refetch: fetchFriendships }
}
