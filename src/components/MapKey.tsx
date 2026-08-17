import { useState, useEffect } from 'react'
import type { MapMode } from '../lib/types'

interface Props {
  mode: MapMode
  isMarkerSelected: boolean
}

const panelStyle: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
  border: '1px solid var(--rule)',
  borderRadius: 3,
  padding: '9px 11px',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  fontFamily: "'Courier Prime', monospace",
  fontSize: 9.5,
  color: 'var(--ink-dim)',
  lineHeight: 1.7,
  marginTop: 4,
}

function ShowsKey() {
  return (
    <div style={panelStyle}>
      <div>● you have tickets</div>
      <div>◌ want to see</div>
      <div>● been — your colour</div>
      <div>
        <span style={{ display: 'inline-block', width: 8, height: 8, border: '2px solid var(--live)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />
        curtain up tonight
      </div>
      <div>▣ house · ◧ storefront · ◬ devised</div>
      <div style={{ color: 'var(--ink-faint)' }}>○ schools, dimmed</div>
    </div>
  )
}

function ClassesKey() {
  return (
    <div style={panelStyle}>
      <div><span style={{ color: 'oklch(.80 .16 110)' }}>◍</span> improv</div>
      <div><span style={{ color: 'oklch(.64 .19 20)' }}>▭</span> acting</div>
      <div><span style={{ color: 'oklch(.68 .13 235)' }}>✎</span> writing</div>
      <div>● enrolling now</div>
      <div>◌ between sessions</div>
      <div style={{ color: 'var(--ink-faint)' }}>□ theaters, dimmed</div>
    </div>
  )
}

export function MapKey({ mode, isMarkerSelected }: Props) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (isMarkerSelected) setOpen(false)
  }, [isMarkerSelected])

  useEffect(() => {
    if (!isMarkerSelected) setOpen(true)
  }, [isMarkerSelected])

  return (
    <div style={{
      position: 'absolute',
      left: 10,
      bottom: 10,
      zIndex: 1200,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9.5,
          letterSpacing: '0.14em',
          padding: '6px 11px',
          borderRadius: 15,
          background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
          border: '1px solid var(--rule)',
          color: 'var(--ink-dim)',
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          textTransform: 'uppercase',
        }}
      >
        THE KEY {open ? '−' : '+'}
      </button>

      {open && (mode === 'shows' ? <ShowsKey /> : <ClassesKey />)}
    </div>
  )
}
