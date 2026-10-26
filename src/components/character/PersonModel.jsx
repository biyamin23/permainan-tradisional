import { createContext, useContext, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, MeshStandardMaterial } from 'three'

/**
 * Stylised kampung person built from primitives. Used for the player, the
 * kids at the game spots and the adults (Tok Wan, Mak Cik…).
 * Faces +z with feet at y = 0.
 *
 * build:      'kid' | 'adult'
 * look:       colours/clothing (see DEFAULT_LOOK)
 * pose:       idle | wave | cheer | sit | sitDangle | sitPlay | sitThink | sitDrink |
 *             crouch | kick | throw | holdUp |
 *             sweep | fish | hop | pull | ride | swing | guard | toss | clap |
 *             raga (sepak raga: actionRef.current.kind = kuda | sila | lutut | kepala | lambung) |
 *             stand1 | stand2 | bend | balance | throwBack (teng-teng)
 * motionRef:  { current: { speed: 0..1 } } drives the walk cycle
 * actionRef:  { current: { t } } — elapsed time of the last one-shot action
 *             (kick, flick…) so spots can sync props with the animation
 * rightHand / leftHand: optional element held in the hand
 * ghost:      draw see-through (so the character doesn't hide the ground behind)
 */

const BUILDS = {
  kid: {
    hip: 0.56,
    legR: 0.075,
    torsoY: 0.84,
    torsoR: 0.21,
    torsoLen: 0.3,
    shoulderY: 1.06,
    shoulderX: 0.27,
    armLen: 0.24,
    armR: 0.068,
    headY: 1.42,
    headR: 0.28,
  },
  adult: {
    hip: 0.86,
    legR: 0.085,
    torsoY: 1.23,
    torsoR: 0.22,
    torsoLen: 0.44,
    shoulderY: 1.5,
    shoulderX: 0.3,
    armLen: 0.4,
    armR: 0.072,
    headY: 1.86,
    headR: 0.21,
  },
}

export const DEFAULT_LOOK = {
  skin: '#c98c5f',
  shirt: '#2b9aa0',
  bottom: '#4b3a2c',
  bottomType: 'shorts', // shorts | kain | pelikat | seluar
  longTop: false, // baju kurung style top
  hair: '#21140d',
  hairStyle: 'short', // short | pigtails | curly | bob (wavy, to the shoulders) | none
  hairClip: null, // colour of a hair clip
  headwear: null, // tudung | kopiah | songkok | cap
  headwearColor: null,
  capBackward: false,
  slipper: '#2f6fd1',
  accent: '#f2c14e',
  beard: false, // Tok Wan's white beard
  facialHair: null, // goatee | beard | mustache (mustache + goatee)
  top: 'tee', // tee | singlet | kemeja (collared shirt) | baju (baju Melayu, cekak musang) | blocks (colour-block tee)
  blocks: null, // [stripe, patch] colours for top: 'blocks'
  mouth: 'line', // line | smile | grin
  bagStrap: null, // colour of a shoulder-bag strap
}

const materialCache = new Map()
export function getMaterial(color, ghost = false) {
  const key = ghost ? `${color}|ghost` : color
  if (!materialCache.has(key)) {
    const m = new MeshStandardMaterial({ color, roughness: 0.78, flatShading: true })
    if (ghost) {
      // see-through, so a character never hides what's behind them (teng-teng petak)
      m.transparent = true
      m.opacity = 0.3
      m.depthWrite = false
    }
    materialCache.set(key, m)
  }
  return materialCache.get(key)
}

const GhostContext = createContext(false)

function Part({ color, children, shadow = false, ...props }) {
  const ghost = useContext(GhostContext)
  return (
    <mesh castShadow={shadow} material={getMaterial(color, ghost)} {...props}>
      {children}
    </mesh>
  )
}

/** What shows at the neck for each kind of top. */
function Neckline({ look, b }) {
  const y = b.shoulderY + 0.04
  if (look.top === 'singlet') {
    return (
      <>
        {[-1, 1].map((side) => (
          <Part key={side} color={look.shirt} position={[side * b.torsoR * 0.55, y - 0.02, 0]} rotation={[0, 0, side * 0.15]}>
            <boxGeometry args={[0.06, 0.08, b.torsoR * 1.7]} />
          </Part>
        ))}
      </>
    )
  }
  if (look.top === 'kemeja') {
    return (
      <>
        {[-1, 1].map((side) => (
          <Part key={side} color={look.accent} position={[side * 0.07, y, b.torsoR * 0.62]} rotation={[0.5, side * 0.5, side * 0.6]}>
            <boxGeometry args={[0.12, 0.025, 0.1]} />
          </Part>
        ))}
        <Part color={look.skin} position={[0, y - 0.04, b.torsoR * 0.84]} rotation={[0.2, 0, Math.PI / 4]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
        </Part>
        <Part color={look.accent} position={[0, b.torsoY - 0.02, b.torsoR + 0.005]}>
          <boxGeometry args={[0.025, b.torsoLen + 0.1, 0.01]} />
        </Part>
      </>
    )
  }
  if (look.top === 'baju') {
    return (
      <>
        <Part color={look.shirt} position={[0, y + 0.02, 0.01]}>
          <cylinderGeometry args={[b.torsoR * 0.5, b.torsoR * 0.56, 0.07, 12, 1, true]} />
        </Part>
        {[0, 1, 2].map((i) => (
          <Part key={i} color={look.accent} position={[0, y - 0.07 - i * 0.075, b.torsoR + 0.01]}>
            <sphereGeometry args={[0.016, 6, 4]} />
          </Part>
        ))}
      </>
    )
  }
  return (
    <Part color={look.accent} position={[0, y, 0.05]} rotation={[0.3, 0, 0]}>
      <torusGeometry args={[b.torsoR * 0.48, 0.022, 5, 10]} />
    </Part>
  )
}

/** Wavy hair to the shoulders, open at the face. */
function BobHair({ color, r }) {
  const ends = useMemo(() => {
    const out = []
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + 0.95 + (i / 8) * (Math.PI * 2 - 1.9)
      out.push([-Math.cos(a) * r * 1.02, -r * 0.62 - (i % 2) * r * 0.08, Math.sin(a) * r * 1.02])
    }
    return out
  }, [r])
  return (
    <>
      <Part color={color} position={[0, -r * 0.05, -r * 0.04]}>
        <sphereGeometry args={[r * 1.12, 16, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.18, Math.PI * 0.62]} />
      </Part>
      {ends.map((p, i) => (
        <Part key={i} color={color} position={p}>
          <sphereGeometry args={[r * 0.26, 8, 6]} />
        </Part>
      ))}
    </>
  )
}

function CurlyHair({ color, r }) {
  const curls = useMemo(() => {
    const out = []
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const up = i % 2 ? 0.55 : 0.75
      out.push([Math.cos(a) * r * 0.82 * Math.cos(up - 0.4), r * (0.35 + Math.sin(up) * 0.45), Math.sin(a) * r * 0.82 * Math.cos(up - 0.4) - r * 0.08])
    }
    for (let i = 0; i < 5; i++) out.push([(i - 2) * r * 0.3, r * 0.9, r * (i % 2 ? 0.1 : -0.2)])
    return out
  }, [r])
  return (
    <>
      {curls.map((p, i) => (
        <Part key={i} color={color} position={p}>
          <icosahedronGeometry args={[r * 0.3, 0]} />
        </Part>
      ))}
    </>
  )
}

function FacialHair({ kind, color, r, s }) {
  return (
    <>
      {(kind === 'goatee' || kind === 'mustache') && (
        <Part color={color} position={[0, -r * 0.62, r * 0.82]}>
          <boxGeometry args={[0.07 * s, 0.07 * s, 0.05]} />
        </Part>
      )}
      {(kind === 'mustache' || kind === 'beard') && (
        <Part color={color} position={[0, -0.065 * s, r * 0.99]}>
          <boxGeometry args={[0.14 * s, 0.024 * s, 0.03]} />
        </Part>
      )}
      {kind === 'beard' && (
        // a short beard along the jaw, leaving the smile showing
        <Part color={color} position={[0, 0, 0]}>
          <sphereGeometry args={[r * 1.025, 16, 8, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.7, Math.PI * 0.22]} />
        </Part>
      )}
    </>
  )
}

const HEADWEAR_DEFAULTS = { tudung: '#e9779a', kopiah: '#f5f2ea', songkok: '#1e1a1a', cap: '#c9a35a' }

export function PersonModel({
  build = 'kid',
  look: lookOverride,
  pose = 'idle',
  motionRef,
  actionRef,
  phase = 0,
  elder = false,
  detail = true,
  shadows = true,
  rightHand = null,
  leftHand = null,
  ghost = false,
}) {
  const b = BUILDS[build] ?? BUILDS.kid
  const look = useMemo(() => ({ ...DEFAULT_LOOK, ...lookOverride }), [lookOverride])
  const headwearColor = look.headwearColor ?? HEADWEAR_DEFAULTS[look.headwear]
  const faceScale = b.headR / 0.28

  const root = useRef()
  const upper = useRef()
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const walkPhase = useRef(phase * 3)

  const legLen = b.hip - 0.05 - b.legR * 2
  const handY = b.armLen + b.armR * 2
  const kainTop = b.hip + 0.1
  const kainBottom = look.bottomType === 'pelikat' ? b.hip * 0.18 : b.hip * 0.22
  const hairCap = useMemo(() => [b.headR * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56], [b.headR])
  const tudungCap = useMemo(
    () => [b.headR * 1.1, 18, 12, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.8],
    [b.headR],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime + phase
    const speed = motionRef?.current?.speed ?? 0
    walkPhase.current += dt * (4 + speed * 9)
    const swing = Math.sin(walkPhase.current) * 0.75 * speed
    const breathe = Math.sin(time * 2.2) * 0.012
    const sinceAction = actionRef?.current ? state.clock.elapsedTime - actionRef.current.t : 99

    let lL = swing
    let lR = -swing
    let lRz = 0
    let lLz = 0
    let aLx = -swing * 0.9
    let aRx = swing * 0.9
    let aLz = 0.12
    let aRz = -0.12
    let rootY = 0
    let lean = elder ? 0.12 : 0
    let headX = 0
    let bob = Math.abs(Math.sin(walkPhase.current)) * 0.05 * speed + breathe
    const sitY = -(b.hip - b.legR - 0.03)

    switch (pose) {
      case 'wave':
        aRz = -2.5 + Math.sin(time * 9) * 0.3
        aRx = 0
        break
      case 'cheer':
        aLz = 2.6 + Math.sin(time * 10) * 0.15
        aRz = -2.6 - Math.sin(time * 10) * 0.15
        aLx = aRx = 0
        rootY = Math.abs(Math.sin(time * 5)) * 0.2
        break
      case 'sit':
      case 'sitDangle':
      case 'fish':
      case 'toss':
      case 'sitPlay':
      case 'sitThink':
      case 'sitDrink': {
        const atTable = pose === 'sitPlay' || pose === 'sitThink' || pose === 'sitDrink'
        const legAngle = pose === 'sit' || pose === 'toss' ? -1.5 : atTable ? -1.45 : -1.1
        lL = lR = legAngle
        rootY = sitY
        aLx = aRx = -0.35
        bob = breathe
        if (pose === 'fish') {
          aLx = aRx = -1.05 + Math.sin(time * 0.7) * 0.04
          aLz = 0.25
          aRz = -0.25
        }
        const t = time + phase * 3
        if (pose === 'sitPlay') {
          // leaning over the dam board, now and then reaching to move a cap
          const p = t % 5.5
          const reach = p > 4.2 && p < 5.2 ? Math.sin(((p - 4.2) / 1) * Math.PI) : 0
          aLx = -0.95
          aRx = -1.0 - reach * 0.45
          aLz = 0.18
          aRz = -0.1 + reach * 0.15
          lean = 0.22 + reach * 0.12
          headX = 0.25
        }
        if (pose === 'sitThink') {
          // elbow on the table, hand at the chin, studying the board
          aLx = -0.95
          aRx = -2.5
          aRz = -0.45
          lean = 0.2
          headX = 0.2 + Math.sin(t * 0.6) * 0.04
        }
        if (pose === 'sitDrink') {
          // sipping kopi: cup up to the mouth every few seconds
          const p = t % 7
          const sip = p > 5 && p < 6.6 ? Math.sin(((p - 5) / 1.6) * Math.PI) : 0
          aLx = -0.85
          aRx = -0.95 - sip * 1.35
          aRz = -0.12 - sip * 0.25
          headX = -sip * 0.22
          lean = 0.06
        }
        if (pose === 'toss') {
          const p = (time % 1.6) / 1.6
          aRx = -0.6 - Math.sin(p * Math.PI) * 1.0
          headX = -Math.sin(p * Math.PI) * 0.35
          lean = 0.15
        }
        break
      }
      case 'crouch': {
        lL = lR = -0.95
        rootY = -b.hip * 0.38
        lean = 0.45
        aLx = -0.9
        const flick = sinceAction < 0.35 ? Math.sin((sinceAction / 0.35) * Math.PI) : 0
        aRx = -1.0 - flick * 0.5
        bob = breathe
        break
      }
      case 'kick': {
        const k = sinceAction < 0.5 ? Math.sin((sinceAction / 0.5) * Math.PI) : 0
        lR = -1.35 * k
        lL = 0
        aLz = 0.3 + 0.5 * k
        aRz = -0.3 - 0.5 * k
        aLx = aRx = 0
        rootY = 0.05 * k
        lean = -0.12 * k
        headX = -0.25
        break
      }
      case 'throw': {
        const p = time % 3.2
        if (p < 0.7) aRx = MathUtils.lerp(0, 1.5, p / 0.7)
        else if (p < 0.9) aRx = MathUtils.lerp(1.5, -1.5, (p - 0.7) / 0.2)
        else if (p < 1.6) aRx = MathUtils.lerp(-1.5, 0, (p - 0.9) / 0.7)
        else aRx = 0
        lean = p > 0.7 && p < 1.2 ? 0.25 : 0.05
        aLx = -0.3
        break
      }
      case 'holdUp':
        aRx = -2.25 + Math.sin(time * 1.3) * 0.08
        aRz = -0.15
        aLx = -0.5
        headX = -0.35
        break
      case 'sweep':
        lean = 0.3
        aLx = aRx = -0.85
        aRz = Math.sin(time * 2.4) * 0.35 - 0.1
        aLz = Math.sin(time * 2.4) * 0.35 + 0.1
        break
      case 'hop': {
        const p = (time % 0.55) / 0.55
        rootY = Math.sin(p * Math.PI) * 0.28
        lL = -0.9
        lR = 0
        aLz = 0.7
        aRz = -0.7
        aLx = aRx = 0
        break
      }
      case 'pull':
        lean = 0.28
        aLx = aRx = 0.55
        break
      case 'ride': {
        const pedal = Math.sin(walkPhase.current * 1.4)
        lL = -1.1 + pedal * 0.45
        lR = -1.1 - pedal * 0.45
        aLx = aRx = -1.1
        aLz = 0.15
        aRz = -0.15
        lean = 0.2
        rootY = 0
        bob = breathe
        break
      }
      case 'swing': {
        const p = time % 2.6
        const strike = p > 1.2 && p < 1.5 ? Math.sin(((p - 1.2) / 0.3) * Math.PI) : 0
        aLx = aRx = -0.7 - strike * 1.3
        aLz = 0.2
        aRz = -0.2
        lean = 0.3 - strike * 0.3
        lL = -0.2
        lR = 0.25
        break
      }
      case 'guard':
        aLz = 1.25
        aRz = -1.25
        aLx = aRx = 0
        lean = 0.1
        break
      case 'raga': {
        // ready stance, and the sepak raga touches (synced by actionRef)
        const kind = actionRef?.current?.kind ?? 'sila'
        const dur = kind === 'lambung' ? 0.7 : 0.45
        const k = sinceAction < dur ? Math.sin((sinceAction / dur) * Math.PI) : 0
        lean = 0.14
        aLz = 0.55
        aRz = -0.55
        aLx = aRx = -0.15
        lL = lR = -0.12
        rootY = -0.03 + Math.sin(time * 3) * 0.012
        bob = breathe
        if (kind === 'sila') {
          lR = -0.95 * k
          lRz = 0.75 * k
          lL = 0.1 * k
        } else if (kind === 'kuda') {
          lR = 1.25 * k
          lean = 0.14 + 0.35 * k
          headX = 0.25 * k
        } else if (kind === 'lutut') {
          lR = -1.55 * k
          lean = 0.14 - 0.2 * k
        } else if (kind === 'kepala') {
          rootY = 0.22 * k
          headX = -0.45 + 0.9 * k
          lean = -0.1 * k
          lL = lR = -0.25 * k
        } else if (kind === 'lambung') {
          aLx = aRx = -0.4 - 2.3 * k
          aLz = 0.3
          aRz = -0.3
          headX = -0.35 * k
        }
        break
      }
      // ---- teng-teng
      case 'stand1':
        // on one foot, the other bent back
        lL = 0.85
        lR = 0
        aLz = 0.55
        aRz = -0.55
        aLx = aRx = -0.2
        lean = 0.12
        break
      case 'stand2':
        lLz = 0.16
        lRz = -0.16
        aLz = 0.35
        aRz = -0.35
        aLx = aRx = -0.1
        break
      case 'balance':
        // gundu on the head: arms wide, chin up, one foot
        lL = 0.85
        aLz = 1.35 + Math.sin(time * 3) * 0.08
        aRz = -1.35 + Math.sin(time * 3 + 1) * 0.08
        aLx = aRx = 0
        headX = -0.12
        break
      case 'bend':
        lean = 0.95
        aLx = aRx = -1.25
        aLz = 0.15
        aRz = -0.15
        lL = 0.7
        headX = 0.3
        break
      case 'throwBack': {
        // facing away from the court, tossing the gundu back over the shoulder
        const k = sinceAction < 0.6 ? Math.sin((sinceAction / 0.6) * Math.PI) : 0
        aRx = 0.4 - k * 3.0
        aLx = -0.2
        lean = 0.1 - k * 0.25
        headX = -k * 0.3
        break
      }
      case 'clap': {
        const clapping = time % 4 < 1.6
        aLx = aRx = -1.0
        aLz = clapping ? 0.35 + Math.sin(time * 18) * 0.2 : 0.2
        aRz = clapping ? -0.35 - Math.sin(time * 18) * 0.2 : -0.2
        if (!clapping) {
          aLx = aRx = -0.2
        }
        break
      }
      default:
        break
    }

    const k = 1 - Math.exp(-12 * dt)
    const lerpRot = (ref, axis, target) => {
      if (ref.current) ref.current.rotation[axis] = MathUtils.lerp(ref.current.rotation[axis], target, k)
    }
    lerpRot(legL, 'x', lL)
    lerpRot(legR, 'x', lR)
    lerpRot(legR, 'z', lRz)
    lerpRot(legL, 'z', lLz)
    lerpRot(armL, 'x', aLx)
    lerpRot(armR, 'x', aRx)
    lerpRot(armL, 'z', aLz)
    lerpRot(armR, 'z', aRz)
    lerpRot(upper, 'x', lean)
    lerpRot(head, 'x', headX)
    if (head.current) head.current.rotation.z = Math.sin(time * 1.3) * 0.04 * (1 - speed)
    if (upper.current) upper.current.position.y = b.hip + bob
    if (root.current) root.current.position.y = MathUtils.lerp(root.current.position.y, rootY, k)
  })

  const legColor = look.bottomType === 'seluar' ? look.bottom : look.skin
  const isKain = look.bottomType === 'kain' || look.bottomType === 'pelikat'

  return (
    <GhostContext.Provider value={ghost}>
    <group ref={root}>
      {/* Legs (pivot at the hip) */}
      {[
        [legL, 0.11],
        [legR, -0.11],
      ].map(([ref, x]) => (
        <group key={x} ref={ref} position={[x * (b.torsoR / 0.21), b.hip, 0]}>
          <Part color={legColor} position={[0, -(b.hip - 0.05) / 2, 0]}>
            <capsuleGeometry args={[b.legR, legLen, 4, 8]} />
          </Part>
          <Part color={look.slipper} position={[0, -(b.hip - 0.025), 0.04]}>
            <boxGeometry args={[b.legR * 1.9, 0.05, b.legR * 3.2]} />
          </Part>
        </group>
      ))}

      <group ref={upper} position={[0, b.hip, 0]}>
        <group position={[0, -b.hip, 0]}>
          {/* Bottoms */}
          {isKain ? (
            <Part color={look.bottom} shadow={shadows} position={[0, (kainTop + kainBottom) / 2, 0]}>
              <cylinderGeometry args={[b.torsoR * 0.98, b.torsoR * 1.42, kainTop - kainBottom, 10]} />
            </Part>
          ) : (
            <Part color={look.bottom} position={[0, b.hip - 0.02, 0]}>
              <cylinderGeometry args={[b.torsoR * 1.02, b.torsoR * 1.08, look.bottomType === 'seluar' ? 0.16 : 0.2, 10]} />
            </Part>
          )}

          {/* Torso */}
          <Part color={look.shirt} shadow={shadows} position={[0, b.torsoY, 0]}>
            <capsuleGeometry args={[b.torsoR, b.torsoLen, 4, 10]} />
          </Part>
          {look.longTop ? (
            <Part color={look.shirt} position={[0, b.hip - b.hip * 0.12, 0]}>
              <cylinderGeometry args={[b.torsoR * 1.02, b.torsoR * 1.3, b.hip * 0.5, 10]} />
            </Part>
          ) : (
            look.headwear !== 'tudung' && <Neckline look={look} b={b} />
          )}
          {look.top === 'blocks' && look.blocks && (
            <>
              <Part color={look.blocks[0]} position={[-b.torsoR * 0.12, b.torsoY - 0.02, b.torsoR * 0.93]} rotation={[0, -0.12, 0]}>
                <boxGeometry args={[b.torsoR * 0.42, b.torsoLen + b.torsoR * 0.9, 0.03]} />
              </Part>
              <Part color={look.blocks[1]} position={[b.torsoR * 0.42, b.torsoY - b.torsoLen * 0.25, b.torsoR * 0.86]} rotation={[0, 0.42, 0]}>
                <boxGeometry args={[b.torsoR * 0.55, b.torsoLen * 0.75 + b.torsoR * 0.4, 0.03]} />
              </Part>
            </>
          )}
          {look.bagStrap && (
            <>
              <Part color={look.bagStrap} position={[0, b.torsoY + 0.02, 0]} rotation={[0, 0, 0.72]}>
                <torusGeometry args={[b.torsoR * 1.16, 0.022, 4, 14, Math.PI * 2]} />
              </Part>
            </>
          )}

          {/* Arms (pivot at the shoulder) */}
          {[
            [armL, 1, leftHand],
            [armR, -1, rightHand],
          ].map(([ref, side, item]) => (
            <group key={side} ref={ref} position={[side * b.shoulderX, b.shoulderY, 0]}>
              <Part color={look.top === 'singlet' ? look.skin : look.shirt} position={[0, -(b.armLen / 2 + b.armR * 0.6), 0]}>
                <capsuleGeometry args={[b.armR, b.armLen, 4, 8]} />
              </Part>
              <Part color={look.skin} position={[0, -handY, 0]}>
                <sphereGeometry args={[b.armR * 1.05, 8, 6]} />
              </Part>
              {item && <group position={[0, -handY, 0]}>{item}</group>}
            </group>
          ))}

          {/* Head */}
          <group ref={head} position={[0, b.headY, 0]}>
            <Part color={look.skin} shadow={shadows}>
              <sphereGeometry args={[b.headR, 16, 12]} />
            </Part>

            {look.headwear === 'tudung' ? (
              <>
                <Part color={headwearColor} rotation={[-0.25, 0, 0]}>
                  <sphereGeometry args={tudungCap} />
                </Part>
                <Part color={headwearColor} position={[0, -b.headR * 1.05, -0.01]}>
                  <cylinderGeometry args={[b.headR * 0.95, b.torsoR * 1.3, b.headR * 1.3, 12, 1, true]} />
                </Part>
              </>
            ) : (
              look.hairStyle !== 'none' && (
                <Part color={look.hair} position={[0, 0.02, -0.02]} rotation={[-0.35, 0, 0]}>
                  <sphereGeometry args={hairCap} />
                </Part>
              )
            )}

            {look.hairStyle === 'bob' && look.headwear !== 'tudung' && <BobHair color={look.hair} r={b.headR} />}
            {look.hairClip && (
              <group position={[-b.headR * 0.42, b.headR * 0.8, b.headR * 0.42]} rotation={[0.3, 0, 0.5]}>
                {['#f2c14e', '#4fb6c9', '#e9779a'].map((c, i) => (
                  <Part key={c} color={i === 1 ? look.hairClip : c} position={[(i - 1) * b.headR * 0.13, 0, 0]}>
                    <boxGeometry args={[b.headR * 0.13, b.headR * 0.12, b.headR * 0.1]} />
                  </Part>
                ))}
              </group>
            )}
            {look.hairStyle === 'curly' && look.headwear !== 'tudung' && (
              <CurlyHair color={look.hair} r={b.headR} />
            )}

            {look.hairStyle === 'pigtails' &&
              look.headwear !== 'tudung' &&
              [-1, 1].map((side) => (
                <group key={side}>
                  <Part color={look.hair} position={[side * b.headR * 0.96, -0.02, -b.headR * 0.28]}>
                    <sphereGeometry args={[b.headR * 0.39, 8, 6]} />
                  </Part>
                  <Part color={look.accent} position={[side * b.headR * 0.86, b.headR * 0.25, -b.headR * 0.2]} rotation={[0, 0, side * 0.4]}>
                    <boxGeometry args={[0.12, 0.06, 0.06]} />
                  </Part>
                </group>
              ))}

            {(look.headwear === 'kopiah' || look.headwear === 'songkok') && (
              <Part color={headwearColor} position={[0, b.headR * 0.7, -0.01]} rotation={[-0.12, 0, 0]}>
                <cylinderGeometry args={[b.headR * 0.8, b.headR * 0.86, b.headR * (look.headwear === 'songkok' ? 0.6 : 0.42), 14]} />
              </Part>
            )}
            {look.headwear === 'cap' && (
              <group rotation={[0, look.capBackward ? Math.PI : 0, 0]}>
                <Part color={headwearColor} position={[0, b.headR * 0.42, 0]}>
                  <sphereGeometry args={[b.headR * 1.04, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
                </Part>
                <Part color={headwearColor} position={[0, b.headR * 0.62, b.headR * 0.95]}>
                  <boxGeometry args={[b.headR * 1.2, 0.025, b.headR * 0.8]} />
                </Part>
              </group>
            )}

            {/* Face */}
            {[-1, 1].map((side) => (
              <Part key={side} color="#1b1210" position={[side * 0.095 * faceScale, 0.02 * faceScale, b.headR * 0.91]}>
                <sphereGeometry args={[0.036 * faceScale, 6, 5]} />
              </Part>
            ))}
            {detail &&
              [-1, 1].map((side) => (
                <Part key={`c${side}`} color="#e98a7a" position={[side * 0.16 * faceScale, -0.06 * faceScale, b.headR * 0.8]}>
                  <sphereGeometry args={[0.045 * faceScale, 6, 5]} />
                </Part>
              ))}
            {look.mouth === 'line' ? (
              <Part color="#7a2f24" position={[0, -0.1 * faceScale, b.headR * 0.935]}>
                <boxGeometry args={[0.07 * faceScale, 0.018, 0.02]} />
              </Part>
            ) : (
              <group position={[0, -0.1 * faceScale, b.headR * 0.91]}>
                <Part color="#5a1f18">
                  <boxGeometry args={[0.12 * faceScale, (look.mouth === 'grin' ? 0.05 : 0.035) * faceScale, 0.03]} />
                </Part>
                <Part color="#fbf7ef" position={[0, 0.008 * faceScale, 0.012]}>
                  <boxGeometry args={[0.1 * faceScale, 0.018 * faceScale, 0.02]} />
                </Part>
              </group>
            )}
            {look.facialHair && <FacialHair kind={look.facialHair} color={look.hair} r={b.headR} s={faceScale} />}
            {look.beard && (
              <Part color="#ece8df" position={[0, -b.headR * 0.78, b.headR * 0.55]}>
                <sphereGeometry args={[b.headR * 0.42, 8, 6]} />
              </Part>
            )}
          </group>
        </group>
      </group>
    </group>
    </GhostContext.Provider>
  )
}
