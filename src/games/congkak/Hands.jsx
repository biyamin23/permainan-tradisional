import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { OPPONENT, PLAYER } from './engine'

/**
 * Hands over the board, seen from above. Your arm reaches in from your side,
 * Aisyah's from hers. A sowing hand travels hole to hole and dips at every
 * seed; at the start of each pusingan both hands sow at once. Tap a hole on
 * Aisyah's turn and her other hand slaps yours away.
 */

/**
 * The board always lies flat now (on an upright phone the whole game is
 * turned sideways in CSS), so arms always come in from top and bottom.
 */
export function useFlatBoard() {
  return true
}

/** Arm drawn pointing up; fingertips near the top. */
function ArmArt({ skin, sleeve, cuff, pose, seeds }) {
  const flat = pose === 'flat'
  const fingerTop = flat ? 4 : 18
  const fingers = [27, 40, 53, 66]
  return (
    <svg viewBox="0 0 100 250" className="cg-arm__svg" aria-hidden="true">
      {/* sleeve */}
      <path d="M 16 160 Q 18 150 30 148 L 70 148 Q 82 150 84 160 L 90 250 L 10 250 Z" fill={sleeve} />
      <path d="M 18 152 Q 20 146 30 144 L 70 144 Q 80 146 82 152 L 82 162 L 18 162 Z" fill={cuff} />
      {/* forearm and wrist */}
      <path d="M 33 146 L 31 100 Q 34 92 50 92 Q 66 92 69 100 L 67 146 Z" fill={skin} />
      {/* thumb */}
      <path
        d={flat ? 'M 26 82 Q 10 66 8 48 Q 8 40 15 42 Q 22 46 30 64 Z' : 'M 27 80 Q 14 70 14 56 Q 15 48 21 50 Q 27 54 33 68 Z'}
        fill={skin}
        className="cg-arm__shade"
      />
      {/* palm (back of the hand) */}
      <ellipse cx="50" cy="66" rx="25" ry="30" fill={skin} className="cg-arm__shade" />
      {/* fingers */}
      {fingers.map((x, i) => {
        const lift = i === 0 || i === 3 ? 5 : 0
        return (
          <rect
            key={x}
            x={x - 6}
            y={fingerTop + lift}
            width="12"
            height={52 - fingerTop - lift + (flat ? 0 : 4)}
            rx="6"
            fill={skin}
            className="cg-arm__shade"
          />
        )
      })}
      {/* knuckles */}
      <path d="M 30 50 Q 50 44 70 50" fill="none" className="cg-arm__line" />
      {/* guli peeking from under the curled fingers */}
      {seeds > 0 &&
        [
          [40, 16],
          [55, 13],
          [48, 9],
        ]
          .slice(0, Math.min(3, seeds))
          .map(([x, y], i) => (
            <g key={x}>
              <circle cx={x} cy={y} r="5.5" fill={['#1f9a5a', '#2a6fc9', '#17a3a3'][i]} />
              <circle cx={x - 1.8} cy={y - 1.8} r="1.6" fill="rgba(255,255,255,0.85)" />
            </g>
          ))}
    </svg>
  )
}

const STYLE = {
  [PLAYER]: { sleeve: '#2b9aa0', cuff: '#23797e', skin: '#c98c5f' },
  // Aisyah: yellow baju kurung with a teal songket cuff, like her picture
  [OPPONENT]: { sleeve: '#efbe2e', cuff: '#3cbfb4', skin: '#c48558' },
}

function Arm({ point, angle, visible, pose, seeds, colors, moveMs, tick, recoil }) {
  const style = {
    transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -12%) rotate(${angle}deg)`,
    transitionDuration: `${moveMs}ms, 250ms`,
    opacity: visible ? 1 : 0,
  }
  style['--dip-ms'] = `${Math.max(140, Math.min(moveMs * 1.2, 320))}ms`
  return (
    <div className={`cg-arm ${recoil ? 'is-recoil' : ''}`} style={style}>
      <div className={`cg-arm__dip ${tick != null ? 'is-dipping' : ''}`} key={tick ?? 'still'}>
        <ArmArt {...colors} pose={pose} seeds={seeds} />
      </div>
    </div>
  )
}

/** sowing: [your hand, Aisyah's hand], each { pit, count, side, tick } or null. ready: both waiting to start together. */
export function Hands({ boardRef, sowing, turn, animating, finished, ready, hoverPit, slap, playerSleeve, moveMs }) {
  const flat = useFlatBoard()
  const [size, setSize] = useState({ w: 0, h: 0, s: 50 })
  const [slapPhase, setSlapPhase] = useState(null) // { pit, phase }
  const timers = useRef([])

  // measure the board once it's mounted (and whenever it resizes)
  useEffect(() => {
    const el = boardRef.current
    if (!el) return undefined
    const measure = () => {
      const pit = el.querySelector('[data-pit="0"]')
      setSize({ w: el.offsetWidth, h: el.offsetHeight, s: pit ? pit.offsetWidth : 50 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [boardRef])

  // the tepis: your hand reaches in, Aisyah's other hand smacks it away
  useEffect(() => {
    if (!slap) return undefined
    timers.current.forEach(clearTimeout)
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    setSlapPhase({ pit: slap.pit, phase: 'reach' })
    at(200, () => setSlapPhase({ pit: slap.pit, phase: 'hit' }))
    at(290, () => sfx.slap())
    at(330, () => setSlapPhase({ pit: slap.pit, phase: 'recoil' }))
    at(720, () => setSlapPhase({ pit: slap.pit, phase: 'retreat' }))
    at(1050, () => setSlapPhase(null))
    return () => timers.current.forEach(clearTimeout)
  }, [slap])

  const board = size.w > 0 ? boardRef.current : null
  const pitPoint = (index) => {
    const el = board?.querySelector(`[data-pit="${index}"]`)
    if (!el) return { x: size.w / 2, y: size.h / 2 }
    return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 }
  }

  // where each side's arm comes from
  const youAngle = flat ? 0 : -90
  const themAngle = flat ? 180 : 90
  const edge = (side, distance) => {
    const out = size.s * distance
    // resting spots sit off to one side so they don't cover the name labels
    if (side === PLAYER) return flat ? { x: size.w * 0.8, y: size.h + out } : { x: size.w + out, y: size.h * 0.6 }
    return flat ? { x: size.w * 0.2, y: -out } : { x: -out, y: size.h * 0.4 }
  }

  // ---- your arm
  let you = { point: edge(PLAYER, 3.2), visible: false, pose: 'curl', seeds: 0, tick: null }
  if (slapPhase && slapPhase.phase !== 'retreat') {
    const reachPoint = pitPoint(slapPhase.pit)
    if (slapPhase.phase === 'recoil') you = { point: edge(PLAYER, 1.6), visible: true, pose: 'flat', recoil: true }
    else you = { point: reachPoint, visible: true, pose: 'flat' }
  } else if (sowing[PLAYER]) {
    const h = sowing[PLAYER]
    you = { point: pitPoint(h.pit), visible: true, pose: 'curl', seeds: h.count, tick: h.tick }
  } else if (((turn === PLAYER && !animating) || ready) && !finished) {
    you = hoverPit != null ? { point: pitPoint(hoverPit), visible: true, pose: 'flat' } : { point: edge(PLAYER, 0.35), visible: true, pose: 'flat' }
  }

  // ---- Aisyah's sowing arm
  let them = { point: edge(OPPONENT, 3.2), visible: false, pose: 'curl', seeds: 0, tick: null }
  if (sowing[OPPONENT]) {
    const h = sowing[OPPONENT]
    them = { point: pitPoint(h.pit), visible: true, pose: 'curl', seeds: h.count, tick: h.tick }
  } else if ((turn === OPPONENT || ready) && !finished) {
    them = { point: edge(OPPONENT, 0.35), visible: true, pose: 'flat' }
  }

  // ---- Aisyah's other hand, only for the tepis
  let slapper = { point: edge(OPPONENT, 3.2), visible: false }
  if (slapPhase && (slapPhase.phase === 'hit' || slapPhase.phase === 'recoil')) {
    const p = pitPoint(slapPhase.pit)
    slapper = { point: { x: p.x + (flat ? size.s * 0.5 : 0), y: p.y + (flat ? 0 : size.s * 0.5) }, visible: true }
  }

  const youColors = { ...STYLE[PLAYER], sleeve: playerSleeve ?? STYLE[PLAYER].sleeve }
  // how many guli each sowing hand still holds
  const counts = sowing.filter((h) => h && h.count > 0)

  return (
    <div className={`cg-hands ${size.w > 0 ? '' : 'is-measuring'}`} style={{ '--arm-w': `${size.s * 1.15}px` }} aria-hidden="true">
      <Arm {...you} angle={youAngle} colors={youColors} moveMs={slapPhase ? 200 : moveMs} />
      <Arm {...them} angle={themAngle} colors={STYLE[OPPONENT]} moveMs={moveMs} />
      <Arm {...slapper} angle={themAngle + (flat ? 25 : -25)} pose="flat" colors={STYLE[OPPONENT]} moveMs={110} />
      {counts.map((h) => {
        const p = pitPoint(h.pit)
        return (
          <span
            key={h.side}
            className="cg-hand-count"
            style={{ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, ${h.side === PLAYER ? '-190%' : '90%'})` }}
          >
            {h.count}
          </span>
        )
      })}
    </div>
  )
}
