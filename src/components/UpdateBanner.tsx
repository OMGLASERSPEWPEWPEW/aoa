import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const [bfcacheStale, setBfcacheStale] = useState(false)

  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setBfcacheStale(true)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  if (!needRefresh && !bfcacheStale) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 20px',
        background: 'var(--ink)',
        color: 'var(--bg)',
        borderRadius: 2,
        fontFamily: "'Courier Prime', monospace",
        fontSize: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}
    >
      <span>Updated</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '5px 12px',
          background: 'var(--accent)',
          color: 'var(--accent-on)',
          border: 'none',
          borderRadius: 2,
          fontFamily: "'Courier Prime', monospace",
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  )
}
