import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_BYTES = Number(process.env.BUNDLE_BUDGET_BYTES ?? 200_000)
const warnOnly = process.argv.includes('--warn')
const root = join(process.cwd(), 'dist')

let html
try {
  html = readFileSync(join(root, 'index.html'), 'utf8')
} catch {
  console.error('No dist/index.html found — run `npm run build` first.')
  process.exit(1)
}

const eagerPattern = /(?:src|href)="(\/assets\/[^"]+\.js)"/g
const eagerPaths = new Set()
for (const m of html.matchAll(eagerPattern)) eagerPaths.add(m[1])

let eagerRaw = 0
let eagerGzip = 0
const eagerRows = []

for (const path of eagerPaths) {
  const raw = readFileSync(join(root, path))
  const gz = gzipSync(raw)
  eagerRaw += raw.byteLength
  eagerGzip += gz.byteLength
  eagerRows.push({
    chunk: path.replace(/^\/assets\//, '').replace(/[-.][\da-f]+\.js$/, '.js'),
    raw_KB: (raw.byteLength / 1024).toFixed(1),
    gzip_KB: (gz.byteLength / 1024).toFixed(1),
    eager: true,
  })
}

eagerRows.sort((a, b) => parseFloat(b.gzip_KB) - parseFloat(a.gzip_KB))

console.log('\n  Eager set (initial load):')
console.table(eagerRows)

const eagerGzipKB = (eagerGzip / 1024).toFixed(1)
const budgetKB = (BUDGET_BYTES / 1024).toFixed(1)
const over = eagerGzip > BUDGET_BYTES

console.log(`  Eager JS:  ${(eagerRaw / 1024).toFixed(1)} KB raw / ${eagerGzipKB} KB gzip`)
console.log(`  Budget:    ${budgetKB} KB gzip`)
console.log(`  Status:    ${over ? 'OVER BUDGET' : 'WITHIN BUDGET'}\n`)

if (over && !warnOnly) {
  process.exit(1)
}
