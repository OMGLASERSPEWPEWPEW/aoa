import type { FieldEditor } from './types'

export interface FieldMeta {
  name: string
  label: string
  editor: FieldEditor
  consequence?: string
  options?: readonly string[]
  maxLength?: number
  hint?: string
}

export const VENUE_FIELDS: readonly FieldMeta[] = [
  { name: 'photo_url', label: 'PHOTO', editor: 'image', consequence: 'CARDS SHOW A BLANK' },
  { name: 'name', label: 'NAME', editor: 'text' },
  { name: 'venue_type', label: 'TYPE', editor: 'enum',
    options: ['storefront', 'institutional', 'experimental', 'school'] },
  { name: 'calendar_url', label: 'CALENDAR URL', editor: 'url',
    consequence: 'NOTHING GETS CURATED' },
  { name: 'neighborhood', label: 'NEIGHBORHOOD', editor: 'text' },
  { name: 'accessibility_info', label: 'ACCESSIBILITY', editor: 'textarea',
    consequence: 'SHOWS AS A GAP' },
  { name: 'address', label: 'ADDRESS', editor: 'text' },
  { name: 'price_range', label: 'PRICE', editor: 'enum', options: ['$', '$$', '$$$'],
    consequence: 'NO PRICE ON THE CARD' },
  { name: 'website_url', label: 'WEBSITE', editor: 'url' },
  { name: 'genre_tags', label: 'GENRE', editor: 'tags' },
  { name: 'description', label: 'DESCRIPTION', editor: 'textarea' },
  { name: 'latitude', label: 'LOCATION', editor: 'latlng',
    consequence: 'MISSING FROM THE MAP' },
] as const

export const CLASS_SESSION_FIELDS: readonly FieldMeta[] = [
  { name: 'starts_on', label: 'STARTS', editor: 'date',
    consequence: "WON’T SHOW" },
  { name: 'price', label: 'PRICE', editor: 'money',
    consequence: 'NO PRICE ON THE SHEET' },
  { name: 'weeks', label: 'SESSIONS', editor: 'number',
    hint: 'WEEKS' },
  { name: 'delivery', label: 'WHERE', editor: 'enum',
    options: ['in_person', 'online'] },
  { name: 'instructor_name', label: 'INSTRUCTOR', editor: 'text' },
  { name: 'level', label: 'WHERE IT STARTS', editor: 'pips' },
] as const

export const SCHOOL_FIELDS: readonly FieldMeta[] = [
  { name: 'photo_url', label: 'PHOTO', editor: 'image',
    consequence: 'THE MAP SHOWS A BLANK' },
  { name: 'name', label: 'NAME', editor: 'text' },
  { name: 'short_name', label: 'SHORT NAME', editor: 'text', maxLength: 14,
    hint: 'THE MAP LABEL' },
  { name: 'price_band', label: 'PRICE BAND', editor: 'enum', options: ['$', '$$', '$$$'] },
  { name: 'discipline', label: 'DISCIPLINE', editor: 'enum', options: ['improv', 'acting'] },
  { name: 'payment_plan', label: 'PAYMENT PLAN', editor: 'boolean' },
  { name: 'financial_aid', label: 'FINANCIAL AID', editor: 'boolean' },
  { name: 'sliding_scale', label: 'SLIDING SCALE', editor: 'boolean' },
  { name: 'neighborhood', label: 'NEIGHBORHOOD', editor: 'text' },
  { name: 'url', label: 'WEBSITE', editor: 'url' },
  { name: 'address', label: 'ADDRESS', editor: 'text' },
] as const
