import type { Event } from './types'

export function getTonightTimes(showTimes: Record<string, unknown> | null): string[] {
  if (!showTimes) return []
  const now = new Date()
  const chicagoDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const chicagoDay = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).toLowerCase()

  const exceptions = showTimes.exceptions as Record<string, string[]> | undefined
  if (exceptions?.[chicagoDate]) return exceptions[chicagoDate] as string[]

  const times = showTimes[chicagoDay] as string[] | undefined
  return times ?? []
}

export function formatShowTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
}

export function isUpTonight(event: Event): boolean {
  const now = new Date()
  const chicagoDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const chicagoDay = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).toLowerCase()

  if (event.start_date && chicagoDate < event.start_date) return false
  if (event.end_date && chicagoDate > event.end_date) return false

  if (!event.show_times) {
    if (!event.start_date) return false
    const end = event.end_date ?? event.start_date
    return event.start_date <= chicagoDate && end >= chicagoDate
  }

  const exceptions = event.show_times.exceptions as Record<string, string[]> | undefined
  if (exceptions?.[chicagoDate]) return (exceptions[chicagoDate] as string[]).length > 0

  const times = event.show_times[chicagoDay] as string[] | undefined
  return !!times && times.length > 0
}
