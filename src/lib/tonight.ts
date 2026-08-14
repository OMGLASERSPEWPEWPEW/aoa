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
  if (!event.start_date && !event.end_date) return false

  const now = new Date()
  const chicagoDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const chicagoDay = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).toLowerCase()

  if (event.start_date && chicagoDate < event.start_date) return false
  if (event.end_date && chicagoDate > event.end_date) return false

  if (!event.show_times) {
    const start = event.start_date ?? chicagoDate
    const end = event.end_date ?? start
    return start <= chicagoDate && end >= chicagoDate
  }

  const exceptions = event.show_times.exceptions as Record<string, string[]> | undefined
  if (exceptions?.[chicagoDate]) return (exceptions[chicagoDate] as string[]).length > 0

  const times = event.show_times[chicagoDay] as string[] | undefined
  return !!times && times.length > 0
}

function chicagoToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function endOfWeek(): string {
  const now = new Date()
  const chicago = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const day = chicago.getDay()
  const diff = day === 0 ? 0 : 7 - day
  const sunday = new Date(chicago)
  sunday.setDate(chicago.getDate() + diff)
  return sunday.toISOString().slice(0, 10)
}

function endOfMonth(): string {
  const now = new Date()
  const chicago = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const last = new Date(chicago.getFullYear(), chicago.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

function overlapsWindow(event: Event, windowEnd: string): boolean {
  const today = chicagoToday()
  if (!event.start_date && !event.end_date) return false
  if (event.start_date && event.start_date > windowEnd) return false
  const end = event.end_date ?? event.start_date ?? today
  if (end < today) return false
  return true
}

export function isThisWeek(event: Event): boolean {
  return overlapsWindow(event, endOfWeek())
}

export function isThisMonth(event: Event): boolean {
  return overlapsWindow(event, endOfMonth())
}
