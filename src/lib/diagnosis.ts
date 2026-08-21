export type DiagnosisKind = 'ok' | 'dead_site' | 'mistyped' | 'aggregator' | 'no_calendar' | 'never_curated'

export interface Diagnosis {
  kind: DiagnosisKind
  label: string
  severity: 'neutral' | 'warn' | 'danger'
}

const INSTITUTION_HINTS = [
  'university', 'college', 'school of', 'academy',
  'conservatory', 'institute', 'department',
]

interface VenueDiagnosisInput {
  name: string
  venue_type: string | null
  has_calendar_url: boolean
  event_count: number
  source: string
  consecutive_failures?: number
}

export function diagnoseVenue(v: VenueDiagnosisInput): Diagnosis {
  const segments: string[] = []

  // Precedence: aggregator → dead_site → mistyped → no_calendar → never_curated → ok
  const isAggregator = v.source === 'aggregator' || v.venue_type === 'aggregator'
  if (isAggregator) {
    return { kind: 'aggregator', label: 'AGGREGATOR', severity: 'danger' }
  }

  if (v.consecutive_failures && v.consecutive_failures >= 2) {
    segments.push(`DEAD SITE ×${v.consecutive_failures}`)
  }

  const nameLower = v.name.toLowerCase()
  const isMistyped = INSTITUTION_HINTS.some(h => nameLower.includes(h)) && v.venue_type !== 'school'
  if (isMistyped) {
    segments.push('MISTYPED')
  }

  if (!v.has_calendar_url) {
    segments.push('NO CAL')
  }

  if (v.event_count === 0 && v.has_calendar_url) {
    segments.push('NEVER CURATED')
  }

  if (segments.length === 0) {
    return { kind: 'ok', label: '', severity: 'neutral' }
  }

  const label = segments.slice(0, 3).join(' · ')
  const kind: DiagnosisKind = v.consecutive_failures && v.consecutive_failures >= 2
    ? 'dead_site'
    : isMistyped ? 'mistyped'
    : !v.has_calendar_url ? 'no_calendar'
    : 'never_curated'
  const severity = kind === 'dead_site' ? 'danger' : 'warn'

  return { kind, label, severity }
}

interface SchoolDiagnosisInput {
  name: string
  session_count: number
  last_curated_at: string | null
  consecutive_failures?: number
}

export function diagnoseSchool(s: SchoolDiagnosisInput): Diagnosis {
  if (s.consecutive_failures && s.consecutive_failures >= 2) {
    return { kind: 'dead_site', label: `DEAD SITE ×${s.consecutive_failures}`, severity: 'danger' }
  }

  if (s.session_count === 0) {
    return { kind: 'never_curated', label: 'NEVER CURATED', severity: 'warn' }
  }

  return { kind: 'ok', label: '', severity: 'neutral' }
}
