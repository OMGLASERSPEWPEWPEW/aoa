import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fetchAcceptedFriendIds } from '../lib/queries'

export function usePlayFriends(playId: string) {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['play', playId, 'friends', user?.id ?? 'anon'],
    queryFn: async () => {
      const friendIds = await fetchAcceptedFriendIds(user!.id)
      if (friendIds.length === 0) return { friendCount: 0, waitingFriends: 0 }

      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('play_id', playId)

      let friendCount = 0
      if (events && events.length > 0) {
        const { count } = await supabase
          .from('watchlist')
          .select('id', { count: 'exact', head: true })
          .in('user_id', friendIds)
          .in('event_id', events.map((e) => e.id))
          .eq('status', 'seen')
        friendCount = count ?? 0
      }

      const { count: waitCount } = await supabase
        .from('play_interest')
        .select('id', { count: 'exact', head: true })
        .in('user_id', friendIds)
        .eq('play_id', playId)
      const waitingFriends = waitCount ?? 0

      return { friendCount, waitingFriends }
    },
    enabled: !!user && !!playId,
  })

  return {
    friendCount: data?.friendCount ?? 0,
    waitingFriends: data?.waitingFriends ?? 0,
  }
}
