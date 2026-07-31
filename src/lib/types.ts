export interface Profile {
  id: string
  username: string | null
  age_range: '20s' | '30s' | '40s' | '50+' | null
  home_city: string
  experience_level: 'never' | 'few' | 'regular' | 'professional' | null
  interests: string[]
  belt_level: number
  shows_seen_count: number
  venues_visited_count: number
  reviews_written_count: number
  onboarding_complete: boolean
  avatar_url: string | null
  created_at: string
}

export interface Venue {
  id: string
  name: string
  slug: string
  description: string | null
  venue_type: 'storefront' | 'institutional' | 'experimental' | 'school' | null
  address: string | null
  neighborhood: string | null
  city: string
  latitude: number | null
  longitude: number | null
  price_range: '$' | '$$' | '$$$' | null
  website_url: string | null
  photo_url: string | null
  genre_tags: string[]
  accessibility_info: string | null
  created_at: string
}

export interface Event {
  id: string
  venue_id: string
  title: string
  slug: string
  description: string | null
  event_type: 'show' | 'class' | 'workshop' | 'festival' | 'open-call' | null
  genre_tags: string[]
  start_date: string | null
  end_date: string | null
  show_times: Record<string, unknown> | null
  price_min: number | null
  price_max: number | null
  ticket_url: string | null
  hottix_available: boolean
  photo_url: string | null
  community_rating: number | null
  rating_count: number
  created_at: string
  venue?: Venue
}

export type WatchlistStatus = 'want_to_see' | 'seeing' | 'seen'

export interface WatchlistItem {
  id: string
  user_id: string
  event_id: string
  status: WatchlistStatus
  rating: number | null
  reflection: string | null
  seen_date: string | null
  created_at: string
  updated_at: string
  event?: Event & { venue?: Venue }
}

export interface Review {
  id: string
  user_id: string
  event_id: string
  rating: number
  title: string | null
  body: string | null
  contains_spoilers: boolean
  helpful_count: number
  created_at: string
  profile?: Pick<Profile, 'id' | 'username' | 'belt_level'>
}

export interface LearningContent {
  id: string
  slug: string
  title: string
  body: string | null
  category: 'venue' | 'playwright' | 'genre' | 'guide' | 'history' | null
  belt_requirement: number
  related_venue_ids: string[]
  photo_url: string | null
  created_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  genres_explored: string[]
  venues_visited: string[]
  learning_modules_completed: string[]
  friends_invited: number
  opening_nights_attended: number
  ushering_count: number
  belt_history: { belt: number; earned_at: string }[]
  created_at: string
  updated_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  profile?: Pick<Profile, 'id' | 'username' | 'belt_level' | 'avatar_url'>
}

export const BELT_NAMES = [
  'White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black',
] as const

export const BELT_COLORS: Record<number, string> = {
  0: 'bg-white text-slate-900',
  1: 'bg-yellow-400 text-slate-900',
  2: 'bg-orange-500 text-white',
  3: 'bg-green-500 text-white',
  4: 'bg-blue-500 text-white',
  5: 'bg-purple-500 text-white',
  6: 'bg-amber-800 text-white',
  7: 'bg-slate-900 text-white',
}
