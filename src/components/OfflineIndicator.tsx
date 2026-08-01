import { useState, useEffect } from 'react'

export function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#141109',
        borderBottom: '1px solid #2b2720',
        padding: '8px 20px',
        textAlign: 'center',
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9,
        letterSpacing: '0.1em',
        color: 'oklch(0.80 0.14 55)',
      }}
    >
      OFFLINE — YOUR WORK IS SAVED
    </div>
  )
}
