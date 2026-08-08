interface Props {
  width?: string | number
  height?: string | number
  borderRadius?: number
}

export function LoadingSkeleton({ width = '100%', height = 16, borderRadius = 2 }: Props) {
  return (
    <div
      className="loading-skeleton"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--bg-card)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, rgba(43,39,32,0.3), transparent)',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
