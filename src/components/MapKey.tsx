export function MapKey() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        zIndex: 1050,
        backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)',
        border: '1px solid var(--rule)',
        borderRadius: 3,
        padding: '9px 11px',
        backdropFilter: 'blur(6px)',
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9.5,
        color: 'var(--ink-dim)',
        lineHeight: 1.7,
      }}
    >
      <div>● you have tickets</div>
      <div>◌ want to see</div>
      <div>● been — your colour</div>
      <div><span style={{ display: 'inline-block', width: 8, height: 8, border: '2px solid var(--live)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />curtain up tonight</div>
      <div><span style={{ color: '#D4A017' }}>◇</span> classes & workshops</div>
      <div>▣ house • ◧ storefront • ◬ devised</div>
    </div>
  )
}
