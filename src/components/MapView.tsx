import { useRef } from 'react'
import { useMap } from '../hooks/useMap'
import 'mapbox-gl/dist/mapbox-gl.css'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  useMap(containerRef)

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN

  if (!hasToken) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-slate-400">
        <div className="text-center p-6">
          <p className="text-lg font-semibold text-white mb-2">Map Coming Soon</p>
          <p className="text-sm max-w-xs">
            Add VITE_MAPBOX_TOKEN to .env.local to enable the interactive map.
          </p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full" />
}
