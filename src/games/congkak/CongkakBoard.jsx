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
// glass guli: greens, blues and teals like the old jar of marbles
const GULI = ['#1f9a5a', '#2a6fc9', '#17a3a3', '#3cb371', '#1d5fa8', '#5fbf3a', '#0f8a8a', '#3d86e0']

function Marbles({ count, store }) {
  const cap = store ? 44 : 14
  const shown = Math.min(count, cap)
  const spread = store ? 36 : 30
  const marbles = []
  for (let i = 0; i < shown; i++) {
    const r = Math.sqrt((i + 0.5) / cap) * spread
    const a = i * GOLDEN
    marbles.push(
      <span
        key={i}
        className="cg-guli"
        style={{
          left: `${50 + Math.cos(a) * r}%`,
          top: `${50 + Math.sin(a) * r * (store ? 1.25 : 1)}%`,
          '--g': GULI[(i * 5 + count) % GULI.length],
        }}
      />,
    )
  }
  return marbles
}

function Pit({ index, count, playable, flashing, onPlay, onHover }) {
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
      {...(store
        ? {}
        : {
            type: 'button',
            onClick: (event) => onPlay?.(index, event),
            onPointerEnter: (event) => event.pointerType === 'mouse' && onHover?.(index),
            onPointerLeave: () => onHover?.(null),
            'aria-disabled': !playable,
          })}
      data-pit={index}
      className={className}
      style={style}
      aria-label={label}
    >
      <span className="cg-pit__hole">
        <Marbles count={count} store={store} />
      </span>
      <span className="cg-pit__count" aria-hidden="true">
        {count}
      </span>
    </Tag>
  )
}

/** A fern sprig etched into the wood: a curved stem with paired leaves. */
function sprig(x0, y0, x1, y1, bend, leaves = 7, leafLen = 16) {
  const mx = (x0 + x1) / 2 + bend[0]
  const my = (y0 + y1) / 2 + bend[1]
  let d = `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 1)
    // point and tangent on the quadratic curve
    const px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1
    const py = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1
    const tx = 2 * (1 - t) * (mx - x0) + 2 * t * (x1 - mx)
    const ty = 2 * (1 - t) * (my - y0) + 2 * t * (y1 - my)
    const len = Math.hypot(tx, ty)
    const ux = tx / len
    const uy = ty / len
    const l = leafLen * (1 - t * 0.5)
    for (const side of [-1, 1]) {
      // leaves sweep forward at about 40 degrees from the stem
      const lx = ux * 0.75 - side * uy * 0.65
      const ly = uy * 0.75 + side * ux * 0.65
      d += ` M ${px.toFixed(1)} ${py.toFixed(1)} l ${(lx * l).toFixed(1)} ${(ly * l).toFixed(1)}`
    }
  }
  return d
}

// long board with chamfered ends, like the classic kampung congkak
const OUTLINE = 'M 70 14 L 1130 14 L 1190 96 L 1190 204 L 1130 286 L 70 286 L 10 204 L 10 96 Z'
const BEVEL = 'M 76 26 L 1124 26 L 1178 100 L 1178 200 L 1124 274 L 76 274 L 22 200 L 22 100 Z'
const SPRIGS = [
  sprig(30, 120, 112, 40, [-14, 14]),
  sprig(30, 180, 112, 260, [-14, -14]),
  sprig(1170, 120, 1088, 40, [14, 14]),
  sprig(1170, 180, 1088, 260, [14, -14]),
].join(' ')

function Hull() {
  const art = (
    <>
      <path d={OUTLINE} className="cg-hull__wood" />
      <path d={BEVEL} className="cg-hull__bevel" />
      <path d={SPRIGS} className="cg-hull__etch" />
    </>
  )
  return (
    <>
      <svg className="cg-hull cg-hull--h" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="cg-lacquer-h" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6e1f17" />
            <stop offset="0.18" stopColor="#8a2d20" />
            <stop offset="0.5" stopColor="#5a1812" />
            <stop offset="1" stopColor="#3a0e0a" />
          </linearGradient>
        </defs>
        {art}
      </svg>
      <svg className="cg-hull cg-hull--v" viewBox="0 0 300 1200" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="cg-lacquer-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6e1f17" />
            <stop offset="0.18" stopColor="#8a2d20" />
            <stop offset="0.5" stopColor="#5a1812" />
            <stop offset="1" stopColor="#3a0e0a" />
          </linearGradient>
        </defs>
        {/* the same board, stood upright */}
        <g transform="translate(300 0) rotate(90)">{art}</g>
      </svg>
    </>
  )
}

/** Etched eight-point stars in the diamond spaces between the holes. */
const STAR_PATH =
  'M 50 4 L 50 96 M 4 50 L 96 50 M 22 22 L 78 78 M 78 22 L 22 78 M 50 30 L 58 50 L 50 70 L 42 50 Z M 30 50 L 50 42 L 70 50 L 50 58 Z'
// positions along the board in units of one hole (board is 13.08 holes long)
const STAR_SPOTS = [0, 1, 2, 3, 4, 5].map((k) => ((3.64 + 1.16 * k) / 13.08) * 100)

function Stars() {
  return STAR_SPOTS.map((pos) => (
    <svg key={pos} className="cg-star" viewBox="0 0 100 100" style={{ '--pos': `${pos}%` }} aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  ))
}

export const CongkakBoard = memo(function CongkakBoard({ pits, canPlay = false, flash = null, onPlay, onHover, boardRef, children }) {
  return (
    <div className="cg-board" ref={boardRef} role="group" aria-label="Papan congkak">
      <Hull />
      <Stars />
      {pits.map((count, index) => (
        <Pit
          key={`${index}-${flash && flash.pits.includes(index) ? flash.key : 0}`}
          index={index}
          count={count}
          playable={canPlay && index < 7 && count > 0}
          flashing={Boolean(flash && flash.pits.includes(index))}
          onPlay={onPlay}
          onHover={onHover}
        />
      ))}
      {children}
    </div>
  )
})
