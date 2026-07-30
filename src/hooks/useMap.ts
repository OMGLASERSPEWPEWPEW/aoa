import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'

const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781]
const DEFAULT_ZOOM = 12

export function useMap(container: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)

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
      style: 'mapbox://styles/mapbox/dark-v11',
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

    map.on('load', () => setReady(true))

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [container])

  return { map: mapRef.current, ready }
}
