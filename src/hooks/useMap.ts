import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'

const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781]
const DEFAULT_ZOOM = 12

const VENUE_TYPE_COLORS: Record<string, string> = {
  storefront: '#FBBF24',
  institutional: '#F97316',
  experimental: '#A855F7',
  school: '#3B82F6',
}

export function useMap(container: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const { resolved: theme } = useTheme()

  useEffect(() => {
    if (!container.current) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN not set — map will not render')
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: container.current,
      style: `mapbox://styles/mapbox/${theme}-v11`,
      center: CHICAGO_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-right',
    )

    map.on('load', async () => {
      setReady(true)

      const { data: venues } = await supabase
        .from('venues')
        .select('id, name, slug, venue_type, address, neighborhood, latitude, longitude, price_range')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (!venues) return

      for (const venue of venues) {
        const color = VENUE_TYPE_COLORS[venue.venue_type ?? ''] ?? '#FBBF24'
        const typeLabel = venue.venue_type
          ? venue.venue_type.charAt(0).toUpperCase() + venue.venue_type.slice(1)
          : 'Theater'

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
          .setHTML(`
            <div style="font-family: system-ui; max-width: 200px;">
              <strong style="font-size: 14px;">${venue.name}</strong>
              <div style="color: #94a3b8; font-size: 12px; margin-top: 2px;">
                ${venue.neighborhood ?? ''}${venue.price_range ? ` · ${venue.price_range}` : ''}
              </div>
              <div style="color: #FBBF24; font-size: 11px; margin-top: 4px;">
                ${typeLabel}
              </div>
            </div>
          `)

        const el = document.createElement('div')
        el.style.width = '14px'
        el.style.height = '14px'
        el.style.borderRadius = '50%'
        el.style.backgroundColor = color
        el.style.border = '2px solid white'
        el.style.cursor = 'pointer'
        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)'

        new mapboxgl.Marker(el)
          .setLngLat([venue.longitude, venue.latitude])
          .setPopup(popup)
          .addTo(map)
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [container])

  return { map: mapRef.current, ready }
}
