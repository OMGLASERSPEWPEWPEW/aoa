import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchFriendships, fetchProfilesByIds, fetchUserSearch } from '../lib/queries'
import type { Friendship, Profile } from '../lib/types'

export function useFriendships() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.friendships.all(userId),
    queryFn: async () => {
      const raw = await fetchFriendships(userId)
      if (raw.length === 0) return { friends: [] as Friendship[], pending: [] as Friendship[] }

      const otherUserIds = raw.map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id,
      )
      const profiles = await fetchProfilesByIds(otherUserIds)
      const profileMap = new Map(profiles.map((p) => [p.id, p]))

      const enriched = raw.map((f) => ({
        ...f,
        profile: profileMap.get(
          f.requester_id === userId ? f.addressee_id : f.requester_id,
        ) as Friendship['profile'],
      }))

      return {
        friends: enriched.filter((f) => f.status === 'accepted'),
        pending: enriched.filter((f) => f.status === 'pending' && f.addressee_id === userId),
      }
    },
    enabled: !!user,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all(userId) })

  const sendMutation = useMutation({
    mutationFn: async (addresseeId: string) => {
      if (!user) throw new Error('Not authenticated')
      await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: addresseeId,
        status: 'pending',
      })
    },
    onSettled: invalidate,
  })

  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
    },
    onSettled: invalidate,
  })

  const declineMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await supabase
        .from('friendships')
        .update({ status: 'declined' })
        .eq('id', friendshipId)
    },
    onSettled: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await supabase.from('friendships').delete().eq('id', friendshipId)
    },
    onSettled: invalidate,
  })

  const sendRequest = async (addresseeId: string) => {
    await sendMutation.mutateAsync(addresseeId)
  }

  const acceptRequest = async (friendshipId: string) => {
    await acceptMutation.mutateAsync(friendshipId)
  }

  const declineRequest = async (friendshipId: string) => {
    await declineMutation.mutateAsync(friendshipId)
  }

  const removeFriend = async (friendshipId: string) => {
    await removeMutation.mutateAsync(friendshipId)
  }

  const searchUsers = useCallback(
    async (
      query: string,
    ): Promise<Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]> => {
      if (!user) return []
      return fetchUserSearch(query, user.id)
    },
    [user],
  )

  return {
    friends: data?.friends ?? [],
    pending: data?.pending ?? [],
    loading: isLoading,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    searchUsers,
    refetch,
  }
}
