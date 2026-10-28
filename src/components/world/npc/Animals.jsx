import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, MathUtils, Vector3 } from 'three'
import { POND, distanceToRiver } from '../../../data/kampungLayout'
import { worldRuntime } from '../../../state/worldRuntime'
import { nearestRoadPoint } from '../life/navigation'
import { worldFx } from '../life/worldFx'
import { worldSfx } from '../../../audio/engine'
import { createRandom, randomBetween } from '../kit'
import { getMaterial } from '../../character/PersonModel'

// ------------------------------------------------------------------ Chickens
const FLOCKS = [
  { area: { xMin: -21.5, xMax: -15.5, zMin: 4.6, zMax: 8.4 }, count: 4 },
  { area: { xMin: -11.5, xMax: -6.5, zMin: 4.8, zMax: 8.4 }, count: 2 },
  { area: { xMin: 15, xMax: 21, zMin: 13, zMax: 20 }, count: 3 },
]
const CHICKEN_COLORS = [
  { body: '#f5efe2', tail: '#e6dcc4' },
  { body: '#a0522d', tail: '#3a2a20' },
  { body: '#c98a3a', tail: '#5a3a1e' },
  { body: '#2a2420', tail: '#1a5a4a' },
]

// every chicken's brain, so the ambient scheduler can send one across the road
const chickenBrains = []

function ChickenModel({ colors, headRef }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} scale={[0.3, 0.27, 0.4]} material={getMaterial(colors.body)} castShadow>
        <sphereGeometry args={[0.5, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.42, -0.2]} rotation={[-0.7, 0, 0]} material={getMaterial(colors.tail)}>
        <coneGeometry args={[0.09, 0.26, 5]} />
      </mesh>
      <group ref={headRef} position={[0, 0.42, 0.15]}>
        <mesh position={[0, 0.08, 0.04]} material={getMaterial(colors.body)}>
          <sphereGeometry args={[0.085, 8, 6]} />
        </mesh>
        <mesh position={[0, 0.17, 0.04]} material={getMaterial('#d8283a')}>
          <boxGeometry args={[0.03, 0.06, 0.09]} />
        </mesh>
        <mesh position={[0, 0.07, 0.14]} rotation={[Math.PI / 2, 0, 0]} material={getMaterial('#f2b134')}>
          <coneGeometry args={[0.028, 0.07, 4]} />
        </mesh>
        <mesh position={[0, 0.02, 0.1]} material={getMaterial('#d8283a')}>
          <sphereGeometry args={[0.022, 5, 4]} />
        </mesh>
      </group>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.09, 0]} material={getMaterial('#f2b134')}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 4]} />
        </mesh>
      ))}
    </group>
  )
}

function Chicken({ area, seed, registry }) {
  const group = useRef()
  const head = useRef()
  const colors = CHICKEN_COLORS[seed % CHICKEN_COLORS.length]
  const brain = useMemo(() => {
    const random = createRandom(seed * 31 + 5)
    const start = new Vector3(randomBetween(random, area.xMin, area.xMax), 0, randomBetween(random, area.zMin, area.zMax))
    return { random, pos: start, target: start.clone(), wait: randomBetween(random, 0, 2), heading: random() * 6 }
  }, [area, seed])

  useEffect(() => {
    registry.push(brain.pos)
    chickenBrains.push(brain)
    return () => {
      const i = registry.indexOf(brain.pos)
      if (i >= 0) registry.splice(i, 1)
      chickenBrains.splice(chickenBrains.indexOf(brain), 1)
    }
  }, [brain, registry])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const b = brain
    const t = state.clock.elapsedTime + seed
    let pecking = false
    let speed = 0.9
    // you came too close: squawk off in a hurry (and don't come back for a bit)
    const p = worldRuntime.playerPosition
    const pd = Math.hypot(p.x - b.pos.x, p.z - b.pos.z)
    if (pd < 1.8 && !b.fleeing) {
      const a = Math.atan2(b.pos.x - p.x, b.pos.z - p.z) + randomBetween(b.random, -0.5, 0.5)
      b.target.set(b.pos.x + Math.sin(a) * 2.6, 0, b.pos.z + Math.cos(a) * 2.6)
      b.wait = 0
      b.fleeing = true
      worldSfx.squawk(0.8)
    }
    if (b.fleeing) speed = 2.8
    if (b.wait > 0) {
      b.wait -= dt
      // between pecks, now and then stand tall and look about
      pecking = !b.looking
      if (b.random() < dt * 0.3) b.looking = !b.looking
      if (b.wait <= 0) {
        b.looking = false
        // across the road and back again
        if (b.crossing === 'there') b.crossing = 'back'
        else if (b.crossing === 'back') b.crossing = null
        if (b.crossing === 'back') b.target.set(randomBetween(b.random, area.xMin, area.xMax), 0, randomBetween(b.random, area.zMin, area.zMax))
        else b.target.set(randomBetween(b.random, area.xMin, area.xMax), 0, randomBetween(b.random, area.zMin, area.zMax))
      }
    } else {
      const dx = b.target.x - b.pos.x
      const dz = b.target.z - b.pos.z
      const d = Math.hypot(dx, dz)
      if (d < 0.1) {
        b.fleeing = false
        b.wait = b.crossing === 'there' ? randomBetween(b.random, 6, 12) : randomBetween(b.random, 1.2, 4)
      } else {
        if (b.crossing) speed = 1.3
        const step = Math.min(d, speed * dt)
        b.pos.x += (dx / d) * step
        b.pos.z += (dz / d) * step
        let diff = Math.atan2(dx, dz) - b.heading
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        b.heading += diff * (1 - Math.exp(-8 * dt))
      }
    }
    if (group.current) {
      const bob = b.fleeing ? Math.abs(Math.sin(t * 22)) * 0.08 : Math.abs(Math.sin(t * 14)) * 0.03
      group.current.position.set(b.pos.x, pecking || b.wait > 0 ? 0 : bob, b.pos.z)
      group.current.rotation.y = b.heading
    }
    if (head.current) {
      const peck = pecking ? Math.max(0, Math.sin(t * 7)) : 0
      head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, b.looking ? -0.2 : peck * 1.1, 0.3)
      head.current.rotation.y = b.looking ? Math.sin(t * 1.7) * 0.8 : 0
      head.current.position.z = 0.15 + peck * 0.06
    }
  })

  return (
    <group ref={group}>
      <ChickenModel colors={colors} headRef={head} />
    </group>
  )
}

// ------------------------------------------------------------------ Ducks
function Duck({ index }) {
  const group = useRef()
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime * 0.18 + index * 2.1
    const r = POND.radius - 1.4 + Math.sin(t * 1.7 + index) * 0.5
    const x = POND.center[0] + Math.cos(t) * r
    const z = POND.center[1] + Math.sin(t) * r
    g.position.set(x, 0.07 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.015, z)
    g.rotation.y = Math.atan2(-Math.sin(t), Math.cos(t))
  })
  const head = index === 0 ? '#2f6a3a' : '#7a5a3a'
  return (
    <group ref={group}>
      <mesh position={[0, 0.1, 0]} scale={[0.26, 0.18, 0.38]} material={getMaterial(index === 0 ? '#e9e2d0' : '#9a7a52')}>
        <sphereGeometry args={[0.5, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.25, 0.14]} material={getMaterial(head)}>
        <sphereGeometry args={[0.075, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.23, 0.24]} material={getMaterial('#f08a2a')}>
        <boxGeometry args={[0.06, 0.02, 0.08]} />
      </mesh>
    </group>
  )
}

// ------------------------------------------------------------------ Butterflies
const BUTTERFLY_HOMES = [
  [-16.8, 7.8],
  [-9.6, 8],
  [-6.2, 1.5],
  [-3.2, 10.5],
  [-4, 15],
  [3.3, -9.2],
  [-20.5, 1.5],
  [6, 26],
]
const WING_COLORS = ['#f2c14e', '#f08a3a', '#f5efe2', '#9fd0e0', '#e9779a']

function Butterfly({ home, index }) {
  const group = useRef()
  const left = useRef()
  const right = useRef()
  const color = WING_COLORS[index % WING_COLORS.length]
  useFrame((state) => {
    const t = state.clock.elapsedTime + index * 3.7
    const g = group.current
    if (!g) return
    const x = home[0] + Math.sin(t * 0.43) * 1.6 + Math.sin(t * 1.3) * 0.3
    const z = home[1] + Math.cos(t * 0.37) * 1.4
    g.position.set(x, 0.9 + Math.sin(t * 1.9) * 0.35, z)
    g.rotation.y = Math.atan2(0.43 * Math.cos(t * 0.43) * 1.6, -0.37 * Math.sin(t * 0.37) * 1.4)
    const flap = Math.sin(t * 22) * 0.9
    if (left.current) left.current.rotation.z = 0.2 + flap
    if (right.current) right.current.rotation.z = -0.2 - flap
  })
  return (
    <group ref={group}>
      {[
        [left, 1],
        [right, -1],
      ].map(([ref, side]) => (
        <group key={side} ref={ref}>
          <mesh position={[side * 0.07, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.14, 0.11]} />
            <meshBasicMaterial color={color} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** One chicken near a road wanders across it, pecks about on the far side, and comes back. */
function crossRoad() {
  const p = worldRuntime.playerPosition
  const candidates = chickenBrains.filter((b) => !b.crossing && !b.fleeing && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 35)
  for (const b of candidates.sort(() => Math.random() - 0.5)) {
    const road = nearestRoadPoint(b.pos.x, b.pos.z)
    if (road.d > 9 || road.d < 0.5) continue
    const dx = (road.x - b.pos.x) / road.d
    const dz = (road.z - b.pos.z) / road.d
    const reach = road.d + 3.2
    const tx = b.pos.x + dx * reach
    const tz = b.pos.z + dz * reach
    if (distanceToRiver(tx, tz) < 1.5) continue
    b.target.set(tx, 0, tz)
    b.crossing = 'there'
    b.wait = 0
    return true
  }
  return false
}

export function Animals() {
  useEffect(() => worldFx.on('chickenCross', crossRoad), [])
  const registry = worldRuntime.npc.chickens
  let seed = 0
  return (
    <>
      {FLOCKS.flatMap((flock) =>
        Array.from({ length: flock.count }, () => {
          seed += 1
          return <Chicken key={seed} seed={seed} area={flock.area} registry={registry} />
        }),
      )}
      {[0, 1, 2].map((i) => (
        <Duck key={i} index={i} />
      ))}
      {BUTTERFLY_HOMES.map((home, i) => (
        <Butterfly key={i} home={home} index={i} />
      ))}
    </>
  )
}
