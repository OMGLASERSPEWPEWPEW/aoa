import { genreHue } from '../lib/genre'

export function GenreChip({ genre, primary = false }: { genre: string; primary?: boolean }) {
  const h = genreHue(genre)
  const isPrimary = primary && h !== null

  return (
    <span
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: 9.5,
        letterSpacing: '0.12em',
        padding: '3px 8px',
        borderRadius: 2,
        textTransform: 'uppercase',
        color: isPrimary ? `oklch(0.82 0.15 ${h})` : 'var(--ink-dim)',
        backgroundColor: isPrimary ? `oklch(0.22 0.05 ${h})` : 'transparent',
        border: isPrimary ? 'none' : '1px solid var(--rule)',
      }}
    >
      {genre}
    </span>
  )
}
