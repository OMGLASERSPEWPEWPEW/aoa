import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchPlayInterest, fetchProfileCity } from '../lib/queries'
import type { TrendBucket } from '../lib/types'

export interface UsePlayInterestResult {
  isWaiting: boolean
  waitingCount: number
  trend: TrendBucket[]
  loading: boolean
  toggle: () => Promise<void>
}

interface InterestData {
  isWaiting: boolean
  waitingCount: number
  trend: TrendBucket[]
  city: string
}

export function usePlayInterest(playId: string): UsePlayInterestResult {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const qk = queryKeys.plays.interest(playId)

  const { data, isLoading } = useQuery({
    queryKey: qk,
    queryFn: async (): Promise<InterestData> => {
      const city = user ? await fetchProfileCity(user.id) : 'chicago'
      const result = await fetchPlayInterest(playId, user?.id ?? null, city)
      return { ...result, city }
    },
    enabled: !!playId,
  })

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!user || !data) throw new Error('Not ready')
      if (data.isWaiting) {
        await supabase
          .from('play_interest')
          .delete()
          .eq('user_id', user.id)
          .eq('play_id', playId)
      } else {
        await supabase
          .from('play_interest')
          .insert({ user_id: user.id, play_id: playId, city: data.city })
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<InterestData>(qk)
      if (previous) {
        queryClient.setQueryData<InterestData>(qk, {
          ...previous,
          isWaiting: !previous.isWaiting,
          waitingCount: previous.isWaiting
            ? Math.max(0, previous.waitingCount - 1)
            : previous.waitingCount + 1,
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk })
    },
  })

  const toggle = async () => {
    await toggleMutation.mutateAsync()
  }

  return {
    isWaiting: data?.isWaiting ?? false,
    waitingCount: data?.waitingCount ?? 0,
    trend: data?.trend ?? [],
    loading: isLoading,
    toggle,
  }
}
