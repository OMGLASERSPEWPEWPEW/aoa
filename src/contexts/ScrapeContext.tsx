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

interface ScrapeContextType {
  discovery: DiscoveryProgress
  scraper: ScraperProgress
  busy: boolean
  dashboardOpen: boolean
  setDashboardOpen: (open: boolean) => void
  runDiscovery: () => Promise<void>
  runScraper: () => Promise<void>
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
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const busy = discovery.phase === 'discovering' || discovery.phase === 'enriching' || scraper.phase === 'scraping'

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

  return (
    <ScrapeContext.Provider value={{ discovery, scraper, busy, dashboardOpen, setDashboardOpen, runDiscovery, runScraper }}>
      {children}
    </ScrapeContext.Provider>
  )
}
