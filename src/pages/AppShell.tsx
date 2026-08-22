import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '../components/Header'
import { AdminScrapeRibbon } from '../components/AdminScrapeRibbon'
import { Navigation } from '../components/Navigation'
import { OfflineIndicator } from '../components/OfflineIndicator'
import { startOfflineSync } from '../lib/offlineSync'
import { useAuth } from '../contexts/AuthContext'
import { useLastScrape } from '../hooks/useLastScrape'
import { fetchMapData, mapDataQueryKey } from '../lib/mapData'
import { fetchClassMapData } from '../lib/classData'
import { queryKeys } from '../lib/queryKeys'
import { queryClient } from '../App'

export function AppShell() {
  const { user } = useAuth()
  const lastScrapeTs = useLastScrape()

  useEffect(() => startOfflineSync(), [])

  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2500))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const id = ric(() => { import('mapbox-gl') })
    return () => cancel(id)
  }, [])

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: mapDataQueryKey(user?.id ?? null, lastScrapeTs),
      queryFn: () => fetchMapData(user?.id ?? null),
    })
    queryClient.prefetchQuery({
      queryKey: queryKeys.classMap.all(user?.id ?? null, lastScrapeTs),
      queryFn: () => fetchClassMapData(user?.id ?? null),
    })
  }, [user?.id, lastScrapeTs])

  return (
    <div className="flex flex-col h-dvh" style={{ backgroundColor: 'var(--bg)' }}>
      <OfflineIndicator />
      <Header />
      <AdminScrapeRibbon />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Navigation />
    </div>
  )
}
