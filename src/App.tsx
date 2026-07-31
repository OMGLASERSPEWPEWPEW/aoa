import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { AppShell } from './pages/AppShell'
import { MapHome } from './pages/MapHome'
import { Discover } from './pages/Discover'
import { MyShows } from './pages/MyShows'
import { MentorChat } from './pages/MentorChat'
import { Learn } from './pages/Learn'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { Social } from './pages/Social'
import { LogShow } from './pages/LogShow'
import { WriteReview } from './pages/WriteReview'
import { ProductionDetail } from './pages/ProductionDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route index element={<Discover />} />
            <Route path="map" element={<MapHome />} />
            <Route path="watchlist" element={<MyShows />} />
            <Route path="mentor" element={<MentorChat />} />
            <Route path="learn" element={<Learn />} />
            <Route path="social" element={<Social />} />
            <Route path="log/:eventId" element={<LogShow />} />
            <Route path="log/:eventId/review" element={<WriteReview />} />
            <Route path="show/:eventId" element={<ProductionDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
