import { useEffect, useRef, useState } from 'react'

const display = { fontFamily: "'Newsreader', serif" } as const

interface CoverageBarProps {
  totalKnown: number
  totalOurs: number
  withCalendar: number
  missingCalendar: number
  animate?: boolean
}

export function CoverageBar({
  totalKnown,
  totalOurs,
  withCalendar,
  missingCalendar,
  animate = true,
}: CoverageBarProps) {
  const coverage = totalKnown > 0 ? Math.round((totalOurs / totalKnown) * 100) : 0
  const missingFromPipeline = Math.max(0, totalKnown - totalOurs)

  // Segment widths as percentages of totalKnown
  const calPct = totalKnown > 0 ? (withCalendar / totalKnown) * 100 : 0
  const noCalPct = totalKnown > 0 ? (missingCalendar / totalKnown) * 100 : 0
  const missingPct = totalKnown > 0 ? (missingFromPipeline / totalKnown) * 100 : 0

  const [mounted, setMounted] = useState(false)
  const prefersReducedMotion = useRef(false)

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Trigger animation on next frame
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const shouldAnimate = animate && !prefersReducedMotion.current
  const scale = mounted || !shouldAnimate ? 1 : 0

  const barSegmentBase: React.CSSProperties = {
    height: 6,
    transition: shouldAnimate ? 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
    transformOrigin: 'left center',
    transform: `scaleX(${scale})`,
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Summary sentence */}
      <div
        style={{
          ...display,
          fontSize: 14,
          color: 'var(--ink)',
          marginBottom: 6,
        }}
      >
        {totalOurs} of {totalKnown} &middot; {coverage}%
      </div>

      {/* Bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          background: 'var(--rule)',
        }}
        role="meter"
        aria-valuenow={coverage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Coverage: ${coverage}%`}
      >
        {calPct > 0 && (
          <div
            style={{
              ...barSegmentBase,
              width: `${calPct}%`,
              background: 'var(--accent)',
            }}
          />
        )}
        {noCalPct > 0 && (
          <div
            style={{
              ...barSegmentBase,
              width: `${noCalPct}%`,
              background: 'var(--danger)',
            }}
          />
        )}
        {missingPct > 0 && (
          <div
            style={{
              ...barSegmentBase,
              width: `${missingPct}%`,
              background: 'var(--ink-faint)',
            }}
          />
        )}
      </div>
    </div>
  )
}
