import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import { PersonModel } from '../../components/character/PersonModel'
import { ModelSlot } from '../../components/world/ModelSlot'
import { MODELS } from '../../data/models'
import { PETAK, SIZE, START_GAP, centreOf, halfOf } from './engine'
import { AIM_LAP, aimReach, now, ringClose, ringScale, standPoint } from './useTengMatch'

/**
 * The teng-teng court on the lorong: nine petak chalked on red earth, the
 * players, the gundu, selipar left at the side, and your timing ring.
 */

const CHALK = '#f4efe2'
export const GUNDU = { genting: MODELS.gunduGenting, batu: MODELS.gunduBatu, tin: MODELS.gunduTin }
const GUNDU_SCALE = 2.2 // a little bigger than life so it reads on a phone

function ClockBridge({ r }) {
  const clock = useThree((st) => st.clock)
  useEffect(() => {
    r.current.clockNow = () => clock.elapsedTime
  }, [clock, r])
  return null
}

/** Keep the court in view: behind the start line, a little above, following the player. */
function CameraRig({ r }) {
  const { camera, size } = useThree()
  const look = useRef([0, 0, -2])
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1)
    camera.fov = aspect < 0.8 ? 52 : 42
    camera.updateProjectionMatrix()
  }, [camera, size])
  useFrame((_, delta) => {
    const s = r.current
    const body = s.body[s.game.turn]
    // look a little ahead of the player, from high enough that they don't hide the petak
    const z = MathUtils.clamp(body.pos[1] - 0.5, -3.4, -0.5)
    const k = 1 - Math.exp(-2.5 * Math.min(delta, 0.05))
    look.current[2] += (z - look.current[2]) * k
    const tall = size.height > size.width
    camera.position.set(0, tall ? 5.6 : 4.6, look.current[2] + (tall ? 3.9 : 3.6))
    camera.lookAt(0, 0, look.current[2] - 0.2)
  })
  return null
}

function Chalk({ x, z, w, d }) {
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={CHALK} transparent opacity={0.9} />
    </mesh>
  )
}

function Court({ houses, colors }) {
  const lines = useMemo(() => {
    const out = []
    const t = 0.035
    for (const p of PETAK) {
      const [cx, cz] = centreOf(p.id)
      const [hx, hz] = halfOf(p.id)
      out.push({ x: cx, z: cz - hz, w: hx * 2 + t, d: t }, { x: cx, z: cz + hz, w: hx * 2 + t, d: t })
      out.push({ x: cx - hx, z: cz, w: t, d: hz * 2 }, { x: cx + hx, z: cz, w: t, d: hz * 2 })
    }
    // the start line
    out.push({ x: 0, z: -START_GAP + 0.05, w: SIZE * 1.6, d: t * 1.4 })
    return out
  }, [])
  return (
    <group>
      {/* red-earth lorong and grass either side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#86ad4c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -2]} receiveShadow>
        <planeGeometry args={[3.4, 16]} />
        <meshStandardMaterial color="#c98f5a" roughness={1} />
      </mesh>
      {lines.map((l, i) => (
        <Chalk key={i} {...l} />
      ))}
      {/* chalked numbers: small dots, one per number, so it reads without text */}
      {PETAK.map((p) => {
        const [cx, cz] = centreOf(p.id)
        const owner = houses[p.id]
        return (
          <group key={p.id}>
            {owner !== undefined && (
              <mesh position={[cx, 0.008, cz]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[halfOf(p.id)[0] * 2 - 0.06, halfOf(p.id)[1] * 2 - 0.06]} />
                <meshBasicMaterial color={colors[owner]} transparent opacity={0.55} />
              </mesh>
            )}
            <Numeral n={p.id} x={cx} z={cz} />
          </group>
        )
      })}
    </group>
  )
}

/** The petak number in chalk (a canvas texture, drawn once). */
const numeralCache = new Map()
function numeralTexture(n) {
  if (numeralCache.has(n)) return numeralCache.get(n)
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  x.fillStyle = CHALK
  x.font = 'bold 44px sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(String(n), 32, 34)
  numeralCache.set(n, c)
  return c
}
function Numeral({ n, x, z }) {
  const canvas = useMemo(() => numeralTexture(n), [n])
  return (
    <mesh position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.22, 0.22]} />
      <meshBasicMaterial transparent opacity={0.75} depthWrite={false}>
        <canvasTexture attach="map" args={[canvas]} />
      </meshBasicMaterial>
    </mesh>
  )
}

function Kid({ r, index, look }) {
  const ref = useRef()
  useFrame(() => {
    const b = r.current.body[index]
    const g = ref.current
    if (!g) return
    let x = b.pos[0]
    let z = b.pos[1]
    let y = 0
    if (b.hop) {
      const u = MathUtils.clamp((now() - b.hop.start) / b.hop.dur, 0, 1)
      x = MathUtils.lerp(b.hop.from[0], b.hop.to[0], u)
      z = MathUtils.lerp(b.hop.from[1], b.hop.to[1], u)
      y = Math.sin(u * Math.PI) * b.hop.high
    }
    g.position.set(x, y, z)
    let diff = b.face - g.rotation.y
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    g.rotation.y += diff * 0.18
  })
  const s = r.current
  const b = s.body[index]
  // throwing: the player stands at the start line facing the camera and would hide the petak
  const back = s.game.turn === index && (s.phase === 'aim' || s.phase === 'fly')
  return (
    <group ref={ref}>
      <PersonModel build="kid" look={look} pose={b.pose} actionRef={{ current: b.act }} ghost={back} />
    </group>
  )
}

function Gundu({ r, index, kind }) {
  const ref = useRef()
  useFrame(() => {
    const s = r.current
    const g = ref.current
    if (!g) return
    const mine = s.game.turn === index
    let p = null
    if (mine && s.gunduOnHead) {
      // balanced on the head (follows the hop), tipping with the balance
      const b = s.body[index]
      let x = b.pos[0]
      let z = b.pos[1]
      let y = 0
      if (b.hop) {
        const u = MathUtils.clamp((now() - b.hop.start) / b.hop.dur, 0, 1)
        x = MathUtils.lerp(b.hop.from[0], b.hop.to[0], u)
        z = MathUtils.lerp(b.hop.from[1], b.hop.to[1], u)
        y = Math.sin(u * Math.PI) * b.hop.high
      }
      p = [x + s.balance * 0.06, y + 1.72, z]
      g.rotation.z = s.balance * 0.5
    } else if (mine && s.gunduFly && (s.phase === 'fly' || s.gunduAt !== null || s.phase === 'dead')) {
      const f = s.gunduFly
      const u = MathUtils.clamp((now() - f.start) / f.dur, 0, 1)
      p = [
        MathUtils.lerp(f.from[0], f.to[0], u),
        MathUtils.lerp(f.from[1], f.to[1], u) + Math.sin(u * Math.PI) * 1.1,
        MathUtils.lerp(f.from[2], f.to[2], u),
      ]
      g.rotation.x = u < 1 ? now() * 9 : 0
      g.rotation.z = 0
    }
    g.visible = Boolean(p)
    if (p) g.position.set(p[0], p[1], p[2])
  })
  return (
    <group ref={ref} visible={false}>
      <ModelSlot model={GUNDU[kind]} scale={GUNDU_SCALE} fallback={<mesh><cylinderGeometry args={[0.07, 0.07, 0.02, 10]} /><meshStandardMaterial color="#b4472f" /></mesh>} />
    </group>
  )
}

/**
 * The aim arrow while you hold the throw button: it climbs from the bottom of
 * petak 1 to petak 9 with your power, then back down. Hidden for the blind
 * rumah throw (the power meter still shows).
 */
function AimArrow({ r }) {
  const ref = useRef()
  useFrame(() => {
    const s = r.current
    const g = ref.current
    if (!g) return
    const show = Boolean(s.aim && !s.aim.blind)
    g.visible = show
    if (!show) return
    const target = s.game.players[s.game.turn].target
    const x = centreOf(target)[0]
    g.position.set(x, 0.05, -aimReach(s.aim.t0, AIM_LAP[s.level]))
  })
  return (
    <group ref={ref} visible={false}>
      {/* arrow head pointing up the court, with a short tail */}
      <mesh position={[0, 0.04, -0.06]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
        <coneGeometry args={[0.16, 0.26, 3]} />
        <meshBasicMaterial color="#ffd45e" depthTest={false} />
      </mesh>
      <mesh position={[0, 0.04, 0.16]} renderOrder={12}>
        <boxGeometry args={[0.08, 0.02, 0.24]} />
        <meshBasicMaterial color="#ffd45e" depthTest={false} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[halfOf(1)[0] * 2 - 0.06, 0.05]} />
        <meshBasicMaterial color="#ffd45e" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

/** Your timing ring: closes on where you land (or the gundu, or above your head). */
function TimingRing({ r }) {
  const group = useRef()
  const closing = useRef()
  const mat = useRef()
  useFrame(() => {
    const s = r.current
    const ring = s.ring
    const g = group.current
    if (!g) return
    g.visible = Boolean(ring)
    if (!ring) return
    let pos
    if (ring.kind === 'ambil' && s.gunduFly) pos = [s.gunduFly.to[0], 0.03, s.gunduFly.to[2]]
    else if (ring.kind === 'sambut') {
      const b = s.body[s.game.turn]
      pos = [b.pos[0], 0.03, b.pos[1] - 0.3]
    } else {
      const move = s.plan?.moves[s.step + 1]
      const p = move ? standPoint(move) : [0, 0.3]
      pos = [p[0], 0.03, p[1]]
    }
    g.position.set(pos[0], pos[1], pos[2])
    const t = now()
    if (closing.current) closing.current.scale.setScalar(ringScale(ring, t))
    if (mat.current) mat.current.color.set(Math.abs(t - ringClose(ring, t)) <= ring.w ? '#3fd16a' : '#ffd45e')
  })
  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.2, 0.25, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} />
      </mesh>
      <mesh ref={closing} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
        <ringGeometry args={[0.19, 0.24, 40]} />
        <meshBasicMaterial ref={mat} color="#ffd45e" transparent opacity={0.95} depthTest={false} />
      </mesh>
    </group>
  )
}

function Scenery() {
  const trees = useMemo(() => {
    const out = []
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1
      out.push({ x: side * (3 + ((i * 37) % 30) / 10), z: -1 - i * 1.1, s: 0.8 + ((i * 13) % 5) * 0.12, palm: i % 3 === 0 })
    }
    return out
  }, [])
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, t.palm ? 2.6 : 1.1, 0]}>
            <cylinderGeometry args={[0.14, 0.22, t.palm ? 5.2 : 2.2, 6]} />
            <meshStandardMaterial color="#6b4a2e" flatShading />
          </mesh>
          {t.palm ? (
            Array.from({ length: 7 }, (_, k) => (
              <mesh key={k} position={[Math.sin((k / 7) * 6.28) * 0.8, 5.1, Math.cos((k / 7) * 6.28) * 0.8]} rotation={[Math.cos((k / 7) * 6.28) * 0.6, 0, -Math.sin((k / 7) * 6.28) * 0.6]}>
                <boxGeometry args={[0.36, 0.05, 1.7]} />
                <meshStandardMaterial color={k % 2 ? '#5f9a3c' : '#6aa443'} flatShading />
              </mesh>
            ))
          ) : (
            <mesh position={[0, 3, 0]}>
              <icosahedronGeometry args={[1.6, 0]} />
              <meshStandardMaterial color={i % 2 ? '#4f8a3a' : '#5a9440'} flatShading />
            </mesh>
          )}
        </group>
      ))}
      {/* selipar left at the side, and the kapur that drew the court */}
      <group position={[-1.05, 0, 0.55]} rotation={[0, 0.4, 0]}>
        <ModelSlot model={MODELS.selipar} scale={1.6} fallback={null} />
      </group>
      <group position={[-1.2, 0, 1.0]} rotation={[0, -0.3, 0]}>
        <ModelSlot model={MODELS.selipar} scale={1.6} fallback={null} />
      </group>
      <group position={[0.75, 0, -0.2]} rotation={[0, 1.1, 0]}>
        <ModelSlot model={MODELS.kapur} scale={2} fallback={null} />
      </group>
    </group>
  )
}

export function TengView({ r, looks, gundu, houses, colors }) {
  return (
    <Canvas className="tt-canvas" shadows dpr={[1, 1.75]} camera={{ fov: 55, near: 0.1, far: 80, position: [0, 3.5, 5] }}>
      <color attach="background" args={['#f6d7a6']} />
      <fog attach="fog" args={['#f2cf9c', 10, 32]} />
      <hemisphereLight args={['#fff1d6', '#7a6a3a', 0.95]} />
      <directionalLight position={[-5, 7, 3]} intensity={1.7} color="#ffd9a8" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-7} />
      <ClockBridge r={r} />
      <CameraRig r={r} />
      <Court houses={houses} colors={colors} />
      <Scenery />
      <Kid r={r} index={0} look={looks[0]} />
      <Kid r={r} index={1} look={looks[1]} />
      <Gundu r={r} index={0} kind={gundu[0]} />
      <Gundu r={r} index={1} kind={gundu[1]} />
      <AimArrow r={r} />
      <TimingRing r={r} />
    </Canvas>
  )
}
