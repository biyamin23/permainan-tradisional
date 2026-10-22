import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { DoubleSide } from 'three'
import { HOUSE, ROADS } from '../../data/kampungLayout'
import { MODELS } from '../../data/models'
import { clock } from '../../state/timeOfDay'
import { worldRuntime } from '../../state/worldRuntime'
import { MAT } from './kit'

/**
 * Kampung lights for the evening: wooden lamp posts along the road and
 * pelita lamps at Tok Wan's porch and the Congkak wakaf. Glow materials are
 * driven by the day–night cycle; only three real point lights are used so
 * phones stay fast.
 */
// wooden lamp posts every ~24 m along the main road, on its left-hand edge
const POSTS = (() => {
  const road = ROADS[0]
  const out = []
  let along = 0
  let next = 8
  for (let i = 0; i < road.points.length - 1; i++) {
    const [ax, az] = road.points[i]
    const [bx, bz] = road.points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    const off = road.width / 2 + 0.9
    while (next < along + len) {
      const t = next - along
      out.push([ax + dx * t + dz * off, az + dz * t - dx * off])
      next += 24
    }
    along += len
  }
  return out
})()

const LAMPS = [
  // Tok Wan's porch post
  MODELS.tokwan.url
    ? { position: [HOUSE.position[0] + 3.5, 2.7, HOUSE.position[2] + 4.75], light: true }
    : { position: [HOUSE.position[0] + 2.7, 3.0, HOUSE.position[2] + 6.05], light: true },
]

function LampPost({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 3.8, 6]} />
        <meshStandardMaterial color="#6b4a2e" flatShading />
      </mesh>
      <mesh position={[-0.35, 3.7, 0]}>
        <boxGeometry args={[0.8, 0.06, 0.06]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      <mesh position={[-0.7, 3.55, 0]}>
        <coneGeometry args={[0.2, 0.16, 8, 1, true]} />
        <meshStandardMaterial color="#3a3f3a" side={DoubleSide} />
      </mesh>
      <mesh position={[-0.7, 3.47, 0]} material={MAT.glow}>
        <sphereGeometry args={[0.09, 10, 8]} />
      </mesh>
      {/* pool of light on the road */}
      <mesh position={[-0.7, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.lampHalo}>
        <circleGeometry args={[2.6, 24]} />
      </mesh>
    </group>
  )
}

function Pelita({ position, light }) {
  const flame = useRef()
  const lamp = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const flicker = 0.85 + Math.sin(t * 13 + position[0]) * 0.08 + Math.sin(t * 7.3) * 0.06
    if (flame.current) flame.current.scale.setScalar(0.7 + clock.night * 0.5 * flicker)
    if (lamp.current) lamp.current.intensity = clock.night * 9 * flicker
  })
  return (
    <group position={position}>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.1, 8]} />
        <meshStandardMaterial color="#8a6a3a" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.2, 8, 1, true]} />
        <meshStandardMaterial color="#f5efe2" transparent opacity={0.35} />
      </mesh>
      <mesh ref={flame} position={[0, 0.02, 0]} material={MAT.glow}>
        <sphereGeometry args={[0.04, 8, 6]} />
      </mesh>
      {light && <pointLight ref={lamp} color="#ffb25a" intensity={0} distance={14} decay={1.6} />}
    </group>
  )
}

/** One shared street-lamp light that follows the nearest lamp post to the player. */
function NearestPostLight() {
  const light = useRef()
  useFrame(() => {
    const l = light.current
    if (!l) return
    const p = worldRuntime.playerPosition
    let nearest = POSTS[0]
    for (const post of POSTS) {
      if (Math.abs(post[1] - p.z) < Math.abs(nearest[1] - p.z)) nearest = post
    }
    l.position.set(nearest[0] - 0.7, 3.3, nearest[1])
    l.intensity = clock.night * 7
  })
  return <pointLight ref={light} position={[POSTS[1][0] - 0.7, 3.3, POSTS[1][1]]} color="#ffc070" intensity={0} distance={13} decay={1.6} />
}

export function NightLights() {
  return (
    <group>
      {POSTS.map(([x, z]) => (
        <LampPost key={`${x},${z}`} x={x} z={z} />
      ))}
      {LAMPS.map((lamp) => (
        <Pelita key={lamp.position.join()} position={lamp.position} light={lamp.light} />
      ))}
      <NearestPostLight />
      <RigidBody type="fixed" colliders={false}>
        {POSTS.map(([x, z]) => (
          <CylinderCollider key={`${x},${z}`} args={[1.9, 0.12]} position={[x, 1.9, z]} />
        ))}
      </RigidBody>
    </group>
  )
}
