import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { ROADS, groundY } from '../../../data/kampungLayout'
import { CYCLIST, NPCS } from '../../../data/npcs'
import { useNpcBody } from '../../../state/npcBodies'
import { worldRuntime } from '../../../state/worldRuntime'
import { PersonModel } from '../../character/PersonModel'
import { Broom, FishingRod } from '../spots/SpotProps'
import { ProximityBubble } from './ProximityBubble'

const HAND_ITEMS = {
  broom: <Broom />,
  rod: <FishingRod />,
}

const SITTING = new Set(['sit', 'sitDangle', 'fish', 'toss'])

function Stool() {
  return (
    <group>
      <mesh position={[0, 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 10]} />
        <meshStandardMaterial color="#8a5d36" />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.15, 0.16, Math.sin(a) * 0.15]}>
            <cylinderGeometry args={[0.025, 0.025, 0.32, 5]} />
            <meshStandardMaterial color="#6b4a2e" />
          </mesh>
        )
      })}
      {/* bucket of fish */}
      <mesh position={[0.45, 0.14, 0.15]} castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.28, 10]} />
        <meshStandardMaterial color="#5a7a8a" />
      </mesh>
    </group>
  )
}

function Villager({ npc }) {
  const sitting = SITTING.has(npc.pose)
  const seatY = npc.stool ? 0.36 : 0
  const headY = (sitting ? 1.55 : 2.35) + seatY
  const body = useRef(null)
  useNpcBody(body, { radius: npc.stool ? 0.45 : 0.32, halfHeight: sitting ? 0.35 : 0.6 })
  return (
    <group ref={body} position={npc.position} rotation={[0, npc.rotationY ?? 0, 0]}>
      {npc.stool && <Stool />}
      <group position={[0, seatY, 0]}>
        <PersonModel
          build={npc.build}
          look={npc.look}
          pose={npc.pose}
          elder={npc.elder}
          rightHand={npc.hand ? HAND_ITEMS[npc.hand] : null}
          watch={worldRuntime.playerPosition}
        />
      </group>
      <ProximityBubble lines={npc.bubble} position={[0, headY, 0]} maxDistance={10} minDistance={0} interval={5200} />
    </group>
  )
}

// ------------------------------------------------------------------ Bicycle
function Wheel({ wheelRef, z }) {
  return (
    <group ref={wheelRef} position={[0, 0.34, z]}>
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.32, 0.03, 6, 20]} />
        <meshStandardMaterial color="#1e1a1a" />
      </mesh>
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} rotation={[a, 0, 0]}>
          <boxGeometry args={[0.02, 0.6, 0.02]} />
          <meshStandardMaterial color="#c9c4b8" />
        </mesh>
      ))}
    </group>
  )
}

function Bar({ from, to, r = 0.025, color = '#2f6a8a' }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const length = Math.hypot(dx, dy, dz)
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} rotation={[Math.atan2(dz, dy), 0, 0]}>
      <cylinderGeometry args={[r, r, length, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export function Bicycle({ frontWheel, rearWheel }) {
  return (
    <group>
      <Wheel wheelRef={rearWheel} z={-0.55} />
      <Wheel wheelRef={frontWheel} z={0.55} />
      <Bar from={[0, 0.34, -0.55]} to={[0, 0.9, -0.15]} />
      <Bar from={[0, 0.9, -0.15]} to={[0, 0.95, 0.4]} />
      <Bar from={[0, 0.34, -0.55]} to={[0, 0.45, 0.05]} />
      <Bar from={[0, 0.45, 0.05]} to={[0, 0.95, 0.4]} />
      <Bar from={[0, 0.34, 0.55]} to={[0, 1.05, 0.42]} />
      {/* seat, handlebar, basket */}
      <mesh position={[0, 0.94, -0.17]}>
        <boxGeometry args={[0.16, 0.05, 0.24]} />
        <meshStandardMaterial color="#3a2a20" />
      </mesh>
      <mesh position={[0, 1.07, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.55, 6]} />
        <meshStandardMaterial color="#c9c4b8" />
      </mesh>
      <mesh position={[0, 0.9, 0.68]} castShadow>
        <boxGeometry args={[0.36, 0.22, 0.28]} />
        <meshStandardMaterial color="#b98a4a" />
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 1.04, 0.68]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#6b4a2e" flatShading />
        </mesh>
      ))}
    </group>
  )
}

// Pak Mat's route: the main road, from the west end to the warung and back
const ROUTE = (() => {
  const points = ROADS[0].points
  const segs = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    segs.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, start: total, len })
    total += len
  }
  return { segs, total }
})()
const ROUTE_FROM = 6
const ROUTE_TO = ROUTE.total - 18

function routeAt(d) {
  const seg = ROUTE.segs.find((s) => d <= s.start + s.len) ?? ROUTE.segs[ROUTE.segs.length - 1]
  const t = d - seg.start
  return { x: seg.ax + seg.dx * t, z: seg.az + seg.dz * t, dx: seg.dx, dz: seg.dz }
}

/** Pak Mat cycling along the main road and back, keeping to his left. */
function Cyclist() {
  const rig = useRef()
  const frontWheel = useRef()
  const rearWheel = useRef()
  const motion = useRef({ speed: 0.6 })
  useNpcBody(rig, { radius: 0.45, halfHeight: 0.5 })
  const state = useRef({ d: ROUTE_FROM, dir: 1, pause: 0, heading: 0, lane: 0.8 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state.current
    let speed = CYCLIST.speed
    if (s.pause > 0) {
      s.pause -= dt
      speed = 0
      if (s.pause <= 0) s.dir *= -1
    } else {
      s.d += s.dir * speed * dt
      if ((s.dir > 0 && s.d >= ROUTE_TO) || (s.dir < 0 && s.d <= ROUTE_FROM)) {
        s.d = MathUtils.clamp(s.d, ROUTE_FROM, ROUTE_TO)
        s.pause = 2.5
      }
    }
    const p = routeAt(s.d)
    // keep left of the direction of travel
    const side = s.dir > 0 ? -1 : 1
    s.lane = MathUtils.lerp(s.lane, side * 0.8, 1 - Math.exp(-1.5 * dt))
    const x = p.x + p.dz * s.lane
    const z = p.z - p.dx * s.lane
    const turning = s.pause > 0 && s.pause < 1.2
    const forward = turning ? -s.dir : s.dir
    const targetHeading = Math.atan2(p.dx * forward, p.dz * forward)
    let diff = targetHeading - s.heading
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    s.heading += diff * (1 - Math.exp(-3 * dt))
    const y = groundY(x, z)

    if (rig.current) {
      rig.current.position.set(x, MathUtils.lerp(rig.current.position.y, y, 0.5), z)
      rig.current.rotation.y = s.heading
    }
    const spin = (speed / 0.32) * dt
    if (frontWheel.current) frontWheel.current.rotation.x += spin
    if (rearWheel.current) rearWheel.current.rotation.x += spin
    motion.current.speed = speed > 0 ? 0.6 : 0
    worldRuntime.npc.bike.set(x, 0, z)
    worldRuntime.npc.bikeMoving = speed > 0
  })

  return (
    <group ref={rig}>
      <Bicycle frontWheel={frontWheel} rearWheel={rearWheel} />
      <group position={[0, 0.1, -0.2]}>
        <PersonModel build="adult" look={CYCLIST.look} pose="ride" motionRef={motion} />
      </group>
      <ProximityBubble lines={CYCLIST.bubble} position={[0, 2.5, 0]} maxDistance={11} interval={2600} />
    </group>
  )
}

export function Npcs() {
  return (
    <>
      {NPCS.map((npc) => (
        <Villager key={npc.id} npc={npc} />
      ))}
      <Cyclist />
    </>
  )
}
