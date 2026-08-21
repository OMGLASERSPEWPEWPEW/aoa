import { useEffect } from 'react'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

const STORAGE_KEY = 'admin-domain-tab'

interface CoverageDomainTabsProps {
  domain: 'theaters' | 'schools'
  counts: { theaters: number; schools: number }
  onChange: (domain: 'theaters' | 'schools') => void
}

export function CoverageDomainTabs({ domain, counts, onChange }: CoverageDomainTabsProps) {
  // Restore persisted tab on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === 'theaters' || stored === 'schools') {
      if (stored !== domain) onChange(stored)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(next: 'theaters' | 'schools') {
    sessionStorage.setItem(STORAGE_KEY, next)
    onChange(next)
  }

  const tabs: Array<{ key: 'theaters' | 'schools'; label: string; count: number }> = [
    { key: 'theaters', label: 'THEATERS', count: counts.theaters },
    { key: 'schools', label: 'SCHOOLS', count: counts.schools },
  ]

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 20,
        borderBottom: '1px solid var(--rule)',
        marginBottom: 16,
      }}
    >
      {tabs.map((tab) => {
        const active = domain === tab.key
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => handleChange(tab.key)}
            style={{
              ...mono,
              fontSize: 10.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: active ? 'var(--accent)' : 'var(--ink-faint)',
              background: 'none',
              border: 'none',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '8px 0',
              cursor: 'pointer',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        )
      })}
    </div>
  )
}
