export interface CastMember {
  name: string
  role: string | null
}

export interface CastSectionProps {
  castMembers: CastMember[] | null
}

export function CastSection({ castMembers }: CastSectionProps) {
  return (
    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--rule)' }}>
      <span
        style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          color: 'var(--ink-faint)',
        }}
      >
        THE COMPANY
      </span>
      {castMembers && castMembers.length > 0 ? (
        <div className="flex gap-3" style={{ marginTop: 10, overflowX: 'auto' }}>
          {castMembers.slice(0, 3).map((member, i) => (
            <div key={i} className="flex flex-col items-center" style={{ minWidth: 56 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'var(--rule)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-faint)',
                  fontSize: 20,
                }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 12.5,
                  color: 'var(--ink-dim)',
                  marginTop: 6,
                  textAlign: 'center',
                  maxWidth: 70,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.name}
              </span>
              {member.role && (
                <span
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 9,
                    color: 'var(--ink-ghost)',
                    marginTop: 2,
                  }}
                >
                  {member.role}
                </span>
              )}
            </div>
          ))}
          {castMembers.length > 3 && (
            <div className="flex items-center" style={{ minWidth: 56 }}>
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10.5,
                  color: 'var(--ink-ghost)',
                }}
              >
                +{castMembers.length - 3}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: 'var(--ink-dim)',
            fontStyle: 'italic',
            marginTop: 10,
          }}
        >
          No cast listed — check the venue website.
        </p>
      )}
    </div>
  )
}
