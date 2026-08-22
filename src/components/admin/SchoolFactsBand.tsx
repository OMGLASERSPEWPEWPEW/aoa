import type { School } from '../../lib/types'

const DISCIPLINE_STYLES: Record<string, { color: string; bg: string; glyph: string }> = {
  improv: { color: 'oklch(0.80 0.16 110)', bg: 'oklch(0.55 0.15 110)', glyph: '◍' },
  acting: { color: 'oklch(0.64 0.19 20)',  bg: 'oklch(0.48 0.16 20)',  glyph: '▭' },
}

interface SchoolFactsBandProps {
  school: School
  shortNameDraft: string | null
  priceBandDraft: string | null
  onEditShortName: (v: string) => void
  onEditPriceBand: (v: string) => void
}

export function SchoolFactsBand({
  school, shortNameDraft, priceBandDraft, onEditShortName, onEditPriceBand,
}: SchoolFactsBandProps) {
  const disc = DISCIPLINE_STYLES[school.discipline] ?? DISCIPLINE_STYLES.acting
  const shortName = shortNameDraft ?? school.short_name ?? ''
  const priceBand = priceBandDraft ?? school.price_band ?? ''
  const charCount = shortName.length

  const domain = school.url
    ? school.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
    : null

  const geocodeOk = school.latitude != null && school.longitude != null

  return (
    <div style={{ padding: '12px 20px 0' }}>
      {/* Photo + Address row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '104px 1fr' }}>
        {/* Photo well */}
        <div
          style={{
            position: 'relative',
            height: '78px',
            border: '1px solid var(--rule)',
            borderRadius: '3px',
            overflow: 'hidden',
            background: school.photo_url
              ? `url(${school.photo_url}) center/cover`
              : 'repeating-linear-gradient(135deg, var(--bg-card), var(--bg-card) 6px, var(--rule-soft) 6px, var(--rule-soft) 12px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '6px',
          }}
        >
          {!school.photo_url && (
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: '8px',
              letterSpacing: '0.08em',
              color: 'var(--ink-faint)',
            }}>
              OG IMAGE
            </span>
          )}
        </div>

        {/* Address + geocode + website */}
        <div style={{ minWidth: 0 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: '4px' }}>
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: '9px',
              letterSpacing: '0.14em',
              color: 'var(--ink-faint)',
            }}>
              ADDRESS
            </span>
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: '8.5px',
              letterSpacing: '0.06em',
              color: geocodeOk ? 'var(--access)' : 'var(--danger)',
            }}>
              ◈ {geocodeOk ? 'GEOCODED OK' : 'GEOCODE FAILED'}
            </span>
          </div>
          <div style={{
            border: '1px solid var(--rule)',
            borderRadius: '3px',
            background: 'var(--bg-card)',
            padding: '8px 10px',
          }}>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.3 }}>
              {school.address || 'No address'}
            </p>
            {geocodeOk && (
              <p style={{
                margin: '2px 0 0',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9.5px',
                color: 'var(--ink-dim)',
              }}>
                {school.latitude?.toFixed(6)}, {school.longitude ? (school.longitude < 0 ? '−' : '') + Math.abs(school.longitude).toFixed(6) : ''}
              </p>
            )}
          </div>
          {domain && (
            <p style={{
              margin: '5px 0 0',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              color: 'var(--ink-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {domain}
            </p>
          )}
        </div>
      </div>

      {/* Short name + Band + Type row */}
      <div
        className="grid items-end gap-2"
        style={{ gridTemplateColumns: '1fr auto auto', padding: '11px 0 0' }}
      >
        {/* Short name */}
        <div>
          <div className="flex items-baseline justify-between" style={{ marginBottom: '5px' }}>
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: '9px',
              letterSpacing: '0.14em',
              color: 'var(--accent-text)',
            }}>
              SHORT NAME
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: charCount > 14 ? 'var(--danger)' : 'var(--ink-faint)',
            }}>
              {charCount}/14
            </span>
          </div>
          <input
            type="text"
            value={shortName}
            onChange={(e) => onEditShortName(e.target.value.toUpperCase())}
            maxLength={14}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '0 11px',
              fontFamily: "'Courier Prime', monospace",
              fontSize: '11.5px',
              letterSpacing: '0.04em',
              color: 'var(--ink)',
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '3px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Band */}
        <div>
          <div style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: '9px',
            letterSpacing: '0.14em',
            color: 'var(--ink-faint)',
            marginBottom: '5px',
          }}>
            BAND
          </div>
          <div className="flex gap-1">
            {['$', '$$', '$$$'].map(band => (
              <button
                key={band}
                type="button"
                onClick={() => onEditPriceBand(band)}
                style={{
                  width: band.length === 1 ? '34px' : band.length === 2 ? '38px' : '44px',
                  minHeight: '44px',
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: '11px',
                  color: priceBand === band ? 'var(--bg)' : 'var(--ink-dim)',
                  background: priceBand === band ? 'var(--accent)' : 'none',
                  border: priceBand === band ? 'none' : '1px solid var(--rule)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                {band}
              </button>
            ))}
          </div>
        </div>

        {/* Type (discipline) */}
        <div>
          <div style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: '9px',
            letterSpacing: '0.14em',
            color: 'var(--ink-faint)',
            marginBottom: '5px',
          }}>
            TYPE
          </div>
          <button
            type="button"
            style={{
              minHeight: '44px',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: "'Courier Prime', monospace",
              fontSize: '10.5px',
              letterSpacing: '0.04em',
              color: '#f6f1e3',
              background: disc.bg,
              border: 'none',
              borderRadius: '3px',
              cursor: 'default',
            }}
          >
            <span style={{ fontSize: '12px' }}>{disc.glyph}</span>
            {school.discipline.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  )
}
