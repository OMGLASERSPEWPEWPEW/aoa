import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PlayWaiting, PlayWaitingTrend } from '../lib/types'

interface PlayInterestState {
  isWaiting: boolean
  waitingCount: number
  trend: PlayWaitingTrend[]
  loading: boolean
  toggle: () => Promise<void>
}

export function usePlayInterest(playId: string | undefined): PlayInterestState {
  const { user } = useAuth()
  const [isWaiting, setIsWaiting] = useState(false)
  const [waitingCount, setWaitingCount] = useState(0)
  const [trend, setTrend] = useState<PlayWaitingTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playId) return

    async function fetch() {
      setLoading(true)

      if (user) {
        const { data } = await supabase
          .from('play_interest')
          .select('id')
          .eq('user_id', user.id)
          .eq('play_id', playId!)
          .maybeSingle()
        setIsWaiting(!!data)
      }

      const { data: countData } = await supabase
        .from('play_waiting_counts')
        .select('waiting')
        .eq('play_id', playId!)
        .maybeSingle()
      setWaitingCount((countData as PlayWaiting | null)?.waiting ?? 0)

      const { data: trendData } = await supabase
        .from('play_waiting_trend')
        .select('*')
        .eq('play_id', playId!)
        .order('month', { ascending: true })
      setTrend((trendData as PlayWaitingTrend[] | null) ?? [])
      setLoading(false)
    }

    fetch()
  }, [playId, user])

  const toggle = useCallback(async () => {
    if (!user || !playId) return

    if (isWaiting) {
      setIsWaiting(false)
      setWaitingCount(c => Math.max(0, c - 1))
      await supabase
        .from('play_interest')
        .delete()
        .eq('user_id', user.id)
        .eq('play_id', playId)
    } else {
      setIsWaiting(true)
      setWaitingCount(c => c + 1)

      const { data: profile } = await supabase
        .from('profiles')
        .select('home_city')
        .eq('id', user.id)
        .single()

      await supabase
        .from('play_interest')
        .insert({
          user_id: user.id,
          play_id: playId,
          city: profile?.home_city ?? 'chicago',
        })
    }
  }, [user, playId, isWaiting])

  return { isWaiting, waitingCount, trend, loading, toggle }
}
