import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface DiscoveryProgress {
  phase: 'idle' | 'discovering' | 'enriching' | 'done' | 'error'
  found: number
  enriched: number
  promoted: number
  total: number
  error?: string
}

export interface ScraperProgress {
  phase: 'idle' | 'scraping' | 'done' | 'error'
  scraped: number
  events: number
  error?: string
}

interface ScrapeContextType {
  discovery: DiscoveryProgress
  scraper: ScraperProgress
  busy: boolean
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
  const [scraper, setScraper] = useState<ScraperProgress>({ phase: 'idle', scraped: 0, events: 0 })

  const busy = discovery.phase === 'discovering' || discovery.phase === 'enriching' || scraper.phase === 'scraping'

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

      let scraped = 0
      let events = 0
      let remaining = 1
      let consecutiveFails = 0

      setScraper({ phase: 'scraping', scraped: 0, events: 0 })

      while (remaining > 0) {
        try {
          const res = await fetchWithRetry(`${baseUrl}/functions/v1/event-scrape-batch`, { method: 'POST', headers })
          const data = await res.json()

          if (data.error) {
            setScraper({ phase: 'error', scraped, events, error: data.error })
            return
          }

          consecutiveFails = 0
          scraped += data.scraped ?? 0
          events += data.events_found ?? 0
          remaining = data.remaining ?? 0
          setScraper({ phase: 'scraping', scraped, events })
        } catch {
          consecutiveFails++
          if (consecutiveFails >= 3) {
            setScraper({ phase: 'error', scraped, events, error: 'Network error — retries exhausted' })
            return
          }
        }
      }

      setScraper({ phase: 'done', scraped, events })
    } catch (err) {
      setScraper((prev) => ({ ...prev, phase: 'error', error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }, [])

  return (
    <ScrapeContext.Provider value={{ discovery, scraper, busy, runDiscovery, runScraper }}>
      {children}
    </ScrapeContext.Provider>
  )
}
