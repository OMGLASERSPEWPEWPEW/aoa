import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../App'

export interface DiscoveryProgress {
  phase: 'idle' | 'discovering' | 'enriching' | 'done' | 'error'
  found: number
  enriched: number
  promoted: number
  total: number
  error?: string
}

export interface EventDetail {
  title: string
  start_date: string | null
  end_date: string | null
  price_min: number | null
  price_max: number | null
  has_ticket: boolean
  has_times: boolean
  found_by: string[]
}

export interface RecentVenueEntry {
  name: string
  events_found: number
  strategy: string
  timestamp: string
  fields_complete?: number
  events_total?: number
  missing?: string[]
  sources?: string[]
  event_details?: EventDetail[]
}

export interface ScraperProgress {
  phase: 'idle' | 'scraping' | 'done' | 'error'
  scraped: number
  events: number
  total: number
  currentVenue?: string
  lastStrategy?: string
  recentVenues: RecentVenueEntry[]
  startedAt?: string
  error?: string
}

export interface ModelResult {
  model: string
  events_found: number
  duration_ms: number
  status: string
}

export interface RecentSchoolEntry {
  name: string
  status: string
  eventsFound: number
  eventsCreated: number
  durationMs?: number
  errorMessage?: string | null
  calendarUrl?: string
  websiteUrl?: string | null
  trace?: {
    stopReason: string | null
    aiCalls: number | null
    fetches: number | null
    durationMs: number
    modelResults: ModelResult[] | null
  } | null
}

export interface ClassDiscoveryProgress {
  phase: 'idle' | 'scraping' | 'done' | 'error'
  schoolsScraped: number
  totalSchools: number
  currentSchool: string | null
  eventsFound: number
  eventsCreated: number
  eventsUpdated: number
  errors: number
  newSchoolsQueued: number
  recentSchools: RecentSchoolEntry[]
  error?: string
}

interface ScrapeContextType {
  discovery: DiscoveryProgress
  scraper: ScraperProgress
  classDiscovery: ClassDiscoveryProgress
  busy: boolean
  dashboardOpen: boolean
  setDashboardOpen: (open: boolean) => void
  classDashboardOpen: boolean
  setClassDashboardOpen: (open: boolean) => void
  runDiscovery: () => Promise<void>
  runScraper: () => Promise<void>
  runClassDiscovery: () => Promise<void>
}

const ScrapeContext = createContext<ScrapeContextType | null>(null)

export function useScrape() {
  const ctx = useContext(ScrapeContext)
  if (!ctx) throw new Error('useScrape must be used within ScrapeProvider')
  return ctx
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 55_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWithRetry(url: string, init: RequestInit, timeoutMs = 55_000): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init, timeoutMs)
  } catch {
    await new Promise((r) => setTimeout(r, 3000))
    return await fetchWithTimeout(url, init, timeoutMs)
  }
}

export function ScrapeProvider({ children }: { children: ReactNode }) {
  const [discovery, setDiscovery] = useState<DiscoveryProgress>({ phase: 'idle', found: 0, enriched: 0, promoted: 0, total: 0 })
  const [scraper, setScraper] = useState<ScraperProgress>({ phase: 'idle', scraped: 0, events: 0, total: 0, recentVenues: [] })
  const [classDiscovery, setClassDiscovery] = useState<ClassDiscoveryProgress>({ phase: 'idle', schoolsScraped: 0, totalSchools: 0, currentSchool: null, eventsFound: 0, eventsCreated: 0, eventsUpdated: 0, errors: 0, newSchoolsQueued: 0, recentSchools: [] })
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [classDashboardOpen, setClassDashboardOpen] = useState(false)
  const eventPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const classPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const eventBusy = discovery.phase === 'discovering' || discovery.phase === 'enriching' || scraper.phase === 'scraping'
  const classBusy = classDiscovery.phase === 'scraping'
  const busy = eventBusy || classBusy

  const stopEventPolling = useCallback(() => {
    if (eventPollRef.current) {
      clearInterval(eventPollRef.current)
      eventPollRef.current = null
    }
  }, [])

  const stopClassPolling = useCallback(() => {
    if (classPollRef.current) {
      clearInterval(classPollRef.current)
      classPollRef.current = null
    }
  }, [])

  const pollEventJob = useCallback((jobId: string) => {
    stopEventPolling()
    eventPollRef.current = setInterval(async () => {
      const { data: job } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (!job) return

      const progress: ScraperProgress = {
        phase: job.status === 'completed' ? 'done' : job.status === 'failed' ? 'error' : 'scraping',
        scraped: job.venues_processed ?? 0,
        events: job.events_found ?? 0,
        total: job.total_venues ?? 0,
        currentVenue: job.current_venue ?? undefined,
        lastStrategy: job.last_strategy ?? undefined,
        recentVenues: (job.recent_venues as RecentVenueEntry[]) ?? [],
        startedAt: job.started_at ?? undefined,
        error: job.error ?? undefined,
      }

      setScraper(prev => {
        if (progress.scraped > prev.scraped || progress.phase === 'done') {
          queryClient.invalidateQueries({ queryKey: ['map-data'] })
          queryClient.invalidateQueries({ queryKey: ['tonight-events'] })
          queryClient.invalidateQueries({ queryKey: ['events'] })
          queryClient.invalidateQueries({ queryKey: ['discover'] })
        }
        return progress
      })

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        stopEventPolling()
        queryClient.invalidateQueries()
      }
    }, 5000)
  }, [stopEventPolling])

  const pollClassJob = useCallback((jobId: string) => {
    stopClassPolling()
    classPollRef.current = setInterval(async () => {
      const { data: job } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (!job) return

      const recentSchools = (job.recent_schools as RecentSchoolEntry[]) ?? []

      const progress: ClassDiscoveryProgress = {
        phase: job.status === 'completed' ? 'done' : job.status === 'failed' ? 'error' : 'scraping',
        schoolsScraped: job.schools_processed ?? 0,
        totalSchools: job.total_venues ?? 0,
        currentSchool: job.current_venue ?? null,
        eventsFound: job.events_found ?? 0,
        eventsCreated: job.events_created ?? 0,
        eventsUpdated: job.events_updated ?? 0,
        errors: job.errors_count ?? 0,
        newSchoolsQueued: job.new_schools_queued ?? 0,
        recentSchools,
        error: job.error ?? undefined,
      }

      setClassDiscovery(prev => {
        if (progress.schoolsScraped > prev.schoolsScraped || progress.phase === 'done') {
          queryClient.invalidateQueries({ queryKey: ['map-data'] })
          queryClient.invalidateQueries({ queryKey: ['discover'] })
          queryClient.invalidateQueries({ queryKey: ['class'] })
        }
        return progress
      })

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        stopClassPolling()
        queryClient.invalidateQueries()
      }
    }, 5000)
  }, [stopClassPolling])

  // On mount, check for any running jobs (event or class)
  useEffect(() => {
    async function checkRunningJobs() {
      const { data: runningEventJob } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('job_type', 'event')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (runningEventJob) {
        setScraper({
          phase: 'scraping',
          scraped: runningEventJob.venues_processed ?? 0,
          events: runningEventJob.events_found ?? 0,
          total: runningEventJob.total_venues ?? 0,
          currentVenue: runningEventJob.current_venue ?? undefined,
          lastStrategy: runningEventJob.last_strategy ?? undefined,
          recentVenues: (runningEventJob.recent_venues as RecentVenueEntry[]) ?? [],
          startedAt: runningEventJob.started_at ?? undefined,
        })
        pollEventJob(runningEventJob.id)
      }

      const { data: runningClassJob } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('job_type', 'class')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (runningClassJob) {
        setClassDiscovery({
          phase: 'scraping',
          schoolsScraped: runningClassJob.schools_processed ?? 0,
          totalSchools: runningClassJob.total_venues ?? 0,
          currentSchool: runningClassJob.current_venue ?? null,
          eventsFound: runningClassJob.events_found ?? 0,
          eventsCreated: runningClassJob.events_created ?? 0,
          eventsUpdated: runningClassJob.events_updated ?? 0,
          errors: runningClassJob.errors_count ?? 0,
          newSchoolsQueued: runningClassJob.new_schools_queued ?? 0,
          recentSchools: (runningClassJob.recent_schools as RecentSchoolEntry[]) ?? [],
        })
        pollClassJob(runningClassJob.id)
      }
    }
    checkRunningJobs()
    return () => {
      stopEventPolling()
      stopClassPolling()
    }
  }, [pollEventJob, pollClassJob, stopEventPolling, stopClassPolling])

  const runDiscovery = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const baseUrl = import.meta.env.VITE_SUPABASE_URL
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }

      setDiscovery({ phase: 'discovering', found: 0, enriched: 0, promoted: 0, total: 0 })
      const discoverRes = await fetchWithRetry(`${baseUrl}/functions/v1/venue-discovery`, { method: 'POST', headers })
      const discoverData = await discoverRes.json()

      if (discoverData.error) {
        setDiscovery({ phase: 'error', found: 0, enriched: 0, promoted: 0, total: 0, error: discoverData.error })
        return
      }

      const venuesNew = discoverData.venues_new ?? 0
      let enriched = 0
      let promoted = 0
      let remaining = 1
      let consecutiveFails = 0

      while (remaining > 0) {
        try {
          const enrichRes = await fetchWithRetry(`${baseUrl}/functions/v1/venue-enrich`, { method: 'POST', headers })
          const enrichData = await enrichRes.json()

          if (enrichData.error) {
            setDiscovery({ phase: 'error', found: venuesNew, enriched, promoted, total: enriched + remaining, error: enrichData.error })
            return
          }

          consecutiveFails = 0
          enriched += enrichData.enriched ?? 0
          promoted += enrichData.promoted ?? 0
          remaining = enrichData.remaining ?? 0
          setDiscovery({ phase: 'enriching', found: venuesNew, enriched, promoted, total: enriched + remaining })
        } catch {
          consecutiveFails++
          if (consecutiveFails >= 3) {
            setDiscovery({ phase: 'error', found: venuesNew, enriched, promoted, total: enriched + remaining, error: 'Network error — retries exhausted' })
            return
          }
        }
      }

      setDiscovery({ phase: 'done', found: venuesNew, enriched, promoted, total: enriched })
    } catch (err) {
      setDiscovery((prev) => ({ ...prev, phase: 'error', error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }, [])

  const runScraper = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const baseUrl = import.meta.env.VITE_SUPABASE_URL
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }

      setScraper({ phase: 'scraping', scraped: 0, events: 0, total: 0, recentVenues: [] })
      setDashboardOpen(true)

      const res = await fetchWithRetry(`${baseUrl}/functions/v1/event-scrape-batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()

      if (data.error && !data.job_id) {
        setScraper({ phase: 'error', scraped: 0, events: 0, total: 0, recentVenues: [], error: data.error })
        return
      }

      if (data.error && data.job_id) {
        pollEventJob(data.job_id)
        return
      }

      const jobId = data.job_id
      if (!jobId) {
        setScraper({ phase: 'done', scraped: 0, events: 0, total: 0, recentVenues: [] })
        return
      }

      setScraper({
        phase: 'scraping',
        scraped: data.scraped ?? 0,
        events: data.events_found ?? 0,
        total: (data.scraped ?? 0) + (data.remaining ?? 0),
        currentVenue: data.venue_name,
        lastStrategy: data.strategy?.stop_reason,
        recentVenues: [],
      })

      pollEventJob(jobId)
    } catch (err) {
      setScraper((prev) => ({ ...prev, phase: 'error', error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }, [pollEventJob])

  const runClassDiscovery = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const baseUrl = import.meta.env.VITE_SUPABASE_URL
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }

      setClassDiscovery({ phase: 'scraping', schoolsScraped: 0, totalSchools: 0, currentSchool: null, eventsFound: 0, eventsCreated: 0, eventsUpdated: 0, errors: 0, newSchoolsQueued: 0, recentSchools: [] })
      setClassDashboardOpen(true)

      // Fire the start request (don't await — it processes the first school and takes 60-90s)
      const startPromise = fetchWithRetry(`${baseUrl}/functions/v1/class-discovery`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'start' }),
      }, 120_000)

      // Fast-poll for the job row — it's created before the first school is processed
      let earlyJob: { id: string; total_venues: number | null } | null = null
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500))
        const { data } = await supabase
          .from('scrape_jobs')
          .select('id, total_venues')
          .eq('job_type', 'class')
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data) { earlyJob = data; break }
      }

      if (earlyJob) {
        setClassDiscovery(prev => ({ ...prev, totalSchools: earlyJob!.total_venues ?? 0 }))
        pollClassJob(earlyJob.id)
      }

      // Still await the start response to handle errors / edge cases
      try {
        const res = await startPromise
        const data = await res.json()

        if (data.error && !data.job_id) {
          if (!earlyJob) {
            setClassDiscovery(prev => ({ ...prev, phase: 'error', error: data.error }))
          }
          return
        }

        if (data.error && data.job_id) {
          if (!earlyJob) pollClassJob(data.job_id)
          return
        }

        const jobId = data.job_id
        if (!jobId && !earlyJob) {
          setClassDiscovery(prev => ({ ...prev, phase: 'done' }))
          return
        }

        if (jobId && !earlyJob) {
          const totalFromResponse = (data.remaining ?? 0) + 1
          setClassDiscovery(prev => ({
            ...prev,
            phase: 'scraping',
            currentSchool: data.school ?? null,
            totalSchools: totalFromResponse,
            schoolsScraped: 1,
            eventsFound: data.events_found ?? 0,
            eventsCreated: data.events_created ?? 0,
          }))
          pollClassJob(jobId)
        }
      } catch (fetchErr) {
        // Start request timed out, but polling is already running if earlyJob was found
        if (!earlyJob) {
          const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error'
          const userMsg = msg === 'Failed to fetch' || msg.includes('load failed') || msg.includes('aborted')
            ? 'Network error — the server took too long. The scrape may still be running; try refreshing.'
            : msg
          setClassDiscovery(prev => ({ ...prev, phase: 'error', error: userMsg }))
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setClassDiscovery(prev => ({ ...prev, phase: 'error', error: msg }))
    }
  }, [pollClassJob])

  return (
    <ScrapeContext.Provider value={{ discovery, scraper, classDiscovery, busy, dashboardOpen, setDashboardOpen, classDashboardOpen, setClassDashboardOpen, runDiscovery, runScraper, runClassDiscovery }}>
      {children}
    </ScrapeContext.Provider>
  )
}
