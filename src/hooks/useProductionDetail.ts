import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { fetchEventById, fetchEventEmotionCounts } from '../lib/queries'
import type { Event, SpectrumSlice } from '../lib/types'

export function useProductionDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(eventId ?? ''),
    queryFn: async (): Promise<{
      event: Event | null
      spectrum: SpectrumSlice[]
      totalCards: number
    }> => {
      const [event, emotionCounts] = await Promise.all([
        fetchEventById(eventId!),
        fetchEventEmotionCounts(eventId!),
      ])

      let spectrum: SpectrumSlice[] = []
      let totalCards = 0

      if (emotionCounts.length > 0) {
        const total = emotionCounts.reduce((s, r) => s + (r.pick_count ?? 0), 0)
        totalCards = Math.ceil(total / 3)
        spectrum = emotionCounts
          .map((r) => ({
            emotion: r.emotion_slug as SpectrumSlice['emotion'],
            pct: total > 0 ? Math.round((r.pick_count / total) * 100) : 0,
          }))
          .filter((s) => s.pct > 0)
      }

      return { event, spectrum, totalCards }
    },
    enabled: !!eventId,
  })
}
