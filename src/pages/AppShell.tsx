import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '../components/Header'
import { Navigation } from '../components/Navigation'
import { OfflineIndicator } from '../components/OfflineIndicator'
import { startOfflineSync } from '../lib/offlineSync'

export function AppShell() {
  useEffect(() => startOfflineSync(), [])

  return (
    <div className="flex flex-col h-dvh" style={{ backgroundColor: 'var(--bg)' }}>
      <OfflineIndicator />
      <Header />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Navigation />
    </div>
  )
}
