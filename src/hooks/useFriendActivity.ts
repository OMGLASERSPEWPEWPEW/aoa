import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Emotion } from '../lib/types'

export interface FriendActivity {
  friendName: string
  avatarUrl: string | null
  showTitle: string
  emotions: Emotion[]
  quote: string | null
  seenDate: string
}

export function useFriendActivity() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<FriendActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function load() {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)

      if (!friendships || friendships.length === 0) {
        setLoading(false)
        return
      }

      const friendIds = friendships.map(f =>
        f.requester_id === user!.id ? f.addressee_id : f.requester_id
      )

      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

      const { data: items } = await supabase
        .from('watchlist')
        .select('emotions, reflection, seen_date, event:events(title), profile:profiles!watchlist_user_id_fkey(username, avatar_url, share_reflections)')
        .in('user_id', friendIds)
        .eq('status', 'seen')
        .gte('seen_date', twoWeeksAgo.toISOString().split('T')[0])
        .order('seen_date', { ascending: false })
        .limit(10)

      const result: FriendActivity[] = (items ?? []).map((item: any) => {
        const shareReflections = item.profile?.share_reflections !== false
        return {
          friendName: item.profile?.username ?? 'Someone',
          avatarUrl: item.profile?.avatar_url ?? null,
          showTitle: item.event?.title ?? 'a show',
          emotions: item.emotions ?? [],
          quote: shareReflections ? truncateQuote(item.reflection) : null,
          seenDate: item.seen_date,
        }
      })

      setActivities(result)
      setLoading(false)
    }

    load()
  }, [user])

  return { activities, loading }
}

function truncateQuote(text: string | null): string | null {
  if (!text) return null
  if (text.length <= 90) return `“${text}”`
  const truncated = text.slice(0, 90).replace(/\s+\S*$/, '')
  return `“${truncated}…”`
}
