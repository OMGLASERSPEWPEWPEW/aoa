export interface HeroImageProps {
  photoUrl: string | null | undefined
  venuePhotoUrl: string | null | undefined
}

export function HeroImage({ photoUrl, venuePhotoUrl }: HeroImageProps) {
  const src = photoUrl || venuePhotoUrl

  return (
    <div
      style={{
        height: 196,
        backgroundColor: 'var(--bg-card)',
        backgroundImage: src ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!src && (
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--ink-ghost)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          NO PHOTO AVAILABLE
        </span>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(transparent, var(--bg))',
        }}
      />
    </div>
  )
}
