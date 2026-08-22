/**
 * Typed query key factory for TanStack Query.
 * Every entity and RPC gets a namespace with composable key builders.
 */
export const queryKeys = {
  plays: {
    all: ['plays'] as const,
    detail: (id: string) => ['plays', id] as const,
    spectrum: (playId: string) => ['plays', playId, 'spectrum'] as const,
    interest: (playId: string) => ['plays', playId, 'interest'] as const,
  },
  events: {
    all: ['events'] as const,
    detail: (id: string) => ['events', id] as const,
    byPlay: (playId: string) => ['events', 'play', playId] as const,
    tonight: ['events', 'tonight'] as const,
    emotionCounts: (eventId: string) => ['events', eventId, 'emotionCounts'] as const,
    spectrum: (eventId: string) => ['events', eventId, 'spectrum'] as const,
  },
  venues: {
    all: ['venues'] as const,
    withCoords: ['venues', 'with-coords'] as const,
    audit: ['venues', 'audit'] as const,
    coverage: ['venues', 'coverage'] as const,
    detail: (id: string) => ['venues', id] as const,
  },
  schools: {
    all: ['schools'] as const,
    audit: ['schools', 'audit'] as const,
    coverage: ['schools', 'coverage'] as const,
    detail: (id: string) => ['schools', id] as const,
  },
  blocked: {
    all: ['blocked'] as const,
    count: ['blocked', 'count'] as const,
  },
  overrides: {
    forEntity: (type: string, id: string) => ['overrides', type, id] as const,
  },
  suggestions: {
    forEntity: (type: string, id: string) => ['suggestions', type, id] as const,
    openCount: ['suggestions', 'open-count'] as const,
  },
  watchlist: {
    all: (userId: string) => ['watchlist', userId] as const,
    forMap: (userId: string) => ['watchlist', userId, 'map'] as const,
  },
  reviews: {
    byEvent: (eventId: string) => ['reviews', eventId] as const,
  },
  friendships: {
    all: (userId: string) => ['friendships', userId] as const,
    activity: (userId: string) => ['friendships', userId, 'activity'] as const,
  },
  profile: {
    detail: (userId: string) => ['profile', userId] as const,
    progress: (userId: string) => ['profile', userId, 'progress'] as const,
    emotionAggregates: (userId: string, mode: string) => ['profile', userId, 'emotions', mode] as const,
    playInterestCount: (userId: string) => ['profile', userId, 'playInterestCount'] as const,
  },
  discoveryQueue: {
    all: ['discovery-queue'] as const,
  },
  cost: {
    dashboard: (days: number) => ['cost', 'dashboard', days] as const,
  },
  scrape: {
    last: ['last-scrape'] as const,
  },
  mapData: (userId: string | null, lastScrapeTs: string | null) =>
    ['map-data', userId, lastScrapeTs] as const,
  classSessions: {
    forSchool: (schoolId: string) => ['class-sessions', schoolId] as const,
  },
  classMap: {
    all: (userId: string | null, lastScrapeTs: string | null) => ['class-map', userId, lastScrapeTs] as const,
  },
} as const
