/**
 * Centralized Supabase fetch functions — read-only.
 * Every function returns typed data with no `as any` casts.
 */
import { supabase } from './supabase'
import type {
  Play,
  Event,
  Venue,
  Profile,
  UserProgress,
  WatchlistItem,
  WatchlistMapJoin,
  Review,
  Friendship,
  EventEmotionCount,
  QueueItem,
  AuditVenue,
  CostByModel,
  CostByFeature,
  DailyCost,
  TrendBucket,
  EventSpectrumRow,
} from './types'
import type { SpectrumSlice } from './emotions'
import type { VenueCoverageMetrics } from '../../supabase/functions/_shared/scraper/types'

// ---------------------------------------------------------------------------
// Plays
// ---------------------------------------------------------------------------

export async function fetchPlays(): Promise<Play[]> {
  const { data } = await supabase
    .from('plays')
    .select('*')
    .order('title', { ascending: true })
  return (data ?? []) as Play[]
}

export async function fetchPlayById(id: string): Promise<Play | null> {
  const { data } = await supabase
    .from('plays')
    .select('*')
    .eq('id', id)
    .single()
  return (data as Play | null) ?? null
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function fetchEventsWithJoins(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, venue:venues(*), play:plays(*)')
    .order('start_date', { ascending: true })
  if (error) console.error('[queries] fetchEventsWithJoins:', error.message)
  return (data ?? []) as Event[]
}

export async function fetchEventsForMap(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, venue:venues(*)')
    .order('start_date', { ascending: true })
  if (error) console.error('[queries] fetchEventsForMap:', error.message)
  return (data ?? []) as Event[]
}

export async function fetchEventById(id: string): Promise<Event | null> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*), play:plays(*)')
    .eq('id', id)
    .single()
  return (data as Event | null) ?? null
}

export async function fetchEventsByPlayId(playId: string): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*)')
    .eq('play_id', playId)
    .order('start_date', { ascending: false })
  return (data ?? []) as Event[]
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export async function fetchVenuesWithCoords(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
  if (error) console.error('[queries] fetchVenuesWithCoords:', error.message)
  return (data ?? []) as Venue[]
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return (data as Profile | null) ?? null
}

export async function fetchUserProgress(userId: string): Promise<UserProgress | null> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  return (data as UserProgress | null) ?? null
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('*, event:events(*, venue:venues(*))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as WatchlistItem[]
}

export async function fetchWatchlistForMap(userId: string): Promise<WatchlistMapJoin[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('event_id, seen_date, emotions, events(venue_id)')
    .eq('user_id', userId)
    .eq('status', 'seen')
  return (data ?? []) as WatchlistMapJoin[]
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function fetchReviewsByEvent(eventId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*, profile:profiles(id, username, house_rank)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Review[]
}

// ---------------------------------------------------------------------------
// Friendships
// ---------------------------------------------------------------------------

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  return (data ?? []) as Friendship[]
}

// ---------------------------------------------------------------------------
// Event emotion counts
// ---------------------------------------------------------------------------

export async function fetchEventEmotionCounts(eventId: string): Promise<EventEmotionCount[]> {
  const { data } = await supabase
    .from('event_emotion_counts')
    .select('*')
    .eq('event_id', eventId)
  return (data ?? []) as EventEmotionCount[]
}

// ---------------------------------------------------------------------------
// Friend activity
// ---------------------------------------------------------------------------

export interface RawFriendActivityRow {
  emotions: string[] | null
  reflection: string | null
  seen_date: string
  event: { title: string } | null
  profile: { username: string | null; avatar_url: string | null; share_reflections: boolean } | null
}

export async function fetchFriendActivity(
  friendIds: string[],
  sinceDateIso: string,
): Promise<RawFriendActivityRow[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('emotions, reflection, seen_date, event:events(title), profile:profiles!watchlist_user_id_fkey(username, avatar_url, share_reflections)')
    .in('user_id', friendIds)
    .eq('status', 'seen')
    .gte('seen_date', sinceDateIso)
    .order('seen_date', { ascending: false })
    .limit(10)

  if (!data) return []

  // Supabase may return joined rows as arrays depending on the FK relationship.
  // Normalize to the expected single-object shape.
  return data.map((row) => {
    const r = row as Record<string, unknown>
    const rawEvent = r.event
    const rawProfile = r.profile

    const event = Array.isArray(rawEvent)
      ? (rawEvent[0] as RawFriendActivityRow['event'] ?? null)
      : (rawEvent as RawFriendActivityRow['event'] ?? null)

    const profile = Array.isArray(rawProfile)
      ? (rawProfile[0] as RawFriendActivityRow['profile'] ?? null)
      : (rawProfile as RawFriendActivityRow['profile'] ?? null)

    return {
      emotions: r.emotions as string[] | null,
      reflection: r.reflection as string | null,
      seen_date: r.seen_date as string,
      event,
      profile,
    }
  })
}

// ---------------------------------------------------------------------------
// Venue coverage (RPC)
// ---------------------------------------------------------------------------

export async function fetchVenueCoverage(): Promise<{ data: VenueCoverageMetrics | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_venue_coverage_metrics')
  return {
    data: (data as VenueCoverageMetrics | null) ?? null,
    error: error?.message ?? null,
  }
}

// ---------------------------------------------------------------------------
// Discovery queue
// ---------------------------------------------------------------------------

export async function fetchDiscoveryQueue(): Promise<QueueItem[]> {
  const { data } = await supabase
    .from('venue_discovery_queue')
    .select('id, raw_name, raw_address, raw_website_url, raw_description, enriched_venue_type, enriched_calendar_url, enriched_photo_url, enriched_latitude, enriched_longitude, enriched_venue_type_confidence, enrichment_status, created_at')
    .eq('promoted', false)
    .eq('dedup_status', 'new')
    .order('created_at', { ascending: false })
  return (data ?? []) as QueueItem[]
}

// ---------------------------------------------------------------------------
// Venue audit
// ---------------------------------------------------------------------------

export interface VenueAuditRow {
  id: string
  name: string
  neighborhood: string | null
  venue_type: string | null
  calendar_url: string | null
  photo_url: string | null
  source: string | null
}

export interface EventCountRow {
  venue_id: string
}

export async function fetchVenueAuditRows(): Promise<VenueAuditRow[]> {
  const { data } = await supabase
    .from('venues')
    .select('id, name, neighborhood, venue_type, calendar_url, photo_url, source')
  return (data ?? []) as VenueAuditRow[]
}

export async function fetchEventVenueIds(): Promise<EventCountRow[]> {
  const { data } = await supabase
    .from('events')
    .select('venue_id')
  return (data ?? []) as EventCountRow[]
}

export function buildAuditVenues(venueRows: VenueAuditRow[], eventCounts: EventCountRow[]): AuditVenue[] {
  const countMap = new Map<string, number>()
  for (const e of eventCounts) {
    countMap.set(e.venue_id, (countMap.get(e.venue_id) ?? 0) + 1)
  }
  return venueRows.map((v) => ({
    id: v.id,
    name: v.name,
    neighborhood: v.neighborhood,
    venue_type: v.venue_type ?? 'unknown',
    has_calendar_url: !!v.calendar_url,
    has_photo: !!v.photo_url,
    event_count: countMap.get(v.id) ?? 0,
    source: v.source ?? 'manual',
  }))
}

// ---------------------------------------------------------------------------
// Cost dashboard (RPCs)
// ---------------------------------------------------------------------------

export async function fetchCostDashboard(days: number): Promise<{
  total: number
  byModel: CostByModel[]
  byFeature: CostByFeature[]
  dailySeries: DailyCost[]
}> {
  const dailyDays = Math.min(days, 30)
  const [totalRes, modelRes, featureRes, dailyRes] = await Promise.all([
    supabase.rpc('get_ai_cost_total', { p_days: days }),
    supabase.rpc('get_ai_cost_by_model', { p_days: days }),
    supabase.rpc('get_ai_cost_by_feature', { p_days: days }),
    supabase.rpc('get_ai_daily_cost', { p_days: dailyDays }),
  ])
  return {
    total: Number(totalRes.data ?? 0),
    byModel: (modelRes.data ?? []) as CostByModel[],
    byFeature: (featureRes.data ?? []) as CostByFeature[],
    dailySeries: ((dailyRes.data ?? []) as DailyCost[]).reverse(),
  }
}

// ---------------------------------------------------------------------------
// Play spectrum
// ---------------------------------------------------------------------------

export async function fetchPlaySpectrum(playId: string): Promise<{
  slices: SpectrumSlice[]
  totalCards: number
}> {
  const [specRes, totalRes] = await Promise.all([
    supabase
      .from('play_spectrum')
      .select('emotion, pct')
      .eq('play_id', playId),
    supabase
      .from('play_emotion_counts')
      .select('weight')
      .eq('play_id', playId),
  ])

  const slices: SpectrumSlice[] =
    specRes.data && specRes.data.length > 0
      ? (specRes.data as { emotion: string; pct: number }[])
          .map((r) => ({ emotion: r.emotion as SpectrumSlice['emotion'], pct: r.pct }))
          .sort((a, b) => b.pct - a.pct)
      : []

  const totalCards =
    totalRes.data && totalRes.data.length > 0
      ? Math.round((totalRes.data as { weight: number }[]).reduce((sum, r) => sum + r.weight, 0))
      : 0

  return { slices, totalCards }
}

// ---------------------------------------------------------------------------
// Play interest
// ---------------------------------------------------------------------------

export async function fetchPlayInterest(
  playId: string,
  userId: string | null,
  city: string,
): Promise<{
  isWaiting: boolean
  waitingCount: number
  trend: TrendBucket[]
}> {
  let isWaiting = false
  if (userId) {
    const { data } = await supabase
      .from('play_interest')
      .select('id')
      .eq('user_id', userId)
      .eq('play_id', playId)
      .maybeSingle()
    isWaiting = !!data
  }

  const { data: countData } = await supabase
    .from('play_waiting_counts')
    .select('waiting')
    .eq('play_id', playId)
    .eq('city', city)
    .maybeSingle()
  const waitingCount = (countData as { waiting: number } | null)?.waiting ?? 0

  const { data: trendData } = await supabase
    .from('play_waiting_trend')
    .select('month, count')
    .eq('play_id', playId)
    .eq('city', city)
    .order('month', { ascending: true })
    .limit(8)
  const trend = (trendData as TrendBucket[] | null) ?? []

  return { isWaiting, waitingCount, trend }
}

// ---------------------------------------------------------------------------
// Emotion aggregates (profile-level)
// ---------------------------------------------------------------------------

function currentSeason(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return year.toString()
}

export async function fetchEmotionAggregates(
  userId: string,
  mode: 'season' | 'all-time',
): Promise<{ slices: SpectrumSlice[]; totalCards: number }> {
  let query = supabase
    .from('profile_emotion_counts')
    .select('emotion, weight')
    .eq('user_id', userId)

  if (mode === 'season') {
    query = query.eq('season', currentSeason())
  }

  const { data } = await query

  if (!data || data.length === 0) {
    return { slices: [], totalCards: 0 }
  }

  const totalWeight = data.reduce((s, r) => s + Number(r.weight), 0)
  const totalCards = Math.ceil(totalWeight)

  const slices: SpectrumSlice[] = (data as { emotion: string; weight: number }[])
    .map((r) => ({
      emotion: r.emotion as SpectrumSlice['emotion'],
      pct: totalWeight > 0 ? Math.round((Number(r.weight) / totalWeight) * 100) : 0,
    }))
    .filter((s) => s.pct > 0)
    .sort((a, b) => b.pct - a.pct)

  return { slices, totalCards }
}

// ---------------------------------------------------------------------------
// Last scrape
// ---------------------------------------------------------------------------

export async function fetchLastScrape(): Promise<string | null> {
  const { data } = await supabase
    .from('scrape_logs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at ?? null
}

// ---------------------------------------------------------------------------
// Event spectrum (used by Discover emotion search)
// ---------------------------------------------------------------------------

export async function fetchEventSpectrumByEmotion(
  emotion: string,
  minPct: number = 25,
): Promise<EventSpectrumRow[]> {
  const { data } = await supabase
    .from('event_spectrum')
    .select('event_id, emotion, pct')
    .eq('emotion', emotion)
    .gte('pct', minPct)
  return (data ?? []) as EventSpectrumRow[]
}

// ---------------------------------------------------------------------------
// Play interest count (user-level, for MyShows)
// ---------------------------------------------------------------------------

export async function fetchPlayInterestCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('play_interest')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Watchlist seen-status check (for PlayDetail productions)
// ---------------------------------------------------------------------------

export async function fetchWatchlistSeenByEventIds(
  userId: string,
  eventIds: string[],
): Promise<{ event_id: string; seen_date: string | null }[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('event_id, seen_date')
    .eq('user_id', userId)
    .eq('status', 'seen')
    .in('event_id', eventIds)
  return (data ?? []) as { event_id: string; seen_date: string | null }[]
}

// ---------------------------------------------------------------------------
// Accepted friend IDs helper
// ---------------------------------------------------------------------------

export async function fetchAcceptedFriendIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

  if (!data || data.length === 0) return []

  return data.map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id,
  )
}

// ---------------------------------------------------------------------------
// Profile home_city lookup
// ---------------------------------------------------------------------------

export async function fetchProfileCity(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('home_city')
    .eq('id', userId)
    .single()
  return data?.home_city ?? 'chicago'
}

// ---------------------------------------------------------------------------
// User search (for friend lookup)
// ---------------------------------------------------------------------------

export async function fetchUserSearch(
  query: string,
  excludeUserId: string,
): Promise<Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]> {
  if (!query || query.length < 2) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, username, house_rank, avatar_url')
    .ilike('username', `%${query}%`)
    .neq('id', excludeUserId)
    .limit(10)
  return (data ?? []) as Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]
}

// ---------------------------------------------------------------------------
// Profiles by IDs (for friendship enrichment)
// ---------------------------------------------------------------------------

export async function fetchProfilesByIds(
  ids: string[],
): Promise<Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, username, house_rank, avatar_url')
    .in('id', ids)
  return (data ?? []) as Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>[]
}

// ---------------------------------------------------------------------------
// Events with venue only (for Tonight/map, no play join)
// ---------------------------------------------------------------------------

export async function fetchEventsWithVenue(): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*)')
    .order('start_date', { ascending: true })
  return (data ?? []) as Event[]
}
