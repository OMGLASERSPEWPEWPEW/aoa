import { Link } from 'react-router-dom'
import { MapPin, Sparkles } from 'lucide-react'

export function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white px-6">
      <div className="flex items-center gap-3 mb-4">
        <MapPin size={32} className="text-amber-400" />
        <Sparkles size={24} className="text-amber-400" />
      </div>
      <h1 className="text-4xl font-bold mb-2">The Art of Art</h1>
      <p className="text-slate-400 text-lg mb-8 text-center max-w-md">
        Your guide to the scene. Discover theater, track what you've seen, and level up your art game.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          to="/signup"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
        >
          Get Started
        </Link>
        <Link
          to="/login"
          className="border border-slate-700 hover:border-slate-500 text-slate-300 py-3 px-6 rounded-lg text-center transition-colors"
        >
          Sign In
        </Link>
      </div>
      <p className="text-slate-600 text-xs mt-12">
        v{__APP_VERSION__}
      </p>
    </div>
  )
}
