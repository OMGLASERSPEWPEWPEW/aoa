import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getSetting, putSetting } from '../lib/settingsStorage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const SETTINGS_KEY = 'theme'
const LS_KEY = 'aoa-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const saved = localStorage.getItem(LS_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(getInitialMode()))

  useEffect(() => {
    getSetting(SETTINGS_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved)
        const r = resolveTheme(saved)
        setResolved(r)
        applyTheme(r)
        if (saved === 'system') {
          localStorage.removeItem(LS_KEY)
        } else {
          localStorage.setItem(LS_KEY, saved)
        }
      } else {
        const initial = getInitialMode()
        applyTheme(resolveTheme(initial))
      }
    })
  }, [])

  useEffect(() => {
    if (mode !== 'system') return

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const r = resolveTheme('system')
      setResolved(r)
      applyTheme(r)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    const r = resolveTheme(newMode)
    setResolved(r)
    applyTheme(r)
    putSetting(SETTINGS_KEY, newMode)
    if (newMode === 'system') {
      localStorage.removeItem(LS_KEY)
    } else {
      localStorage.setItem(LS_KEY, newMode)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
