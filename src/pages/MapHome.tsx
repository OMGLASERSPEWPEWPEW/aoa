import { MapView } from '../components/MapView'

export function MapHome() {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <MapView />
    </div>
  )
}
