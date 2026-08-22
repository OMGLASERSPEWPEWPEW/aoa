import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { dexiePersister } from './lib/queryPersist'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { UpdateBanner } from './components/UpdateBanner'
import { ScrapeProvider } from './contexts/ScrapeContext'
import { RouteFallback } from './components/RouteFallback'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

const AppShell = lazy(() => import('./pages/AppShell').then(m => ({ default: m.AppShell })))
const Tonight = lazy(() => import('./pages/Tonight').then(m => ({ default: m.Tonight })))
const MapHome = lazy(() => import('./pages/MapHome').then(m => ({ default: m.MapHome })))
const Discover = lazy(() => import('./pages/Discover').then(m => ({ default: m.Discover })))
const MyShows = lazy(() => import('./pages/MyShows').then(m => ({ default: m.MyShows })))
const MentorChat = lazy(() => import('./pages/MentorChat').then(m => ({ default: m.MentorChat })))
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const Social = lazy(() => import('./pages/Social').then(m => ({ default: m.Social })))
const LogShow = lazy(() => import('./pages/LogShow').then(m => ({ default: m.LogShow })))
const WriteReview = lazy(() => import('./pages/WriteReview').then(m => ({ default: m.WriteReview })))
const ProductionDetail = lazy(() => import('./pages/ProductionDetail').then(m => ({ default: m.ProductionDetail })))
const PlayDetail = lazy(() => import('./pages/PlayDetail').then(m => ({ default: m.PlayDetail })))
const Docs = lazy(() => import('./pages/Docs').then(m => ({ default: m.Docs })))
const DocsViewer = lazy(() => import('./pages/DocsViewer').then(m => ({ default: m.DocsViewer })))
const AdminVenueDetail = lazy(() => import('./pages/AdminVenueDetail').then(m => ({ default: m.AdminVenueDetail })))
const AdminSchoolDetail = lazy(() => import('./pages/AdminSchoolDetail').then(m => ({ default: m.AdminSchoolDetail })))

export default function App() {
  return (
    <ThemeProvider>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: dexiePersister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: __APP_VERSION__,
      }}
    >
    <BrowserRouter>
      <AuthProvider>
        <ScrapeProvider>
        <UpdateBanner />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Tonight />} />
            <Route path="discover" element={<Discover />} />
            <Route path="map" element={<MapHome />} />
            <Route path="watchlist" element={<MyShows />} />
            <Route path="mentor" element={<MentorChat />} />
            <Route path="social" element={<Social />} />
            <Route path="log/:eventId" element={<LogShow />} />
            <Route path="log/:eventId/review" element={<WriteReview />} />
            <Route path="show/:eventId" element={<ProductionDetail />} />
            <Route path="play/:playId" element={<PlayDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin/venue/:id" element={<AdminVenueDetail />} />
            <Route path="admin/school/:id" element={<AdminSchoolDetail />} />
            <Route path="admin" element={<Docs />} />
            <Route path="admin/:page" element={<DocsViewer />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ScrapeProvider>
      </AuthProvider>
    </BrowserRouter>
    </PersistQueryClientProvider>
    </ThemeProvider>
  )
}
