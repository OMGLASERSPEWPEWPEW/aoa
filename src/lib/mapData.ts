import { supabase } from './supabase'
import { EMOTIONS, base } from './emotions'
import type { Venue, Event } from './types'

export interface MapData {
  venues: Venue[]
  events: Event[]
  visitCounts: Record<string, number>
  lastVisitDates: Record<string, string>
  venueEmotionColors: Record<string, string>
}

export async function fetchMapData(userId: string | null): Promise<MapData> {
  const [venueRes, eventRes] = await Promise.all([
    supabase.from('venues').select('*').not('latitude', 'is', null).not('longitude', 'is', null),
    supabase.from('events').select('*, venue:venues(*)').order('start_date', { ascending: true }),
  ])
  const venues = (venueRes.data as Venue[]) ?? []
  const events = (eventRes.data as Event[]) ?? []

  const visitCounts: Record<string, number> = {}
  const lastVisitDates: Record<string, string> = {}
  const venueEmotionColors: Record<string, string> = {}

  if (userId) {
    const { data: watchlist } = await supabase
      .from('watchlist')
      .select('event_id, seen_date, emotions, events(venue_id)')
      .eq('user_id', userId)
      .eq('status', 'seen')
    for (const w of watchlist ?? []) {
      const vid = (w as any).events?.venue_id
      if (vid) {
        visitCounts[vid] = (visitCounts[vid] ?? 0) + 1
        const sd = (w as any).seen_date
        if (sd && (!lastVisitDates[vid] || sd > lastVisitDates[vid])) {
          lastVisitDates[vid] = sd
        }
        const emotions = (w as any).emotions as string[] | null
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
  return ['map-data', userId, lastScrapeTs]
}
