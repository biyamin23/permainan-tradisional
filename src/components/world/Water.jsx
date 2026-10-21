import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Object3D } from 'three'
import { BRIDGE, POND, STREAM } from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { GEO, MAT, createRandom, part, pick, randomBetween } from './kit'

const SAND = '#cfa86e'
const ROCKS = ['#8d877c', '#7a746b', '#a09a8e']
const REEDS = ['#7a9a45', '#8aa64e', '#6c8c3d']
const STREAM_HALF_LENGTH = 110

const FLOW_COUNT = 46
const _dummy = new Object3D()

/** Light streaks drifting along the stream so the water reads as flowing. */
function StreamFlow() {
  const ref = useRef()
  const streaks = useMemo(() => {
    const random = createRandom(9)
    return Array.from({ length: FLOW_COUNT }, () => ({
      x: randomBetween(random, -STREAM_HALF_LENGTH, STREAM_HALF_LENGTH),
      z: STREAM.z + randomBetween(random, -STREAM.width / 2 + 0.5, STREAM.width / 2 - 0.5),
      length: randomBetween(random, 1.2, 3.2),
      speed: randomBetween(random, 0.9, 1.8),
    }))
  }, [])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.1)
    streaks.forEach((s, i) => {
      s.x += s.speed * dt
      if (s.x > STREAM_HALF_LENGTH) s.x = -STREAM_HALF_LENGTH
      _dummy.position.set(s.x, 0.07, s.z)
      _dummy.scale.set(s.length, 0.01, 0.08)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[GEO.box, undefined, FLOW_COUNT]} frustumCulled={false}>
      <meshBasicMaterial color="#cfeef0" transparent opacity={0.45} />
    </instancedMesh>
  )
}

function buildStreamParts() {
  const random = createRandom(11)
  const box = []
  const blob = []
  const blade = []
  const bankOffset = STREAM.width / 2 + 0.45
  const gap = BRIDGE.width / 2 + 0.6
  const bankLength = STREAM_HALF_LENGTH - gap
  for (const side of [-1, 1]) {
    for (const dir of [-1, 1]) {
      box.push(
        part([dir * (gap + bankLength / 2), 0.025, STREAM.z + side * bankOffset], [bankLength, 0.04, 1.1], [0, 0, 0], SAND),
      )
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = randomBetween(random, -STREAM_HALF_LENGTH + 5, STREAM_HALF_LENGTH - 5)
    if (Math.abs(x) < BRIDGE.width) continue
    const side = random() > 0.5 ? 1 : -1
    const z = STREAM.z + side * randomBetween(random, STREAM.width / 2 - 0.2, STREAM.width / 2 + 0.9)
    const s = randomBetween(random, 0.35, 1.0)
    blob.push(part([x, s * 0.2, z], [s, s * 0.6, s * 0.9], [random(), random() * 3, 0], pick(random, ROCKS)))
  }
  for (let i = 0; i < 160; i++) {
    const x = randomBetween(random, -STREAM_HALF_LENGTH + 5, STREAM_HALF_LENGTH - 5)
    if (Math.abs(x) < BRIDGE.width) continue
    const side = random() > 0.5 ? 1 : -1
    const z = STREAM.z + side * randomBetween(random, STREAM.width / 2 - 0.5, STREAM.width / 2 + 0.3)
    const h = randomBetween(random, 0.6, 1.3)
    blade.push(part([x, 0, z], [0.12, h, 0.12], [randomBetween(random, -0.2, 0.2), 0, randomBetween(random, -0.2, 0.2)], pick(random, REEDS)))
  }
  return { box, blob, blade }
}

function buildBridgeParts() {
  const box = []
  const cylinder = []
  const z0 = BRIDGE.z - BRIDGE.length / 2
  const z1 = BRIDGE.z + BRIDGE.length / 2
  const plankColors = ['#9b7048', '#8a6340', '#a87b50']
  let i = 0
  for (let z = z0 + 0.17; z < z1; z += 0.36) {
    box.push(part([BRIDGE.x, 0.07, z], [BRIDGE.width, 0.06, 0.32], [0, (i % 3) * 0.01 - 0.01, 0], plankColors[i % 3]))
    i++
  }
  for (const x of [-1.35, 1.35]) {
    box.push(part([BRIDGE.x + x, 0.0, BRIDGE.z], [0.22, 0.16, BRIDGE.length], [0, 0, 0], '#5e4029'))
  }
  for (const x of [-1.78, 1.78]) {
    for (const z of [z0 + 0.15, BRIDGE.z, z1 - 0.15]) {
      cylinder.push(part([BRIDGE.x + x, 0.55, z], [0.16, 1.3, 0.16], [0, 0, 0], '#6b4a2e'))
    }
    box.push(part([BRIDGE.x + x, 1.05, BRIDGE.z], [0.1, 0.1, BRIDGE.length], [0, 0, 0], '#8a6340'))
    box.push(part([BRIDGE.x + x, 0.6, BRIDGE.z], [0.07, 0.07, BRIDGE.length], [0, 0, 0], '#8a6340'))
  }
  // stilts down into the water
  for (const z of [BRIDGE.z - 1.4, BRIDGE.z + 1.4]) {
    for (const x of [-1.35, 1.35]) {
      cylinder.push(part([BRIDGE.x + x, -0.3, z], [0.2, 0.8, 0.2], [0, 0, 0], '#4f3622'))
    }
  }
  return { box, cylinder }
}

function buildPondParts() {
  const random = createRandom(23)
  const cylinder = []
  const blob = []
  const blade = []
  const [cx, cz] = POND.center
  // lily pads
  for (let i = 0; i < 11; i++) {
    const a = random() * Math.PI * 2
    const r = randomBetween(random, 0.8, POND.radius - 0.6)
    const s = randomBetween(random, 0.45, 0.8)
    cylinder.push(part([cx + Math.cos(a) * r, 0.09, cz + Math.sin(a) * r], [s, 0.03, s], [0, 0, 0], i % 2 ? '#4f8f3c' : '#5c9c44'))
    if (i % 3 === 0) {
      blade.push(part([cx + Math.cos(a) * r, 0.1, cz + Math.sin(a) * r], [0.22, 0.22, 0.22], [0, i, 0], '#f2a2c0'))
    }
  }
  // stones around the edge
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + randomBetween(random, -0.08, 0.08)
    const r = POND.radius + randomBetween(random, 0.1, 0.5)
    const s = randomBetween(random, 0.4, 0.85)
    blob.push(part([cx + Math.cos(a) * r, s * 0.18, cz + Math.sin(a) * r], [s, s * 0.55, s], [random(), random() * 3, 0], pick(random, ROCKS)))
  }
  for (let i = 0; i < 40; i++) {
    const a = random() * Math.PI * 2
    const r = POND.radius + randomBetween(random, -0.2, 0.6)
    blade.push(part([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r], [0.1, randomBetween(random, 0.5, 1.1), 0.1], [randomBetween(random, -0.25, 0.25), 0, randomBetween(random, -0.25, 0.25)], pick(random, REEDS)))
  }
  return { cylinder, blob, blade }
}

export function Water() {
  const streamParts = useMemo(buildStreamParts, [])
  const bridgeParts = useMemo(buildBridgeParts, [])
  const pondParts = useMemo(buildPondParts, [])
  const [pondX, pondZ] = POND.center
  const gapHalf = BRIDGE.width / 2 + 0.05
  const blockerHalfLength = (STREAM_HALF_LENGTH - gapHalf) / 2

  return (
    <group>
      {/* Stream */}
      <mesh position={[0, 0.05, STREAM.z]} receiveShadow material={MAT.water}>
        <boxGeometry args={[STREAM_HALF_LENGTH * 2, 0.04, STREAM.width]} />
      </mesh>
      <mesh position={[0, 0.02, STREAM.z]}>
        <boxGeometry args={[STREAM_HALF_LENGTH * 2, 0.02, STREAM.width + 0.4]} />
        <meshStandardMaterial color="#2f5e5a" roughness={1} />
      </mesh>
      <StreamFlow />
      <PartsBundle bundle={streamParts} />

      {/* Bridge */}
      <PartsBundle bundle={bridgeParts} />

      {/* Pond */}
      <mesh position={[pondX, 0.06, pondZ]} receiveShadow material={MAT.water}>
        <cylinderGeometry args={[POND.radius, POND.radius, 0.04, 32]} />
      </mesh>
      <mesh position={[pondX, 0.025, pondZ]} receiveShadow>
        <cylinderGeometry args={[POND.radius + 0.7, POND.radius + 0.7, 0.03, 32]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
      <PartsBundle bundle={pondParts} />

      {/* Colliders: keep the player out of the water except on the bridge */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[blockerHalfLength, 1, STREAM.width / 2]}
          position={[-gapHalf - blockerHalfLength, 1, STREAM.z]}
        />
        <CuboidCollider
          args={[blockerHalfLength, 1, STREAM.width / 2]}
          position={[gapHalf + blockerHalfLength, 1, STREAM.z]}
        />
        <CylinderCollider args={[1, POND.radius]} position={[pondX, 1, pondZ]} />
        {/* bridge deck (a small step up) and rails */}
        <CuboidCollider
          args={[BRIDGE.width / 2, 0.05, BRIDGE.length / 2]}
          position={[BRIDGE.x, 0.05, BRIDGE.z]}
        />
        <CuboidCollider args={[0.1, 0.6, BRIDGE.length / 2]} position={[BRIDGE.x - 1.85, 0.6, BRIDGE.z]} />
        <CuboidCollider args={[0.1, 0.6, BRIDGE.length / 2]} position={[BRIDGE.x + 1.85, 0.6, BRIDGE.z]} />
      </RigidBody>
    </group>
  )
}
