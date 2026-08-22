import type { CuratorSuggestion } from './types'

export function preferSuggestion(s: CuratorSuggestion): boolean {
  const ev = s.evidence
  if (ev?.events_found != null && ev.events_found > (ev.events_found_current ?? 0)) {
    return true
  }
  if (ev?.confidence != null && ev.confidence < 0.75) {
    return false
  }
  if (s.times_suggested >= 3) {
    return true
  }
  return false
}
