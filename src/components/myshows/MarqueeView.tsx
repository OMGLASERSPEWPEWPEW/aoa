import type { WatchlistItem, SpectrumSlice, WatchlistStatus } from '../../lib/types'
import { personalInsight } from '../../hooks/useEmotionAggregates'
import { SpectrumBar } from '../SpectrumBar'
import { PosterThumb } from './PosterThumb'
import { BookingRow } from './BookingRow'

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  wantItems: WatchlistItem[]
  bookedItems: WatchlistItem[]
  seenItems: WatchlistItem[]
  counts: Record<WatchlistStatus, number>
  paletteSlices: SpectrumSlice[]
  paletteTotalCards: number
  onShowNavigate: (eventId: string) => void
}

export function MarqueeView({
  scrollRef,
  onTouchStart,
  onTouchEnd,
  wantItems,
  bookedItems,
  seenItems,
  counts,
  paletteSlices,
  paletteTotalCards,
  onShowNavigate,
}: Props) {
  const venueCount = new Set(seenItems.map(i => i.event?.venue_id).filter(Boolean)).size
  const reflectionCount = seenItems.filter(i => i.reflection).length
  const usheredCount = 0

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ padding: '18px 20px 0' }}
    >
      <div className="flex flex-col" style={{ gap: 14 }}>
        {/* Want to See card */}
        <div
          style={{
            border: '1px solid var(--rule)',
            borderRadius: 3,
            background: 'var(--bg-card)',
            padding: '16px 16px 14px',
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink)',
              }}
            >
              Want to See
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--accent)',
              }}
            >
              {counts.want_to_see}
            </span>
          </div>
          {wantItems.length === 0 ? (
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
              Nothing on the list yet.
            </p>
          ) : (
            <div className="flex" style={{ gap: 8 }}>
              {wantItems.slice(0, 3).map(item => (
                <PosterThumb
                  key={item.id}
                  item={item}
                  onClick={() => item.event && onShowNavigate(item.event_id)}
                />
              ))}
              {wantItems.length > 3 && (
                <div
                  style={{
                    flex: 1,
                    height: 84,
                    border: '1px dashed var(--rule)',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 11,
                      color: 'var(--ink-ghost)',
                    }}
                  >
                    +{wantItems.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tickets Booked card */}
        <div
          style={{
            border: '1px solid var(--accent-border)',
            borderRadius: 3,
            background: 'linear-gradient(180deg, oklch(0.18 0.04 55), var(--bg-card))',
            padding: '16px 16px 14px',
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink)',
              }}
            >
              Tickets Booked
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--accent)',
              }}
            >
              {counts.booked}
            </span>
          </div>
          {bookedItems.length === 0 ? (
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
              Nothing here yet.
            </p>
          ) : (
            <div>
              {bookedItems.map((item, i) => (
                <BookingRow
                  key={item.id}
                  item={item}
                  isNext={i === 0}
                  isLast={i === bookedItems.length - 1}
                  onNavigate={() => onShowNavigate(item.event_id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Seen card */}
        <div
          style={{
            border: '1px solid var(--rule)',
            borderRadius: 3,
            background: 'var(--bg-card)',
            padding: '16px 16px 14px',
          }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink)',
              }}
            >
              Seen
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--accent)',
              }}
            >
              {counts.seen}
            </span>
          </div>

          {counts.seen === 0 ? (
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, color: 'var(--ink-dim)', fontStyle: 'italic', marginTop: 8 }}>
              Your record starts whenever you say it does.
            </p>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: 'var(--ink-faint)',
                  marginBottom: 12,
                }}
              >
                {venueCount} VENUE{venueCount !== 1 ? 'S' : ''} {'·'} {reflectionCount} REFLECTION{reflectionCount !== 1 ? 'S' : ''} {'·'} {usheredCount} USHERED
              </div>
              {paletteSlices.length > 0 && (
                <>
                  <div
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      color: 'var(--ink-faint)',
                      marginBottom: 8,
                    }}
                  >
                    YOUR PALETTE, ALL {counts.seen}
                  </div>
                  <SpectrumBar slices={paletteSlices} height={26} totalCards={paletteTotalCards} />
                  <p
                    style={{
                      fontFamily: "'Newsreader', Georgia, serif",
                      fontSize: 14,
                      color: 'var(--ink-dim)',
                      lineHeight: 1.45,
                      marginTop: 8,
                    }}
                  >
                    {personalInsight(paletteSlices)}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ height: 20 }} />
    </div>
  )
}
