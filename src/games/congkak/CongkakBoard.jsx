import { memo } from 'react'
import { isStore } from './engine'

/**
 * A carved congkak board seen from above, sown clockwise like the real thing:
 * your rumah is on your left, seeds travel right → left along your row, then
 * left → right along the other side.
 *
 * Landscape: you sit at the bottom edge. Portrait phones: the board stands
 * upright and you sit on its right-hand side (your rumah at the bottom).
 */

// grid cell for each position, for both orientations ([column, row])
function placement(index) {
  if (index === 7) return { h: [1, '1 / span 2'], v: ['1 / span 2', 9] }
  if (index === 15) return { h: [9, '1 / span 2'], v: ['1 / span 2', 1] }
  if (index < 7) return { h: [8 - index, 2], v: [2, index + 2] }
  const j = index - 8
  return { h: [2 + j, 1], v: [1, 8 - j] }
}

const GOLDEN = 2.399963

function Shells({ count, store }) {
  const cap = store ? 42 : 15
  const shown = Math.min(count, cap)
  const spread = store ? 38 : 32
  const shells = []
  for (let i = 0; i < shown; i++) {
    const r = Math.sqrt((i + 0.5) / cap) * spread
    const a = i * GOLDEN
    shells.push(
      <span
        key={i}
        className="cg-shell"
        style={{
          left: `${50 + Math.cos(a) * r}%`,
          top: `${50 + Math.sin(a) * r * (store ? 1.2 : 1)}%`,
          transform: `translate(-50%, -50%) rotate(${(i * 67) % 180}deg)`,
        }}
      />,
    )
  }
  return shells
}

function Hand({ count }) {
  return (
    <span className="cg-hand" aria-hidden="true">
      <span className="cg-hand__shells">
        {Array.from({ length: Math.min(count, 5) }, (_, i) => (
          <span key={i} className="cg-shell" style={{ transform: `rotate(${i * 50 - 40}deg)` }} />
        ))}
      </span>
      <span className="cg-hand__count">{count}</span>
    </span>
  )
}

function Pit({ index, count, playable, handCount, flashing, onPlay }) {
  const place = placement(index)
  const store = isStore(index)
  const mine = index <= 7
  const className = ['cg-pit', store ? 'cg-pit--store' : '', mine ? 'is-mine' : 'is-theirs', playable ? 'is-playable' : '', flashing ? 'is-flashing' : '']
    .filter(Boolean)
    .join(' ')
  const style = { '--h-col': place.h[0], '--h-row': place.h[1], '--v-col': place.v[0], '--v-row': place.v[1] }
  const Tag = store ? 'div' : 'button'
  const label = store
    ? `Rumah ${mine ? 'kamu' : 'Aiman'}, ${count} biji`
    : `${mine ? 'Lubang kamu' : 'Lubang Aiman'} ${mine ? index + 1 : index - 7}, ${count} biji`

  return (
    <Tag
      {...(store ? {} : { type: 'button', onClick: () => onPlay?.(index), 'aria-disabled': !playable })}
      className={className}
      style={style}
      aria-label={label}
    >
      <span className="cg-pit__hole">
        <Shells count={count} store={store} />
      </span>
      <span className="cg-pit__count" aria-hidden="true">
        {count}
      </span>
      {handCount > 0 && <Hand count={handCount} />}
    </Tag>
  )
}

/** Boat-shaped hull drawn in SVG behind the holes. */
function Hull() {
  const outline =
    'M 18 150 C 70 38 190 24 300 24 L 900 24 C 1010 24 1130 38 1182 150 C 1130 262 1010 276 900 276 L 300 276 C 190 276 70 262 18 150 Z'
  const inlay =
    'M 58 150 C 104 62 204 50 300 50 L 900 50 C 996 50 1096 62 1142 150 C 1096 238 996 250 900 250 L 300 250 C 204 250 104 238 58 150 Z'
  // small carved swirls (awan larat) at each tip
  const swirl = 'M 70 150 c 0 -26 34 -34 46 -14 c 10 16 -8 30 -20 20 c -8 -7 0 -16 8 -12'
  const art = (
    <>
      <path d={outline} className="cg-hull__wood" />
      <path d={inlay} className="cg-hull__inlay" />
      <path d={swirl} className="cg-hull__carving" />
      <path d={swirl} className="cg-hull__carving" transform="translate(1200 300) rotate(180)" />
    </>
  )
  return (
    <>
      <svg className="cg-hull cg-hull--h" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
        {art}
      </svg>
      <svg className="cg-hull cg-hull--v" viewBox="0 0 300 1200" preserveAspectRatio="none" aria-hidden="true">
        {/* the same hull, stood upright */}
        <g transform="translate(300 0) rotate(90)">{art}</g>
      </svg>
    </>
  )
}

export const CongkakBoard = memo(function CongkakBoard({ pits, canPlay = false, hand = null, flash = null, onPlay }) {
  return (
    <div className="cg-board" role="group" aria-label="Papan congkak">
      <Hull />
      {pits.map((count, index) => (
        <Pit
          key={`${index}-${flash && flash.pits.includes(index) ? flash.key : 0}`}
          index={index}
          count={count}
          playable={canPlay && index < 7 && count > 0}
          handCount={hand?.pit === index ? hand.count : 0}
          flashing={Boolean(flash && flash.pits.includes(index))}
          onPlay={onPlay}
        />
      ))}
    </div>
  )
})
