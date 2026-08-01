/**
 * Vite Dev Server Diagnostics Log Plugin
 *
 * Receives diagnostic entries from the browser via POST and writes them to a
 * local log file. Truncates the log on each new session for a clean timeline.
 *
 * Usage in vite.config.ts:
 *
 *   import { diagLogPlugin } from './diagnostics/vite-plugin/diagLogPlugin'
 *
 *   export default defineConfig({
 *     plugins: [react(), diagLogPlugin()],
 *   })
 */

import type { Plugin } from 'vite'
import path from 'path'
import fs from 'fs'

interface DiagLogPluginOptions {
  /** Directory for the log file (default: '.diagnostics/' relative to project root) */
  logDir?: string
  /** POST endpoint the browser module sends to (default: '/__diag/log') */
  endpoint?: string
}

export function diagLogPlugin(opts?: DiagLogPluginOptions): Plugin {
  const endpoint = opts?.endpoint ?? '/__diag/log'

  return {
    name: 'diag-log',
    configureServer(server) {
      // Resolve logDir relative to Vite's project root (available after config is resolved)
      const resolvedLogDir = opts?.logDir ?? path.resolve(server.config.root, '.diagnostics')
      const logFile = path.join(resolvedLogDir, 'console.log')

      server.middlewares.use((req, res, next) => {
        if (req.method !== 'POST' || req.url !== endpoint) return next()

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const entries = JSON.parse(body) as Array<{
              timestamp: number
              level: string
              category: string
              message: string
              data: unknown
            }>

            if (!fs.existsSync(resolvedLogDir)) fs.mkdirSync(resolvedLogDir, { recursive: true })

            // Truncate on new session
            const hasSessionStart = entries.some((e) => e.message === 'Session started')
            if (hasSessionStart) fs.writeFileSync(logFile, '')

            const lines = entries.map((e) => {
              const d = new Date(e.timestamp)
              const ts = d.toTimeString().slice(0, 8)
              const data = e.data ? ' ' + JSON.stringify(e.data) : ''
              return `[${ts}] ${e.level.toUpperCase()} ${e.category}: ${e.message}${data}`
            })

            fs.appendFileSync(logFile, lines.join('\n') + '\n')
          } catch {
            // best-effort
          }

          res.writeHead(204)
          res.end()
        })
      })
    },
  }
}
