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
        color: '#9c9586',
      }}
    >
      {interpretSpectrum(slices, totalCards)}
    </p>
  )
}
