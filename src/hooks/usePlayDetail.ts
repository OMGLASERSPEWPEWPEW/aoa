import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import {
  fetchPlayById,
  fetchEventsByPlayId,
  fetchWatchlistSeenByEventIds,
} from '../lib/queries'
import type { ProductionRow } from '../lib/types'

export function usePlayDetail(playId: string | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...queryKeys.plays.detail(playId ?? ''), 'page', user?.id ?? 'anon'],
    queryFn: async () => {
      const [play, events] = await Promise.all([
        fetchPlayById(playId!),
        fetchEventsByPlayId(playId!),
      ])

      let productions: ProductionRow[] = []
      if (events.length > 0 && user) {
        const seenRows = await fetchWatchlistSeenByEventIds(
          user.id,
          events.map((e) => e.id),
        )
        const seenSet = new Set(seenRows.map((r) => r.event_id))
        const seenDates: Record<string, string | null> = {}
        for (const r of seenRows) {
          seenDates[r.event_id] = r.seen_date
        }
        productions = events.map((event) => ({
          event,
          userSeen: seenSet.has(event.id),
          userSeenDate: seenDates[event.id] ?? null,
        }))
      } else {
        productions = events.map((event) => ({
          event,
          userSeen: false,
          userSeenDate: null,
        }))
      }

      return { play, productions }
    },
    enabled: !!playId,
  })
}
