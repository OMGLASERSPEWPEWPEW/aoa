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
  premise: string | null
  read_prompt: string | null
  library_url: string | null
  adjacent_event_id: string | null
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
  instructor_name: string | null
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'all-levels' | 'drop-in' | null
  session_count: number | null
  class_format: 'ongoing' | 'workshop' | 'intensive' | 'drop-in' | 'series' | null
  source_url: string | null
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
  count: number
}

export interface TrendBucket {
  month: string
  count: number
}

export interface ProductionRow {
  event: Event
  userSeen: boolean
  userSeenDate: string | null
}

export interface FriendActivity {
  friendName: string
  avatarUrl: string | null
  showTitle: string
  emotions: Emotion[]
  quote: string | null
  seenDate: string
}

export interface QueueItem {
  id: string
  raw_name: string
  raw_address: string | null
  raw_website_url: string | null
  raw_description: string | null
  enriched_venue_type: string | null
  enriched_calendar_url: string | null
  enriched_photo_url: string | null
  enriched_latitude: number | null
  enriched_longitude: number | null
  enriched_venue_type_confidence: number | null
  enrichment_status: string
  created_at: string
}

export interface AuditVenue {
  id: string
  name: string
  neighborhood: string | null
  venue_type: string
  has_calendar_url: boolean
  has_photo: boolean
  event_count: number
  source: string
  website_url: string | null
}

export interface CostByModel {
  model: string
  call_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
}

export interface CostByFeature {
  feature: string
  call_count: number
  total_cost: number
}

export interface DailyCost {
  day: string
  call_count: number
  total_cost: number
}

export interface CostDashboard {
  total: number
  byModel: CostByModel[]
  byFeature: CostByFeature[]
  dailySeries: DailyCost[]
  loading: boolean
}

export interface PromoteData {
  name: string
  slug: string
  description: string
  venue_type: string
  address: string
  neighborhood: string
  latitude: number | null
  longitude: number | null
  price_range: string
  website_url: string
  calendar_url: string
  genre_tags: string[]
  accessibility_info: string
  photo_url: string
}

export interface MapData {
  venues: Venue[]
  events: Event[]
  visitCounts: Record<string, number>
  lastVisitDates: Record<string, string>
  venueEmotionColors: Record<string, string>
}

export type TimeFilter = 'today' | 'week' | 'month'

export interface PatchNote {
  version: string
  date: string
  title: string
  summary: string
  details?: string[]
}

export interface WatchlistWithEvent extends WatchlistItem {
  event: Event & { venue: Venue }
}

export interface WatchlistMapJoin {
  event_id: string
  seen_date: string | null
  emotions: Emotion[] | null
  events: { venue_id: string }[] | null
}

export interface ReviewWithProfile extends Review {
  profile: Pick<Profile, 'id' | 'username' | 'house_rank'>
}

export interface EventEmotionCount {
  event_id: string
  emotion_slug: string
  pick_count: number
}

export interface EventSpectrumRow {
  event_id: string
  emotion: string
  pct: number
}

// F70-F74: Classes and Schools

export type Discipline = 'improv' | 'acting'

export type MapMode = 'shows' | 'classes'

export interface School {
  id: string
  name: string
  short_name: string
  slug: string
  latitude: number
  longitude: number
  neighborhood: string
  discipline: Discipline
  price_band: '$' | '$$' | '$$$' | null
  venue_id: string | null
  financial_aid: boolean
  payment_plan: boolean
  sliding_scale: boolean
  url: string | null
  photo_url: string | null
  address: string | null
  status: string
  created_at: string
}

export interface ClassSession {
  id: string
  school_id: string
  title: string
  level: 1 | 2 | 3 | 4 | 5
  starts_on: string | null
  schedule: string | null
  weeks: number | null
  price: number | null
  seats_total: number | null
  seats_taken: number | null
  drop_in: boolean
  no_experience: boolean
  audition_required: boolean
  prerequisite: string | null
  signup_url: string | null
  scraped_at: string | null
  source_url: string | null
  created_at: string
}

export interface ClassTeacher {
  id: string
  session_id: string
  artist_id: string | null
  name: string
  credential: string | null
  photo_url: string | null
}

export type ClassInterestStatus = 'watching' | 'held' | 'enrolled' | 'took_it'

export interface ClassInterest {
  user_id: string
  session_id: string
  status: ClassInterestStatus
  created_at: string
}

export interface SchoolWithSession extends School {
  next_session: ClassSession | null
  sessions: ClassSession[]
  teachers: ClassTeacher[]
}

export interface ClassMapData {
  schools: SchoolWithSession[]
  userInterests: ClassInterest[]
}

// Admin: Blocklist types

export type BlockScope = 'domain' | 'entry'
export type BlockReason = 'aggregator' | 'closed' | 'duplicate' | 'not_chicago' | 'other'
export type BlockableEntity = 'venue' | 'school'

export interface BlockedSource {
  id: string
  domain: string
  scope: BlockScope
  entity_type: BlockableEntity
  entity_id: string | null
  name_snapshot: string | null
  reason: BlockReason
  note: string | null
  blocked_by: string | null
  created_at: string
}

export interface BlockRequest {
  entity_type: BlockableEntity
  entity_id: string
  name: string
  url: string
  scope: BlockScope
  reason: BlockReason
  note?: string
}

// Admin: Field provenance types (Phase 5)

export type OverridableEntity = 'venue' | 'school' | 'class_session' | 'event'

export interface FieldOverride {
  id: string
  entity_type: OverridableEntity
  entity_id: string
  field_name: string
  value: unknown
  previous_value: unknown | null
  edited_by: string
  edited_at: string
}

export type FieldState = 'curated' | 'held' | 'empty'

export type FieldEditor =
  | 'text' | 'textarea' | 'url' | 'enum' | 'boolean'
  | 'money' | 'tags' | 'image' | 'latlng'

export interface AdminFieldModel {
  name: string
  label: string
  editor: FieldEditor
  value: unknown
  state: FieldState
  override: FieldOverride | null
  consequence: string | null
  sourceLabel: string | null
  suggestion: CuratorSuggestion | null
  options?: readonly string[]
  maxLength?: number
  hint?: string
}

export type SuggestionStatus = 'open' | 'accepted' | 'dismissed' | 'muted'

export interface SuggestionEvidence {
  events_found?: number
  events_found_current?: number
  confidence?: number
  source_url?: string
}

export interface CuratorSuggestion {
  id: string
  entity_type: OverridableEntity
  entity_id: string
  field_name: string
  suggested_value: unknown
  evidence: SuggestionEvidence | null
  times_suggested: number
  status: SuggestionStatus
  first_seen_at: string
  last_seen_at: string
}

// Admin: Diagnosis types

export type DiagnosisKind =
  | 'ok' | 'dead_site' | 'mistyped' | 'aggregator' | 'no_calendar' | 'never_curated'

export interface Diagnosis {
  kind: DiagnosisKind
  label: string
  severity: 'neutral' | 'warn' | 'danger'
}

export interface AuditVenueRow extends AuditVenue {
  diagnosis: Diagnosis
  consecutive_failures: number
  has_open_suggestions: boolean
  domain: string | null
}

export interface AuditSchoolRow {
  id: string
  name: string
  short_name: string
  neighborhood: string
  discipline: Discipline
  price_band: '$' | '$$' | '$$$' | null
  session_count: number
  last_curated_at: string | null
  diagnosis: Diagnosis
  has_open_suggestions: boolean
  domain: string | null
}

export type AdminDomain = 'theaters' | 'schools'

export interface ClassCoverageMetrics {
  school_count: number
  schools_never_curated: number
  session_count: number
  sessions_enrolling: number
  with_start_date: number
  with_price: number
  with_level: number
  with_teacher: number
  by_discipline: Record<string, number>
  last_curated_at: string | null
}
