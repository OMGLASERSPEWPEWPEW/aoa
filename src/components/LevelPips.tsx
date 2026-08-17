interface Props {
  level: 1 | 2 | 3 | 4 | 5
  disciplineColor: string
}

export function LevelPips({ level, disciplineColor }: Props) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }} aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: i <= level ? 16 : 10,
            height: 4,
            borderRadius: 2,
            background: i <= level ? disciplineColor : 'var(--rule)',
          }}
        />
      ))}
    </div>
  )
}
