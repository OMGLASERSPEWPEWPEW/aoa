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
      const discoverRes = await fetch(`${baseUrl}/functions/v1/venue-discovery`, { method: 'POST', headers })
      const discoverData = await discoverRes.json()

      if (discoverData.error) {
        setDiscovery({ phase: 'error', found: 0, enriched: 0, promoted: 0, total: 0, error: discoverData.error })
        return
      }

      const venuesNew = discoverData.venues_new ?? 0
      let enriched = 0
      let promoted = 0
      let remaining = 1

      while (remaining > 0) {
        const enrichRes = await fetch(`${baseUrl}/functions/v1/venue-enrich`, { method: 'POST', headers })
        const enrichData = await enrichRes.json()

        if (enrichData.error) {
          setDiscovery({ phase: 'error', found: venuesNew, enriched, promoted, total: enriched + remaining, error: enrichData.error })
          return
        }

        enriched += enrichData.enriched ?? 0
        promoted += enrichData.promoted ?? 0
        remaining = enrichData.remaining ?? 0
        setDiscovery({ phase: 'enriching', found: venuesNew, enriched, promoted, total: enriched + remaining })
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

      setScraper({ phase: 'scraping', scraped: 0, events: 0 })

      while (remaining > 0) {
        const res = await fetch(`${baseUrl}/functions/v1/event-scrape-batch`, { method: 'POST', headers })
        const data = await res.json()

        if (data.error) {
          setScraper({ phase: 'error', scraped, events, error: data.error })
          return
        }

        scraped += data.scraped ?? 0
        events += data.events_found ?? 0
        remaining = data.remaining ?? 0
        setScraper({ phase: 'scraping', scraped, events })
      }

      setScraper({ phase: 'done', scraped, events })
    } catch (err) {
      setScraper({ phase: 'error', scraped: 0, events: 0, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [])

  return (
    <ScrapeContext.Provider value={{ discovery, scraper, busy, runDiscovery, runScraper }}>
      {children}
    </ScrapeContext.Provider>
  )
}
