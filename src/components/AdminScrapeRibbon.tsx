import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useScrape } from '../contexts/ScrapeContext'
import { ScraperDashboard } from './ScraperDashboard'
import { ADMINS } from '../lib/constants'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

export function AdminScrapeRibbon() {
  const { profile } = useProfile()
  const { discovery, scraper, busy, dashboardOpen, setDashboardOpen } = useScrape()
  const location = useLocation()
  const [hidden, setHidden] = useState(true)

  const isAdmin = ADMINS.includes(profile?.username?.toLowerCase() ?? '')
  const onCoveragePage = location.pathname === '/app/admin'

  const isRunning = busy
  const isDone = (discovery.phase === 'done' || scraper.phase === 'done') && !busy
  const isError = (discovery.phase === 'error' || scraper.phase === 'error') && !busy

  useEffect(() => {
    if (isRunning) {
      setHidden(false)
      return
    }
    if (isDone || isError) {
      setHidden(false)
      const timer = setTimeout(() => setHidden(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [isRunning, isDone, isError])

  if (!isAdmin) return null
  if (hidden && !isRunning && !dashboardOpen) return null

  let message = ''
  let color = 'var(--ink-dim)'

  if (scraper.phase === 'scraping') {
    const progress = scraper.total > 0 ? `${scraper.scraped}/${scraper.total}` : `${scraper.scraped}`
    const venue = scraper.currentVenue ? ` · ${scraper.currentVenue}` : ''
    const strategy = scraper.lastStrategy ? ` → ${scraper.lastStrategy}` : ''
    message = `Scraping ${progress}${venue}${strategy}`
  } else if (discovery.phase === 'discovering') {
    message = 'Discovering theaters...'
  } else if (discovery.phase === 'enriching') {
    message = `Adding venues... ${discovery.promoted} added`
  } else if (scraper.phase === 'done') {
    message = `Done — ${scraper.events} events found across ${scraper.scraped} venues`
  } else if (discovery.phase === 'done' && discovery.promoted > 0) {
    message = `Done — ${discovery.promoted} venues added`
  } else if (scraper.phase === 'error') {
    message = `Scraper error: ${scraper.error}`
    color = '#ef4444'
  } else if (discovery.phase === 'error') {
    message = `Discovery error: ${discovery.error}`
    color = '#ef4444'
  }

  if (!message && !dashboardOpen) return null

  return (
    <>
      {dashboardOpen && (scraper.phase === 'scraping' || scraper.phase === 'done' || scraper.phase === 'error') && (
        <ScraperDashboard onMinimize={() => setDashboardOpen(false)} />
      )}
      {message && !dashboardOpen && !onCoveragePage && (
        <div
          onClick={() => setDashboardOpen(true)}
          style={{
            background: 'var(--bg-chrome)',
            borderBottom: '1px solid var(--rule)',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {isRunning && (
            <div
              style={{
                height: 2,
                background: `linear-gradient(90deg, transparent, var(--accent), transparent)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.5s ease-in-out infinite',
              }}
            />
          )}
          <div
            style={{
              ...mono,
              fontSize: 10,
              letterSpacing: '0.06em',
              padding: '6px 16px',
              color,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {message}
          </div>
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
        </div>
      )}
    </>
  )
}
