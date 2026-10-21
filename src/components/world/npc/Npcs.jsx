import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { MathUtils } from 'three'
import { BRIDGE } from '../../../data/kampungLayout'
import { CYCLIST, NPCS } from '../../../data/npcs'
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
  return (
    <group position={npc.position} rotation={[0, npc.rotationY ?? 0, 0]}>
      {npc.stool && <Stool />}
      <group position={[0, seatY, 0]}>
        <PersonModel
          build={npc.build}
          look={npc.look}
          pose={npc.pose}
          elder={npc.elder}
          rightHand={npc.hand ? HAND_ITEMS[npc.hand] : null}
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

function Bicycle({ frontWheel, rearWheel }) {
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

/** Pak Mat cycling up and down the main road, across the bridge. */
function Cyclist() {
  const rig = useRef()
  const frontWheel = useRef()
  const rearWheel = useRef()
  const motion = useRef({ speed: 0.6 })
  const state = useRef({ z: CYCLIST.road.zFrom, dir: -1, pause: 0, heading: Math.PI, x: -CYCLIST.road.x })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state.current
    const { zFrom, zTo, x: laneX } = CYCLIST.road
    let speed = CYCLIST.speed
    if (s.pause > 0) {
      s.pause -= dt
      speed = 0
      if (s.pause <= 0) s.dir *= -1
    } else {
      s.z += s.dir * speed * dt
      if ((s.dir < 0 && s.z <= zTo) || (s.dir > 0 && s.z >= zFrom)) {
        s.z = MathUtils.clamp(s.z, zTo, zFrom)
        s.pause = 2.5
      }
    }
    // keep left: heading -z rides on -x, heading +z rides on +x
    const targetX = s.dir < 0 ? -laneX : laneX
    s.x = MathUtils.lerp(s.x, targetX, 1 - Math.exp(-1.5 * dt))
    const turning = s.pause > 0 && s.pause < 1.2
    const facingMinusZ = turning ? s.dir > 0 : s.dir < 0
    const targetHeading = facingMinusZ ? Math.PI : 0
    let diff = targetHeading - s.heading
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    s.heading += diff * (1 - Math.exp(-3 * dt))
    const onBridge = Math.abs(s.z - BRIDGE.z) < BRIDGE.length / 2 && Math.abs(s.x - BRIDGE.x) < BRIDGE.width / 2
    const y = onBridge ? 0.1 : 0

    if (rig.current) {
      rig.current.position.set(s.x, MathUtils.lerp(rig.current.position.y, y, 0.2), s.z)
      rig.current.rotation.y = s.heading
    }
    const spin = (speed / 0.32) * dt
    if (frontWheel.current) frontWheel.current.rotation.x += spin
    if (rearWheel.current) rearWheel.current.rotation.x += spin
    motion.current.speed = speed > 0 ? 0.6 : 0
    worldRuntime.npc.bike.set(s.x, 0, s.z)
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
      <RigidBody type="fixed" colliders={false}>
        {NPCS.filter((npc) => npc.collider).map((npc) => (
          <CylinderCollider key={npc.id} args={[0.9, 0.35]} position={[npc.position[0], 0.9, npc.position[2]]} />
        ))}
      </RigidBody>
      <Cyclist />
    </>
  )
}
