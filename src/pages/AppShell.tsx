import { Outlet } from 'react-router-dom'
import { Header } from '../components/Header'
import { Navigation } from '../components/Navigation'

export function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <Header />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Navigation />
    </div>
  )
}
