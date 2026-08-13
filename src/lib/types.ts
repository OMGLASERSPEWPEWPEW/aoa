import type { Emotion, RoomVolume, SpectrumSlice } from './emotions'
import type { HouseRank } from './house'

export type { Emotion, RoomVolume, SpectrumSlice, HouseRank }

export interface Profile {
  id: string
  username: string | null
  age_range: '20s' | '30s' | '40s' | '50+' | null
  home_city: string
  experience_level: 'never' | 'few' | 'regular' | 'professional' | null
  interests: string[]
  house_rank: HouseRank
  shows_seen_count: number
  venues_visited_count: number
  reviews_written_count: number
  ushered_count: number
  onboarding_complete: boolean
  avatar_url: string | null
  share_reflections: boolean
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
  pay_what_you_can_days: string[]
  student_rush_price: number | null
  seat_count: number | null
  usher_signup_url: string | null
  created_at: string
}

export interface Play {
  id: string
  title: string
  slug: string
  playwright: string
  year_written: number | null
  awards: string[]
  synopsis: string | null
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
  cast_members: Array<{ name: string; role: string | null }> | null
  play_id: string | null
  extraction_confidence: number | null
  created_at: string
  venue?: Venue
  play?: Play
}

export type WatchlistStatus = 'want_to_see' | 'booked' | 'seen'

export interface WatchlistItem {
  id: string
  user_id: string
  event_id: string
  status: WatchlistStatus
  emotions: Emotion[]
  room_volume: RoomVolume | null
  reflection: string | null
  seen_date: string | null
  performance_at: string | null
  seat_note: string | null
  created_at: string
  updated_at: string
  event?: Event & { venue?: Venue }
}

export interface Review {
  id: string
  user_id: string
  event_id: string
  emotions: Emotion[]
  prompt: string | null
  title: string | null
  body: string | null
  contains_spoilers: boolean
  helpful_count: number
  created_at: string
  profile?: Pick<Profile, 'id' | 'username' | 'house_rank'>
}

export interface EventAccess {
  id: string
  event_id: string
  asl_dates: string[]
  relaxed_dates: string[]
  audio_described_dates: string[]
  open_caption_dates: string[]
  touch_tour_dates: string[]
  usher_slots: number
  runtime_minutes: number | null
  has_intermission: boolean | null
  content_notes: string | null
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

  created_at: string
  updated_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  profile?: Pick<Profile, 'id' | 'username' | 'house_rank' | 'avatar_url'>
}

export const HOUSE_RANKS = [
  'Standing Room', 'Balcony', 'Mezzanine', 'Orchestra', 'Front Row', 'Green Room', 'Company',
] as const

// --- Works & People ---

export type CreditType = 'performer' | 'director' | 'designer' | 'writer' | 'crew'
export type CreditSource = 'internal' | 'public_listing' | 'user_submitted'

export interface Artist {
  id: string
  name: string
  slug: string
  headshot_url: string | null
  bio: string | null
  affiliation: string | null
  hometown: string | null
  external_urls: Record<string, string>
  created_at: string
}

export interface Credit {
  id: string
  artist_id: string
  event_id: string
  role: string | null
  credit_type: CreditType
  billing_order: number | null
  source: CreditSource
  created_at: string
  artist?: Artist
  event?: Event & { venue?: Venue }
}

export interface PlayInterest {
  id: string
  user_id: string
  play_id: string
  city: string
  created_at: string
}

export interface PlayWaiting {
  play_id: string
  city: string
  waiting: number
}

export interface PlayWaitingTrend {
  play_id: string
  city: string
  month: string
  added: number
}

// --- Social ---

export type PlanMemberStatus = 'invited' | 'in' | 'paid' | 'out'
export type CallStatus = 'open' | 'declined' | 'accepted' | 'expired'

export interface Call {
  id: string
  user_id: string
  event_id: string
  week_of: string
  reason: string
  status: CallStatus
  created_at: string
  event?: Event & { venue?: Venue }
}

export interface StandingCall {
  id: string
  venue_id: string
  kind: 'usher' | 'pwyc' | 'student_rush' | 'free'
  recurrence: string | null
  slots: number | null
  signup_url: string | null
  active: boolean
  venue?: Venue
}

export interface LearnCard {
  id: string
  slug: string
  title: string
  dek: string
  body_md: string
  seconds: number
  tags: string[]
}

export interface Plan {
  id: string
  event_id: string
  creator_id: string
  performance_at: string
  seats_total: number
  note: string | null
  created_at: string
  event?: Event & { venue?: Venue }
  members?: PlanMember[]
  items?: PlanItem[]
}

export interface PlanMember {
  plan_id: string
  user_id: string
  status: PlanMemberStatus
  seat_note: string | null
  profile?: Pick<Profile, 'id' | 'username' | 'avatar_url'>
}

export interface PlanItem {
  id: string
  plan_id: string
  at_label: string
  body: string
  detail: string | null
  sort_order: number
}

export interface Thread {
  id: string
  event_id: string
  created_at: string
}

export interface ThreadPost {
  id: string
  thread_id: string
  user_id: string
  body: string
  contains_spoilers: boolean
  created_at: string
  profile?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'house_rank'>
}

export type NotificationKind =
  | 'play_announced' | 'artist_cast' | 'open_seat' | 'plan_reminder'
  | 'call_ready' | 'on_sale' | 'rank_up' | 'friend_activity'

export interface Notification {
  id: string
  user_id: string
  kind: NotificationKind
  subject_type: string
  subject_id: string
  body: string
  read_at: string | null
  created_at: string
}
