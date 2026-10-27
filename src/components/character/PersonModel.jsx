import { createContext, useContext, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, MathUtils, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three'
import { FOOT_H, animateRig, createRig, isSitting } from './characterAnimation'

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
 *             stand1 | stand2 | bend | balance | aimBack | throwBack (teng-teng) |
 *             celebrate | fail (reactions, timed from actionRef; fail kind 'jatuh' stumbles first)
 * motionRef:  { current: { speed: 0..1, dist, run, bank, jump, balance, look, groundY } }
 *             drives locomotion, jumps, balance and the look-at (see characterAnimation.js)
 * actionRef:  { current: { t, kind } } — elapsed time of the last one-shot action
 *             (kick, flick…) so spots can sync props with the animation
 * watch:      world position (Vector3) this person may turn to look at (the player)
 * headRef:    receives the head group (to balance a gundu on it, say)
 * rightHand / leftHand: optional element held in the hand
 * ghost:      draw see-through (so the character doesn't hide the ground behind)
 *
 * Rig: root → pelvis → legs (hip → knee → ankle) and spine → arms (shoulder →
 * elbow), head. Planted feet are solved with two-bone IK so they stay on the ground.
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

// surface kinds: skin is smooth and a little soft, cloth matte and faceted, hair a touch of sheen
const SURFACES = {
  cloth: { roughness: 0.88, flatShading: true },
  skin: { roughness: 0.58, flatShading: false },
  hair: { roughness: 0.5, flatShading: true },
  eye: { roughness: 0.18, flatShading: false },
  shoe: { roughness: 0.7, flatShading: true },
  default: { roughness: 0.78, flatShading: true },
}

const materialCache = new Map()
export function getMaterial(color, ghost = false, kind = 'default') {
  const key = `${color}|${kind}${ghost ? '|ghost' : ''}`
  if (!materialCache.has(key)) {
    const m = new MeshStandardMaterial({ color, ...(SURFACES[kind] ?? SURFACES.default) })
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

function Part({ color, children, shadow = false, kind = 'cloth', ...props }) {
  const ghost = useContext(GhostContext)
  return (
    <mesh castShadow={shadow} material={getMaterial(color, ghost, kind)} {...props}>
      {children}
    </mesh>
  )
}

// soft contact shadow under the feet (one shared texture, geometry and material)
let blob = null
function contactBlob() {
  if (blob) return blob
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(40,25,10,0.55)')
  g.addColorStop(0.55, 'rgba(40,25,10,0.22)')
  g.addColorStop(1, 'rgba(40,25,10,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  const geometry = new PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  const material = new MeshBasicMaterial({
    map: new CanvasTexture(c),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  blob = { geometry, material }
  return blob
}

const _cam = new Vector3()

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
  phase,
  elder = false,
  detail = true,
  shadows = true,
  rightHand = null,
  leftHand = null,
  ghost = false,
  watch = null,
  headRef = null,
}) {
  const b = BUILDS[build] ?? BUILDS.kid
  const look = useMemo(() => ({ ...DEFAULT_LOOK, ...lookOverride }), [lookOverride])
  const headwearColor = look.headwearColor ?? HEADWEAR_DEFAULTS[look.headwear]
  const faceScale = b.headR / 0.28

  const outer = useRef()
  const root = useRef()
  const pelvis = useRef()
  const upper = useRef()
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  const kneeL = useRef()
  const kneeR = useRef()
  const ankleL = useRef()
  const ankleR = useRef()
  const armL = useRef()
  const armR = useRef()
  const elbowL = useRef()
  const elbowR = useRef()
  const shadowRef = useRef()
  const rig = useMemo(() => createRig(), [])
  const out = useMemo(() => ({}), [])
  const ctx = useMemo(() => ({}), [])
  const watchPoint = useMemo(() => new Vector3(), [])
  const blobParts = contactBlob()

  // legs: hip → knee → ankle in equal halves; arms: shoulder → elbow → hand
  const T = (b.hip - FOOT_H) / 2
  const U = (b.armLen + b.armR * 2) / 2
  const kainTop = b.hip + 0.1
  const kainBottom = look.bottomType === 'pelikat' ? b.hip * 0.18 : b.hip * 0.22
  const hairCap = useMemo(() => [b.headR * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56], [b.headR])
  const tudungCap = useMemo(
    () => [b.headR * 1.1, 18, 12, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.8],
    [b.headR],
  )

  useFrame((state, delta) => {
    if (!outer.current) return
    const m = outer.current.matrixWorld.elements
    // far from the camera: animate at a third of the rate (nobody can tell, the CPU can)
    _cam.set(m[12], m[13], m[14])
    rig.frame++
    const far = _cam.distanceToSquared(state.camera.position) > 38 * 38
    if (far && rig.frame % 3 !== 0) return
    const dt = Math.min(far ? delta * 3 : delta, 0.1)
    const now = state.clock.elapsedTime
    const motion = motionRef?.current

    ctx.pose = pose
    ctx.b = b
    ctx.T = T
    ctx.dt = dt
    ctx.now = now
    ctx.time = now + (phase ?? rig.offset)
    ctx.since = actionRef?.current ? now - actionRef.current.t : 99
    ctx.kind = actionRef?.current?.kind
    ctx.elder = elder
    ctx.motion = motion
    ctx.worldY = m[13]
    ctx.groundY = motion?.groundY ?? 0
    if (watch) {
      watchPoint.copy(watch)
      watchPoint.y += 1.1
      ctx.watch = watchPoint
    } else ctx.watch = null

    const o = animateRig(rig, out, ctx, root.current)

    root.current.position.y = o.rootY
    root.current.rotation.z = motion?.bank ?? 0
    pelvis.current.position.y = b.hip + o.pelvisY
    pelvis.current.rotation.set(0, o.pelvisYaw, o.pelvisRoll)
    upper.current.rotation.set(o.lean, o.twist, o.side)
    upper.current.position.y = Math.sin(ctx.time * 1.9) * 0.006 // breathing
    head.current.rotation.set(o.headX, o.headY, o.headZ)
    armL.current.rotation.set(o.aLx, 0, o.aLz)
    armR.current.rotation.set(o.aRx, 0, o.aRz)
    elbowL.current.rotation.x = o.aLe
    elbowR.current.rotation.x = o.aRe
    legL.current.rotation.set(o.Lthigh, 0, o.Labd)
    legR.current.rotation.set(o.Rthigh, 0, o.Rabd)
    kneeL.current.rotation.x = o.Lknee
    kneeR.current.rotation.x = o.Rknee
    ankleL.current.rotation.set(o.Lankle, 0, o.Lroll)
    ankleR.current.rotation.set(o.Rankle, 0, o.Rroll)

    // contact shadow stays on the ground and shrinks as the feet leave it
    const sh = shadowRef.current
    if (sh) {
      const above = m[13] - ctx.groundY
      const h = Math.max(0, above + o.rootY)
      sh.visible = !isSitting(pose) && h < 1.2 && above > -0.5
      if (sh.visible) {
        sh.position.y = -above + 0.012
        sh.scale.setScalar(b.torsoR * 4.2 * (1 - Math.min(h, 1) * 0.45))
      }
    }
  })

  const setHead = (el) => {
    head.current = el
    if (headRef) headRef.current = el
  }

  const legColor = look.bottomType === 'seluar' ? look.bottom : look.skin
  const isKain = look.bottomType === 'kain' || look.bottomType === 'pelikat'
  // under a kain the thighs take its colour, so a bent knee doesn't flash skin through it
  const thighColor = isKain ? look.bottom : legColor
  const kindOf = (color) => (color === look.skin ? 'skin' : 'cloth')
  const longSleeve = look.longTop || look.top === 'baju' || look.top === 'kemeja' || look.headwear === 'tudung'
  const sleeveColor = look.top === 'singlet' ? look.skin : look.shirt
  const forearmColor = longSleeve ? look.shirt : look.skin
  const limbShadow = shadows && detail

  return (
    <GhostContext.Provider value={ghost}>
    <group ref={outer}>
    <mesh ref={shadowRef} geometry={blobParts.geometry} material={blobParts.material} renderOrder={1} />
    <group ref={root}>
    <group ref={pelvis} position={[0, b.hip, 0]}>
      {/* Legs: hip → knee → ankle */}
      {[
        [legL, kneeL, ankleL, 0.11],
        [legR, kneeR, ankleR, -0.11],
      ].map(([ref, knee, ankle, x]) => (
        <group key={x} ref={ref} position={[x * (b.torsoR / 0.21), 0, 0]}>
          <Part color={thighColor} kind={kindOf(thighColor)} shadow={limbShadow} position={[0, -T / 2, 0]}>
            <capsuleGeometry args={[b.legR * 1.12, Math.max(0.01, T - b.legR * 0.6), 4, 8]} />
          </Part>
          <group ref={knee} position={[0, -T, 0]}>
            <Part color={legColor} kind={kindOf(legColor)} shadow={limbShadow} position={[0, -T / 2, 0]}>
              <capsuleGeometry args={[b.legR, Math.max(0.01, T - b.legR * 0.8), 4, 8]} />
            </Part>
            <group ref={ankle} name="ankle" position={[0, -T, 0]}>
              <Part color={look.slipper} kind="shoe" shadow={limbShadow} position={[0, -FOOT_H / 2, 0.04]}>
                <boxGeometry args={[b.legR * 1.9, FOOT_H, b.legR * 3.2]} />
              </Part>
            </group>
          </group>
        </group>
      ))}

      <group ref={upper}>
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

          {/* Arms: shoulder → elbow → hand */}
          {[
            [armL, elbowL, 1, leftHand],
            [armR, elbowR, -1, rightHand],
          ].map(([ref, elbow, side, item]) => (
            <group key={side} ref={ref} position={[side * b.shoulderX, b.shoulderY, 0]}>
              <Part color={sleeveColor} kind={kindOf(sleeveColor)} shadow={limbShadow} position={[0, -U / 2, 0]}>
                <capsuleGeometry args={[b.armR * 1.05, Math.max(0.01, U - b.armR * 0.5), 4, 8]} />
              </Part>
              <group ref={elbow} position={[0, -U, 0]}>
                <Part color={forearmColor} kind={kindOf(forearmColor)} shadow={limbShadow} position={[0, -U / 2, 0]}>
                  <capsuleGeometry args={[b.armR * 0.95, Math.max(0.01, U - b.armR * 0.9), 4, 8]} />
                </Part>
                <Part color={look.skin} kind="skin" position={[0, -U, 0]}>
                  <sphereGeometry args={[b.armR * 1.1, 8, 6]} />
                </Part>
                {item && <group position={[0, -U, 0]}>{item}</group>}
              </group>
            </group>
          ))}

          {/* Head */}
          <group ref={setHead} name="head" position={[0, b.headY, 0]}>
            <Part color={look.skin} kind="skin" shadow={shadows}>
              <sphereGeometry args={[b.headR, 16, 12]} />
            </Part>

            {look.headwear === 'tudung' ? (
              <>
                <Part color={headwearColor} shadow={shadows} rotation={[-0.25, 0, 0]}>
                  <sphereGeometry args={tudungCap} />
                </Part>
                <Part color={headwearColor} position={[0, -b.headR * 1.05, -0.01]}>
                  <cylinderGeometry args={[b.headR * 0.95, b.torsoR * 1.3, b.headR * 1.3, 12, 1, true]} />
                </Part>
              </>
            ) : (
              look.hairStyle !== 'none' && (
                <Part color={look.hair} kind="hair" position={[0, 0.02, -0.02]} rotation={[-0.35, 0, 0]}>
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
              <group key={side} position={[side * 0.095 * faceScale, 0.02 * faceScale, b.headR * 0.91]}>
                <Part color="#1b1210" kind="eye">
                  <sphereGeometry args={[0.038 * faceScale, 8, 6]} />
                </Part>
                {/* a catchlight keeps the eyes alive in any light */}
                {detail && (
                  <Part color="#fffaf0" kind="eye" position={[0.012 * faceScale, 0.014 * faceScale, 0.03 * faceScale]}>
                    <sphereGeometry args={[0.011 * faceScale, 5, 4]} />
                  </Part>
                )}
              </group>
            ))}
            {detail &&
              [-1, 1].map((side) => (
                <Part key={`c${side}`} color="#e98a7a" kind="skin" position={[side * 0.16 * faceScale, -0.06 * faceScale, b.headR * 0.8]}>
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
    </group>
    </group>
    </GhostContext.Provider>
  )
}
