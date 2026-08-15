import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchAcceptedFriendIds, fetchFriendActivity } from '../lib/queries'
import type { FriendActivity } from '../lib/types'

export function useFriendActivity() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.friendships.activity(user?.id ?? ''),
    queryFn: async (): Promise<FriendActivity[]> => {
      const friendIds = await fetchAcceptedFriendIds(user!.id)
      if (friendIds.length === 0) return []

      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      const sinceDateIso = twoWeeksAgo.toISOString().split('T')[0]

      const rows = await fetchFriendActivity(friendIds, sinceDateIso)

      return rows.map((item) => {
        const shareReflections = item.profile?.share_reflections !== false
        return {
          friendName: item.profile?.username ?? 'Someone',
          avatarUrl: item.profile?.avatar_url ?? null,
          showTitle: item.event?.title ?? 'a show',
          emotions: (item.emotions ?? []) as FriendActivity['emotions'],
          quote: shareReflections ? truncateQuote(item.reflection) : null,
          seenDate: item.seen_date,
        }
      })
    },
    enabled: !!user,
  })

  return {
    activities: data ?? [],
    loading: isLoading,
  }
}

function truncateQuote(text: string | null): string | null {
  if (!text) return null
  if (text.length <= 90) return `"${text}"`
  const truncated = text.slice(0, 90).replace(/\s+\S*$/, '')
  return `"${truncated}..."`
}
