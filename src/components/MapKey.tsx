export function MapKey() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        zIndex: 1050,
        backgroundColor: 'rgba(12, 10, 5, 0.9)',
        border: '1px solid #2b2720',
        borderRadius: 3,
        padding: '9px 11px',
        backdropFilter: 'blur(6px)',
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9.5,
        color: '#9c9586',
        lineHeight: 1.7,
      }}
    >
      <div>● you have tickets</div>
      <div>◌ want to see</div>
      <div>● been — your colour</div>
      <div style={{ color: 'oklch(0.74 0.16 145)' }}>● curtain up tonight</div>
      <div>▣ house • ◧ storefront • ◬ devised</div>
    </div>
  )
}
