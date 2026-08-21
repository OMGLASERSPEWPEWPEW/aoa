#!/usr/bin/env node
// TS↔SQL parity evaluator for normalize_domain
// Reads the shared fixture file and compares TS output vs SQL output via REST RPC.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtures = JSON.parse(
  readFileSync(join(__dirname, '../../src/lib/__fixtures__/domains.json'), 'utf-8')
)

const SB = process.env.VITE_SUPABASE_URL || process.env.SB
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.ANON

if (!SB || !ANON) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SB and ANON)')
  process.exit(1)
}

// TS implementation (must match src/lib/blocklist.ts exactly)
function normalizeDomain(url) {
  if (!url) return null
  let s = url.trim()
  if (!s) return null
  s = s.replace(/^https?:\/\//i, '')
  if (!s || s === '/') return null
  const slashIdx = s.indexOf('/')
  if (slashIdx !== -1) s = s.substring(0, slashIdx)
  const colonIdx = s.indexOf(':')
  if (colonIdx !== -1) s = s.substring(0, colonIdx)
  s = s.toLowerCase()
  if (s.startsWith('www.')) s = s.substring(4)
  return s || null
}

let failures = 0

for (const [input, expected] of fixtures) {
  // Check TS
  const tsResult = normalizeDomain(input)
  if (tsResult !== expected) {
    console.error(`TS FAIL: normalizeDomain(${JSON.stringify(input)}) = ${JSON.stringify(tsResult)}, expected ${JSON.stringify(expected)}`)
    failures++
    continue
  }

  // Check SQL via REST
  const res = await fetch(`${SB}/rest/v1/rpc/normalize_domain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON,
    },
    body: JSON.stringify({ p_url: input }),
  })

  if (!res.ok) {
    console.error(`SQL HTTP FAIL for ${JSON.stringify(input)}: ${res.status} ${await res.text()}`)
    failures++
    continue
  }

  const sqlResult = await res.json()

  if (sqlResult !== expected) {
    console.error(`SQL FAIL: normalize_domain(${JSON.stringify(input)}) = ${JSON.stringify(sqlResult)}, expected ${JSON.stringify(expected)}`)
    failures++
    continue
  }

  if (tsResult !== sqlResult) {
    console.error(`PARITY FAIL: TS=${JSON.stringify(tsResult)}, SQL=${JSON.stringify(sqlResult)} for input ${JSON.stringify(input)}`)
    failures++
    continue
  }

  console.log(`✓ ${JSON.stringify(input)} → ${JSON.stringify(expected)}`)
}

if (failures > 0) {
  console.error(`\n${failures} parity failure(s)`)
  process.exit(1)
} else {
  console.log(`\nAll ${fixtures.length} pairs match (TS = SQL)`)
}
