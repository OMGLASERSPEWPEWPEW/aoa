import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface TrendBucket {
  month: string
  count: number
}

export interface UsePlayInterestResult {
  isWaiting: boolean
  waitingCount: number
  trend: TrendBucket[]
  loading: boolean
  toggle: () => Promise<void>
}

export function usePlayInterest(playId: string): UsePlayInterestResult {
  const { user } = useAuth()
  const [isWaiting, setIsWaiting] = useState(false)
  const [waitingCount, setWaitingCount] = useState(0)
  const [trend, setTrend] = useState<TrendBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('chicago')

  useEffect(() => {
    if (!playId) return

    async function load() {
      setLoading(true)

      let userCity = 'chicago'
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('home_city')
          .eq('id', user.id)
          .single()
        userCity = profile?.home_city ?? 'chicago'
        setCity(userCity)
      }

      if (user) {
        const { data } = await supabase
          .from('play_interest')
          .select('id')
          .eq('user_id', user.id)
          .eq('play_id', playId)
          .maybeSingle()
        setIsWaiting(!!data)
      }

      const { data: countData } = await supabase
        .from('play_waiting_counts')
        .select('waiting')
        .eq('play_id', playId)
        .eq('city', userCity)
        .maybeSingle()
      setWaitingCount((countData as { waiting: number } | null)?.waiting ?? 0)

      const { data: trendData } = await supabase
        .from('play_waiting_trend')
        .select('month, count')
        .eq('play_id', playId)
        .eq('city', userCity)
        .order('month', { ascending: true })
        .limit(8)
      setTrend((trendData as TrendBucket[] | null) ?? [])

      setLoading(false)
    }

    load()
  }, [playId, user])

  const toggle = useCallback(async () => {
    if (!user || !playId) return

    if (isWaiting) {
      setIsWaiting(false)
      setWaitingCount(c => Math.max(0, c - 1))
      const { error } = await supabase
        .from('play_interest')
        .delete()
        .eq('user_id', user.id)
        .eq('play_id', playId)
      if (error) {
        setIsWaiting(true)
        setWaitingCount(c => c + 1)
      }
    } else {
      setIsWaiting(true)
      setWaitingCount(c => c + 1)
      const { error } = await supabase
        .from('play_interest')
        .insert({ user_id: user.id, play_id: playId, city })
      if (error) {
        setIsWaiting(false)
        setWaitingCount(c => Math.max(0, c - 1))
      }
    }
  }, [user, playId, isWaiting, city])

  return { isWaiting, waitingCount, trend, loading, toggle }
}
