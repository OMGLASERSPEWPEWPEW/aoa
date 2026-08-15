import { EMOTIONS, base } from './emotions'
import { fetchVenuesWithCoords, fetchEventsForMap, fetchWatchlistForMap } from './queries'
import { queryKeys } from './queryKeys'
import type { MapData, WatchlistMapJoin } from './types'

export async function fetchMapData(userId: string | null): Promise<MapData> {
  const [venues, events] = await Promise.all([
    fetchVenuesWithCoords(),
    fetchEventsForMap(),
  ])

  const visitCounts: Record<string, number> = {}
  const lastVisitDates: Record<string, string> = {}
  const venueEmotionColors: Record<string, string> = {}

  if (userId) {
    const watchlist: WatchlistMapJoin[] = await fetchWatchlistForMap(userId)
    for (const w of watchlist) {
      const vid = w.events?.[0]?.venue_id
      if (vid) {
        visitCounts[vid] = (visitCounts[vid] ?? 0) + 1
        const sd = w.seen_date
        if (sd && (!lastVisitDates[vid] || sd > lastVisitDates[vid])) {
          lastVisitDates[vid] = sd
        }
        const emotions = w.emotions as string[] | null
        if (emotions?.length && !venueEmotionColors[vid]) {
          const def = EMOTIONS.find(e => e.slug === emotions[0])
          if (def) venueEmotionColors[vid] = base(def)
        }
      }
    }
  }

  return { venues, events, visitCounts, lastVisitDates, venueEmotionColors }
}

export function mapDataQueryKey(userId: string | null, lastScrapeTs: string | null) {
  return queryKeys.mapData(userId, lastScrapeTs)
}
