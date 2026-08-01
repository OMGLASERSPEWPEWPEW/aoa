import type { Event } from './types'

export function isUpTonight(event: Event): boolean {
  const now = new Date()
  const chicagoDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const chicagoDay = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).toLowerCase()

  if (event.start_date && chicagoDate < event.start_date) return false
  if (event.end_date && chicagoDate > event.end_date) return false

  if (!event.show_times) {
    return !!(event.start_date && event.end_date && event.start_date <= chicagoDate && event.end_date >= chicagoDate)
  }

  const exceptions = event.show_times.exceptions as Record<string, string[]> | undefined
  if (exceptions?.[chicagoDate]) return (exceptions[chicagoDate] as string[]).length > 0

  const times = event.show_times[chicagoDay] as string[] | undefined
  return !!times && times.length > 0
}
