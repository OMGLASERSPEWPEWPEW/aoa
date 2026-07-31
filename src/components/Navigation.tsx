import { NavLink } from 'react-router-dom'
import { Compass, MapPin, Bookmark, MessageCircle, GraduationCap, Users, User } from 'lucide-react'

const tabs = [
  { to: '/app', icon: Compass, label: 'Discover', end: true },
  { to: '/app/map', icon: MapPin, label: 'Map' },
  { to: '/app/watchlist', icon: Bookmark, label: 'My Shows' },
  { to: '/app/mentor', icon: MessageCircle, label: 'TME' },
  { to: '/app/learn', icon: GraduationCap, label: 'Learn' },
  { to: '/app/social', icon: Users, label: 'Social' },
  { to: '/app/profile', icon: User, label: 'Profile' },
]

export function Navigation() {
  return (
    <nav className="flex items-center justify-around bg-slate-900 border-t border-slate-800 py-2 px-0.5">
      {tabs.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] transition-colors ${
              isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
