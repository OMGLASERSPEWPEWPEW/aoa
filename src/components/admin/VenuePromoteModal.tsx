import { useState } from 'react'
import type { QueueItem, PromoteData } from '../../lib/types'
import { buildPromoteDefaults, useVenuePromotion } from '../../hooks/useVenuePromotion'

const mono = { fontFamily: "'Courier Prime', monospace" } as const

interface Props {
  item: QueueItem
  onClose: () => void
  onPromoted: () => void
}

export function VenuePromoteModal({ item, onClose, onPromoted }: Props) {
  const [data, setData] = useState<PromoteData>(buildPromoteDefaults(item))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { promote } = useVenuePromotion()

  const set = (field: keyof PromoteData, value: string | number | null | string[]) =>
    setData((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async () => {
    if (!data.latitude || !data.longitude) {
      setError('Latitude and longitude are required. Enter coordinates or geocode the address.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await promote(item.id, data)
      onPromoted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promotion failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--rule)',
          borderRadius: 4,
          maxWidth: 500,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '20px 24px',
        }}
      >
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 4 }}>
          Promote Venue
        </div>
        <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', marginBottom: 16 }}>
          {data.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Name" value={data.name} onChange={(v) => set('name', v)} />
          <Field label="Slug" value={data.slug} onChange={(v) => set('slug', v)} />
          <Field label="Address" value={data.address} onChange={(v) => set('address', v)} />
          <Field label="Neighborhood" value={data.neighborhood} onChange={(v) => set('neighborhood', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Latitude" value={data.latitude?.toString() ?? ''} onChange={(v) => set('latitude', v ? parseFloat(v) : null)} />
            <Field label="Longitude" value={data.longitude?.toString() ?? ''} onChange={(v) => set('longitude', v ? parseFloat(v) : null)} />
          </div>
          <Field label="Website URL" value={data.website_url} onChange={(v) => set('website_url', v)} />
          <Field label="Calendar URL" value={data.calendar_url} onChange={(v) => set('calendar_url', v)} />
          <Field label="Description" value={data.description} onChange={(v) => set('description', v)} multiline />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <SelectField
              label="Type"
              value={data.venue_type}
              options={['storefront', 'institutional', 'experimental', 'school']}
              onChange={(v) => set('venue_type', v)}
            />
            <SelectField
              label="Price"
              value={data.price_range}
              options={['', '$', '$$', '$$$']}
              onChange={(v) => set('price_range', v)}
            />
          </div>
        </div>

        {error && (
          <div style={{ ...mono, fontSize: 11, color: '#ef4444', marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 2 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ ...mono, fontSize: 11, padding: '6px 16px', background: 'none', border: '1px solid var(--rule)', borderRadius: 2, color: 'var(--ink-dim)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...mono, fontSize: 11, padding: '6px 16px', background: 'var(--accent)', color: 'var(--accent-on)', border: 'none', borderRadius: 2, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Promoting...' : 'Confirm Promote'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const shared = {
    ...mono as Record<string, string>,
    fontSize: '12px',
    padding: '6px 10px',
    background: 'var(--bg-chrome)',
    border: '1px solid var(--rule)',
    borderRadius: '2px',
    color: 'var(--ink)',
    width: '100%',
  }

  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
        {label}
      </span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={shared} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={shared} />
      )}
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...mono, fontSize: 12, padding: '6px 10px', background: 'var(--bg-chrome)', border: '1px solid var(--rule)', borderRadius: 2, color: 'var(--ink)', width: '100%' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || '—'}</option>
        ))}
      </select>
    </label>
  )
}
