import { Calendar, GraduationCap, MapPin, Ticket } from 'lucide-react'
import type { Event } from '../lib/types'
import { WatchlistButton } from './WatchlistButton'

interface EventCardProps {
  event: Event
  watchlistStatus: 'want_to_see' | 'booked' | 'seen' | null
  onWatchlistToggle: (eventId: string) => void
  onTap?: (event: Event) => void
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBA'
  const s = new Date(start + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = s.toLocaleDateString('en-US', opts)
  if (!end || start === end) return startStr
  const e = new Date(end + 'T00:00:00')
  if (s.getMonth() === e.getMonth()) return `${startStr}-${e.getDate()}`
  return `${startStr} - ${e.toLocaleDateString('en-US', opts)}`
}

function formatPrice(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Free'
  if (min === 0 && (max === null || max === 0)) return 'Free'
  if (min === max) return `$${min}`
  if (min === 0) return `Free-$${max}`
  return `$${min}-$${max}`
}

export function EventCard({ event, watchlistStatus, onWatchlistToggle, onTap }: EventCardProps) {
  const venue = event.venue
  const isClass = event.event_type === 'class' || event.event_type === 'workshop'

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors ${isClass ? 'border-l-4 border-l-purple-500' : ''}`}
      onClick={() => onTap?.(event)}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isClass && <GraduationCap size={14} className="text-purple-400 shrink-0" />}
            <h3 className="text-white font-semibold text-sm leading-tight truncate">{event.title}</h3>
          </div>
          {venue && (
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
              <MapPin size={12} />
              <span className="truncate">{venue.name}</span>
              {venue.neighborhood && <span className="text-slate-600">· {venue.neighborhood}</span>}
            </div>
          )}
        </div>
        <WatchlistButton
          status={watchlistStatus}
          onToggle={() => onWatchlistToggle(event.id)}
        />
      </div>

      {event.description && (
        <p className="text-slate-500 text-xs mt-2 line-clamp-2">{event.description}</p>
      )}

      <div className="flex items-center gap-3 mt-3 text-xs">
        <span className="flex items-center gap-1 text-slate-400">
          <Calendar size={12} />
          {formatDateRange(event.start_date, event.end_date)}
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <Ticket size={12} />
          {formatPrice(event.price_min, event.price_max)}
        </span>
        {event.hottix_available && (
          <span className="text-green-400 font-medium">HotTix</span>
        )}
      </div>

      {event.genre_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.genre_tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
