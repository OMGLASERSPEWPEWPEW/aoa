import { interpretSpectrum, type SpectrumSlice } from '../lib/emotions'

interface Props {
  slices: SpectrumSlice[]
  totalCards: number
}

export function InterpretationSentence({ slices, totalCards }: Props) {
  return (
    <p
      style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: 14,
        lineHeight: 1.45,
        color: 'var(--ink-dim)',
      }}
    >
      {interpretSpectrum(slices, totalCards)}
    </p>
  )
}
