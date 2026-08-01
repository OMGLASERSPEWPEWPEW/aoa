// @ts-nocheck — vendored pattern library, not app code
/**
 * Browser Diagnostics Module
 *
 * Intercepts console output, errors, fetch requests, auth state, and navigation
 * to build a complete session timeline. Buffers entries and flushes them to both
 * a local dev log file (via Vite middleware) and a remote Supabase table.
 *
 * Usage:
 *   import { initDiagnostics, log, warn, error } from './diagnostics'
 *
 *   initDiagnostics({
 *     app: 'admin',
 *     supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
 *     supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
 *   })
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface DiagnosticsConfig {
  /** Identifier for this app (e.g. 'admin', 'public', 'mobile') */
  app: string
  /** Supabase project URL */
  supabaseUrl: string
  /** Supabase anon/public key */
  supabaseAnonKey: string
  /** Optional Supabase client instance — enables auth state tracking */
  supabaseClient?: SupabaseClient
  /** localStorage key prefix (default: 'diag') */
  storagePrefix?: string
  /** Console output prefix (default: '[diag]') */
  logPrefix?: string
  /** Vite dev server endpoint (default: '/__diag/log') */
  devEndpoint?: string
  /** Vite define constant name for app version (default: '__APP_VERSION__') */
  versionDefine?: string
  /** Window key for pre-init boot errors (default: '__diagBootErrors') */
  bootErrorsKey?: string
  /** Supabase table name (default: 'diagnostics') */
  tableName?: string
  /** Flush interval in ms (default: 3000) */
  flushInterval?: number
  /** Buffer size that triggers immediate flush (default: 10) */
  flushThreshold?: number
  /** How often to check for stuck fetches in ms (default: 5000) */
  watchdogInterval?: number
  /** Duration in ms before a fetch is flagged as stuck (default: 15000) */
  watchdogThreshold?: number
  /** Skip remote flush in dev mode — local log is sufficient (default: false) */
  skipRemoteInDev?: boolean
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DiagLevel = 'info' | 'warn' | 'error' | 'device'
type DiagCategory =
  | 'lifecycle'
  | 'console'
  | 'error'
  | 'device'
  | 'sync'
  | 'fetch'
  | 'auth'
  | 'nav'
  | 'query'

interface DiagEntry {
  sync_key: string
  session_id: string
  app: string
  timestamp: number
  level: DiagLevel
  category: DiagCategory
  message: string
  data: Record<string, unknown> | null
  app_version: string
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

// Save original console methods before interception (avoids infinite loops)
const origLog = console.log
const origWarn = console.warn
const origError = console.error
const origFetch = window.fetch.bind(window)

let config: Required<
  Pick<
    DiagnosticsConfig,
    | 'app'
    | 'supabaseUrl'
    | 'supabaseAnonKey'
    | 'storagePrefix'
    | 'logPrefix'
    | 'devEndpoint'
    | 'bootErrorsKey'
    | 'tableName'
    | 'flushInterval'
    | 'flushThreshold'
    | 'watchdogInterval'
    | 'watchdogThreshold'
    | 'skipRemoteInDev'
  >
> & { supabaseClient?: SupabaseClient }

let sessionId = ''
let deviceId = ''
let buffer: DiagEntry[] = []
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _flushTimer: ReturnType<typeof setTimeout> | null = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _watchdogTimer: ReturnType<typeof setInterval> | null = null
let fetchSeq = 0
let initialized = false
let flushing = false

const pendingFetches = new Map<number, { url: string; start: number }>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDev(): boolean {
  try {
    return !!(import.meta as unknown as Record<string, Record<string, unknown>>).env?.DEV
  } catch {
    return false
  }
}

function getAppVersion(): string {
  try {
    // Check the window for a version define — the integrator sets this via Vite `define`
    const win = window as unknown as Record<string, unknown>
    if (typeof win.__APP_VERSION__ === 'string') return win.__APP_VERSION__
  } catch {
    // fall through
  }
  return '0.0.0'
}

function getDeviceId(): string {
  if (deviceId) return deviceId
  const key = `${config.storagePrefix}-device-id`
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  deviceId = id
  return id
}

function getUserId(): string | null {
  try {
    const storageKey = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    )
    if (storageKey) {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        return parsed?.user?.id ?? null
      }
    }
  } catch {
    // fall through
  }
  return null
}

function makeEntry(
  level: DiagLevel,
  category: DiagCategory,
  message: string,
  data?: Record<string, unknown>,
): DiagEntry {
  const syncKey = getUserId() ?? getDeviceId()
  return {
    sync_key: syncKey,
    session_id: sessionId,
    app: config.app,
    timestamp: Date.now(),
    level,
    category,
    message,
    data: data ?? null,
    app_version: getAppVersion(),
  }
}

function enqueue(entry: DiagEntry): void {
  buffer.push(entry)
  if (buffer.length >= config.flushThreshold) flush()
}

// ---------------------------------------------------------------------------
// Flush — send buffered entries to dev log + Supabase
// ---------------------------------------------------------------------------

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return
  flushing = true
  const batch = buffer.splice(0)
  const body = JSON.stringify(batch)

  try {
    // Local: write to dev log file via Vite dev middleware
    if (isDev()) {
      try {
        origFetch(config.devEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      } catch {
        // Best-effort
      }
    }

    // Remote: Supabase (skip in dev if configured)
    if (!(config.skipRemoteInDev && isDev())) {
      try {
        // Prefer supabase-js client if available, otherwise use raw fetch
        if (config.supabaseClient?.from) {
          const { error: err } = await config.supabaseClient.from(config.tableName).insert(batch)
          if (err) {
            origWarn(`${config.logPrefix} flush failed: ${err.message}`)
          }
        } else {
          const res = await origFetch(`${config.supabaseUrl}/rest/v1/${config.tableName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: config.supabaseAnonKey,
              Authorization: `Bearer ${config.supabaseAnonKey}`,
              Prefer: 'return=minimal',
            },
            body,
          })
          if (!res.ok) {
            origWarn(`${config.logPrefix} flush failed: ${res.status}`)
          }
        }
      } catch {
        // Best-effort
      }
    }
  } finally {
    flushing = false
  }
}

function flushSync(): void {
  if (buffer.length === 0) return
  const batch = buffer.splice(0)
  const body = JSON.stringify(batch)

  // Local: write to dev log file via Vite dev middleware
  if (isDev()) {
    try {
      origFetch(config.devEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
    } catch {
      // Best-effort
    }
  }

  // Remote: Supabase (raw fetch with keepalive — can't use supabase-js client on unload)
  if (!(config.skipRemoteInDev && isDev())) {
    try {
      origFetch(`${config.supabaseUrl}/rest/v1/${config.tableName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          Prefer: 'return=minimal',
        },
        body,
        keepalive: true,
      })
    } catch {
      // Best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Device info
// ---------------------------------------------------------------------------

function getDeviceInfo(): Record<string, unknown> {
  const info: Record<string, unknown> = {
    deviceId: getDeviceId(),
    userAgent: navigator.userAgent,
    screenWidth: screen.width,
    screenHeight: screen.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    standalone:
      ('standalone' in navigator &&
        (navigator as Record<string, unknown>).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    platform: navigator.platform,
  }

  // Parse iOS version from UA
  const iosMatch = navigator.userAgent.match(/OS (\d+[_\.]\d+[_\.]?\d*)/)
  if (iosMatch) {
    info.iosVersion = iosMatch[1].replace(/_/g, '.')
  }

  // Network Information API (Chromium)
  const nav = navigator as unknown as Record<string, unknown>
  const conn = nav.connection as Record<string, unknown> | undefined
  if (conn) {
    info.connectionType = conn.effectiveType
    info.downlink = conn.downlink
  }

  return info
}

// ---------------------------------------------------------------------------
// Interception subsystems
// ---------------------------------------------------------------------------

function interceptConsole(): void {
  console.error = (...args: unknown[]) => {
    origError.apply(console, args)
    const msg = args.map(String).join(' ')
    if (msg.includes(config.logPrefix)) return
    enqueue(makeEntry('error', 'console', msg))
  }

  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args)
    const msg = args.map(String).join(' ')
    if (msg.includes(config.logPrefix)) return
    enqueue(makeEntry('warn', 'console', msg))
  }
}

function interceptErrors(): void {
  window.addEventListener('error', (event) => {
    enqueue(
      makeEntry('error', 'error', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      }),
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    enqueue(
      makeEntry('error', 'error', `Unhandled rejection: ${message}`, {
        stack: reason instanceof Error ? reason.stack : undefined,
      }),
    )
  })
}

function interceptFetch(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const seq = ++fetchSeq
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'

    // Skip logging our own diagnostics requests to avoid infinite loops
    if (url.includes(config.devEndpoint) || url.includes(`/rest/v1/${config.tableName}`)) {
      return origFetch(input, init)
    }

    // Shorten Supabase URLs for readability
    const shortUrl = url.includes('supabase.co')
      ? url.replace(/https:\/\/[^/]+/, '').replace(/\?.*/, '')
      : url.replace(/\?.*/, '')

    const start = performance.now()
    pendingFetches.set(seq, { url: shortUrl, start })
    enqueue(
      makeEntry('info', 'fetch', `[#${seq}] ${method} ${shortUrl} START`, {
        fullUrl: url.length > 200 ? url.slice(0, 200) : url,
      }),
    )

    try {
      const response = await origFetch(input, init)
      pendingFetches.delete(seq)
      const duration = Math.round(performance.now() - start)
      const level = response.ok ? 'info' : 'error'
      enqueue(
        makeEntry(level as DiagLevel, 'fetch', `[#${seq}] ${method} ${shortUrl} ${response.status} (${duration}ms)`, {
          status: response.status,
          duration,
          ok: response.ok,
        }),
      )
      return response
    } catch (err) {
      pendingFetches.delete(seq)
      const duration = Math.round(performance.now() - start)
      const message = err instanceof Error ? err.message : String(err)
      enqueue(
        makeEntry('error', 'fetch', `[#${seq}] ${method} ${shortUrl} FAILED (${duration}ms): ${message}`, {
          duration,
          error: message,
        }),
      )
      throw err
    }
  }
}

// ---------------------------------------------------------------------------
// Auth state tracking (requires optional supabaseClient)
// ---------------------------------------------------------------------------

function trackAuth(): void {
  const client = config.supabaseClient
  if (!client) return

  client.auth.getSession().then(({ data: { session }, error: err }) => {
    enqueue(
      makeEntry(
        err ? 'error' : 'info',
        'auth',
        err
          ? `getSession error: ${err.message}`
          : session
            ? `Session active (user: ${session.user.id.slice(0, 8)}…, expires: ${new Date((session.expires_at ?? 0) * 1000).toISOString()})`
            : 'No session',
      ),
    )
  })

  client.auth.onAuthStateChange((event, session) => {
    enqueue(
      makeEntry('info', 'auth', `Auth state: ${event}`, {
        userId: session?.user?.id ?? null,
        expiresAt: session?.expires_at ?? null,
      }),
    )
  })
}

// ---------------------------------------------------------------------------
// Navigation / route tracking
// ---------------------------------------------------------------------------

function trackNavigation(): void {
  const origPushState = history.pushState.bind(history)
  const origReplaceState = history.replaceState.bind(history)

  history.pushState = (...args) => {
    origPushState(...args)
    enqueue(makeEntry('info', 'nav', `Navigate → ${location.pathname}${location.search}`))
  }

  history.replaceState = (...args) => {
    origReplaceState(...args)
    enqueue(makeEntry('info', 'nav', `Replace → ${location.pathname}${location.search}`))
  }

  window.addEventListener('popstate', () => {
    enqueue(makeEntry('info', 'nav', `Popstate → ${location.pathname}${location.search}`))
  })

  enqueue(makeEntry('info', 'nav', `Initial route: ${location.pathname}${location.search}`))
}

// ---------------------------------------------------------------------------
// Pending fetch watchdog — detect stuck requests
// ---------------------------------------------------------------------------

function startFetchWatchdog(): void {
  _watchdogTimer = setInterval(() => {
    const now = performance.now()
    for (const [seq, info] of pendingFetches) {
      const elapsed = Math.round(now - info.start)
      if (elapsed > config.watchdogThreshold) {
        enqueue(
          makeEntry('warn', 'fetch', `[#${seq}] STILL PENDING after ${Math.round(elapsed / 1000)}s: ${info.url}`),
        )
      }
    }
  }, config.watchdogInterval)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initDiagnostics(opts: DiagnosticsConfig): void {
  if (initialized) return
  initialized = true

  config = {
    app: opts.app,
    supabaseUrl: opts.supabaseUrl,
    supabaseAnonKey: opts.supabaseAnonKey,
    supabaseClient: opts.supabaseClient,
    storagePrefix: opts.storagePrefix ?? 'diag',
    logPrefix: opts.logPrefix ?? '[diag]',
    devEndpoint: opts.devEndpoint ?? '/__diag/log',
    bootErrorsKey: opts.bootErrorsKey ?? '__diagBootErrors',
    tableName: opts.tableName ?? 'diagnostics',
    flushInterval: opts.flushInterval ?? 3_000,
    flushThreshold: opts.flushThreshold ?? 10,
    watchdogInterval: opts.watchdogInterval ?? 5_000,
    watchdogThreshold: opts.watchdogThreshold ?? 15_000,
    skipRemoteInDev: opts.skipRemoteInDev ?? false,
  }

  sessionId = crypto.randomUUID()

  interceptFetch() // must be first — before anything else calls fetch
  interceptConsole()
  interceptErrors()
  trackNavigation()

  // Log device info
  enqueue(makeEntry('device', 'device', 'Device info', getDeviceInfo()))

  // Log session start
  enqueue(makeEntry('info', 'lifecycle', 'Session started'))

  // Track auth state (uses fetch, so must come after interceptFetch)
  trackAuth()

  // Start watchdog for stuck fetches
  startFetchWatchdog()

  // Periodic flush (recursive setTimeout prevents overlap with async flush)
  function scheduleFlush() {
    _flushTimer = setTimeout(async () => {
      await flush()
      scheduleFlush()
    }, config.flushInterval)
  }
  scheduleFlush()

  // Flush on page unload
  window.addEventListener('beforeunload', flushSync)

  // Flush on visibility hidden (mobile backgrounding)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })

  // Drain pre-module boot errors captured before diagnostics initialized
  const win = window as unknown as Record<string, unknown>
  const bootErrors = win[config.bootErrorsKey] as
    | Array<{
        message: string
        filename: string
        lineno: number
        colno: number
        timestamp: number
      }>
    | undefined
  if (bootErrors?.length) {
    for (const err of bootErrors) {
      const entry = makeEntry('error', 'error', `[boot] ${err.message}`, {
        filename: err.filename,
        lineno: err.lineno,
        colno: err.colno,
      })
      entry.timestamp = err.timestamp
      enqueue(entry)
    }
  }
  delete win[config.bootErrorsKey]
}

export function logMutation(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  result: { data: unknown; error: unknown },
): void {
  const rows = Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0
  const failed = !!result.error
  const silentFail = !failed && rows === 0

  const level: DiagLevel = failed ? 'error' : silentFail ? 'warn' : 'info'
  const status = failed ? 'FAILED' : silentFail ? 'EMPTY (possible RLS block)' : 'OK'
  const msg = `${operation.toUpperCase()} ${table} → ${status} (${rows} rows)`

  if (failed) {
    origError(`${config.logPrefix} mutation`, msg, result.error)
  } else if (silentFail) {
    origWarn(`${config.logPrefix} mutation`, msg)
  } else {
    origLog(`${config.logPrefix} mutation`, msg)
  }

  enqueue(makeEntry(level, 'query', msg, {
    table,
    operation,
    rowCount: rows,
    silentFail,
    error: result.error ? String((result.error as Record<string, unknown>).message ?? result.error) : null,
  }))
}

export function log(
  category: DiagCategory,
  message: string,
  data?: Record<string, unknown>,
): void {
  origLog(config.logPrefix, category, message, data)
  enqueue(makeEntry('info', category, message, data))
}

export function warn(
  category: DiagCategory,
  message: string,
  data?: Record<string, unknown>,
): void {
  origWarn(config.logPrefix, category, message, data)
  enqueue(makeEntry('warn', category, message, data))
}

export function error(
  category: DiagCategory,
  message: string,
  data?: Record<string, unknown>,
): void {
  origError(config.logPrefix, category, message, data)
  enqueue(makeEntry('error', category, message, data))
}
