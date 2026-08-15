import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchEmotionAggregates } from '../lib/queries'
import { emotionBySlug } from '../lib/emotions'
import type { SpectrumSlice } from '../lib/types'

export function useEmotionAggregates(mode: 'season' | 'all-time') {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.profile.emotionAggregates(user?.id ?? '', mode),
    queryFn: () => fetchEmotionAggregates(user!.id, mode),
    enabled: !!user,
  })

  return {
    slices: data?.slices ?? [],
    totalCards: data?.totalCards ?? 0,
    loading: isLoading,
  }
}

export function personalInsight(slices: SpectrumSlice[]): string {
  if (slices.length === 0) return ''
  const top1 = emotionBySlug(slices[0].emotion)
  const top2 = slices.length > 1 ? emotionBySlug(slices[1].emotion) : null
  if (top1 && top2) {
    return `You are, statistically, a person who likes to be ${top1.label.toLowerCase()} and then ${top2.label.toLowerCase()}.`
  }
  if (top1) {
    return `Mostly ${top1.label.toLowerCase()}. That's your palette so far.`
  }
  return ''
}
