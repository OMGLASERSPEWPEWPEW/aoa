import { MapPin } from 'lucide-react'

export function MapHome() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
      <MapPin size={48} className="text-amber-400 mb-4" />
      <h2 className="text-xl font-semibold text-white mb-2">Map Coming Soon</h2>
      <p className="text-center text-sm max-w-xs">
        The interactive map with theaters, events, and classes will appear here once Mapbox is configured.
      </p>
      <p className="text-xs text-slate-600 mt-4">Graph node: mapbox-setup</p>
    </div>
  )
}
