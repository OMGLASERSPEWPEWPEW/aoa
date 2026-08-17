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

export interface RecentSchoolEntry {
  name: string
  status: string
  eventsFound: number
  eventsCreated: number
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 45_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init)
  } catch {
    await new Promise((r) => setTimeout(r, 3000))
    return await fetchWithTimeout(url, init)
  }
}

export function ScrapeProvider({ children }: { children: ReactNode }) {
  const [discovery, setDiscovery] = useState<DiscoveryProgress>({ phase: 'idle', found: 0, enriched: 0, promoted: 0, total: 0 })
  const [scraper, setScraper] = useState<ScraperProgress>({ phase: 'idle', scraped: 0, events: 0, total: 0, recentVenues: [] })
  const [classDiscovery, setClassDiscovery] = useState<ClassDiscoveryProgress>({ phase: 'idle', schoolsScraped: 0, totalSchools: 0, currentSchool: null, eventsFound: 0, eventsCreated: 0, eventsUpdated: 0, errors: 0, newSchoolsQueued: 0, recentSchools: [] })
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [classDashboardOpen, setClassDashboardOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const busy = discovery.phase === 'discovering' || discovery.phase === 'enriching' || scraper.phase === 'scraping' || classDiscovery.phase === 'scraping'

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollJob = useCallback((jobId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
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
        stopPolling()
        queryClient.invalidateQueries()
      }
    }, 5000)
  }, [stopPolling])

  // On mount, check for any running job
  useEffect(() => {
    async function checkRunningJob() {
      const { data: runningJob } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (runningJob) {
        setScraper({
          phase: 'scraping',
          scraped: runningJob.venues_processed ?? 0,
          events: runningJob.events_found ?? 0,
          total: runningJob.total_venues ?? 0,
          currentVenue: runningJob.current_venue ?? undefined,
          lastStrategy: runningJob.last_strategy ?? undefined,
          recentVenues: (runningJob.recent_venues as RecentVenueEntry[]) ?? [],
          startedAt: runningJob.started_at ?? undefined,
        })
        pollJob(runningJob.id)
      }
    }
    checkRunningJob()
    return stopPolling
  }, [pollJob, stopPolling])

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
        pollJob(data.job_id)
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

      pollJob(jobId)
    } catch (err) {
      setScraper((prev) => ({ ...prev, phase: 'error', error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }, [pollJob])

  const runClassDiscovery = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const baseUrl = import.meta.env.VITE_SUPABASE_URL

      setClassDiscovery({ phase: 'scraping', schoolsScraped: 0, totalSchools: 0, currentSchool: null, eventsFound: 0, eventsCreated: 0, eventsUpdated: 0, errors: 0, newSchoolsQueued: 0, recentSchools: [] })
      setClassDashboardOpen(true)

      const res = await fetch(`${baseUrl}/functions/v1/class-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) {
        setClassDiscovery(prev => ({ ...prev, phase: 'error', error: 'No response stream' }))
        return
      }

      let buffer = ''
      let schoolsScraped = 0
      let eventsFound = 0
      let eventsCreated = 0
      let eventsUpdated = 0
      let errors = 0
      let newSchoolsQueued = 0
      const recentSchools: RecentSchoolEntry[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'school_scrape') {
              schoolsScraped++
              const d = msg.data
              eventsFound += d.events_found ?? 0
              eventsCreated += d.events_created ?? 0
              eventsUpdated += d.events_updated ?? 0
              if (d.status !== 'success') errors++
              recentSchools.unshift({ name: d.venue_name, status: d.status, eventsFound: d.events_found, eventsCreated: d.events_created })
              if (recentSchools.length > 20) recentSchools.pop()
              setClassDiscovery(prev => ({
                ...prev,
                schoolsScraped,
                currentSchool: d.venue_name,
                eventsFound,
                eventsCreated,
                eventsUpdated,
                errors,
                recentSchools: [...recentSchools],
              }))
            } else if (msg.type === 'search_result') {
              if (msg.data?.queued) {
                newSchoolsQueued++
                setClassDiscovery(prev => ({ ...prev, newSchoolsQueued }))
              }
            } else if (msg.type === 'summary') {
              const s = msg.data
              setClassDiscovery(prev => ({
                ...prev,
                phase: 'done',
                schoolsScraped: s.schools_scraped ?? schoolsScraped,
                totalSchools: s.schools_scraped ?? schoolsScraped,
                eventsFound: s.total_events_found ?? eventsFound,
                eventsCreated: s.total_created ?? eventsCreated,
                eventsUpdated: s.total_updated ?? eventsUpdated,
                errors: s.scrape_errors ?? errors,
                newSchoolsQueued: s.search_results_queued ?? newSchoolsQueued,
                currentSchool: null,
              }))
              queryClient.invalidateQueries()
            }
          } catch { /* parse error — skip line */ }
        }
      }

      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer)
          if (msg.type === 'summary') {
            setClassDiscovery(prev => ({ ...prev, phase: 'done', currentSchool: null }))
            queryClient.invalidateQueries()
          }
        } catch { /* ignore */ }
      }

      setClassDiscovery(prev => prev.phase === 'scraping' ? { ...prev, phase: 'done', currentSchool: null } : prev)
    } catch (err) {
      setClassDiscovery(prev => ({ ...prev, phase: 'error', error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }, [])

  return (
    <ScrapeContext.Provider value={{ discovery, scraper, classDiscovery, busy, dashboardOpen, setDashboardOpen, classDashboardOpen, setClassDashboardOpen, runDiscovery, runScraper, runClassDiscovery }}>
      {children}
    </ScrapeContext.Provider>
  )
}
