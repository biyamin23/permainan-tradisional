import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky, Sparkles } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BufferAttribute, Color, MeshStandardMaterial, PlaneGeometry } from 'three'
import { BOUNDS, FIELD, POND, ROADS, SAWAH } from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { MAT, createRandom, part, randomBetween } from './kit'
import { SUN_POSITION } from './Lighting'

const GROUND_SIZE = 340

function createGroundGeometry() {
  const geometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 110, 110)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const grassA = new Color('#6b973d')
  const grassB = new Color('#8bb14f')
  const dry = new Color('#a8a457')
  const sawah = new Color('#9aa04f')
  const far = new Color('#5d7f3a')
  const c = new Color()

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const n =
      Math.sin(x * 0.07) * Math.cos(z * 0.06) * 0.5 +
      Math.sin((x + z) * 0.17) * 0.25 +
      Math.cos(x * 0.31 - z * 0.23) * 0.15
    c.lerpColors(grassA, grassB, 0.5 + n * 0.6)
    if (n > 0.45) c.lerp(dry, (n - 0.45) * 1.4)
    if (x > SAWAH.xMin - 3 && x < SAWAH.xMax + 3 && z > SAWAH.zMin - 3 && z < SAWAH.zMax) c.lerp(sawah, 0.75)
    const outside = Math.max(BOUNDS.xMin - x, x - BOUNDS.xMax, BOUNDS.zMin - z, z - BOUNDS.zMax, 0)
    if (outside > 0) c.lerp(far, Math.min(outside / 30, 0.8))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

function buildRoads() {
  const box = []
  ROADS.forEach((r) => {
    box.push(part([r.x, 0.008, r.z], [r.w + 0.9, 0.012, r.d + 0.9], [0, 0, 0], '#a08850'))
    box.push(part([r.x, 0.018, r.z], [r.w, 0.014, r.d], [0, 0, 0], '#b97b4b'))
  })
  // tyre ruts along the main road
  const main = ROADS[0]
  for (const x of [-0.75, 0.75]) {
    box.push(part([main.x + x, 0.026, main.z], [0.35, 0.006, main.d], [0, 0, 0], '#a86c40'))
  }
  // a patch of sand around the pond edge path
  box.push(part([POND.center[0] + 5.5, 0.012, POND.center[1]], [2, 0.01, 4], [0, 0.3, 0], '#c7a46b'))
  return { box }
}

function buildHills() {
  const random = createRandom(101)
  const blob = []
  const colors = ['#6f8256', '#62764c', '#7a8a5c', '#56693f']
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + randomBetween(random, -0.1, 0.1)
    const r = randomBetween(random, 150, 190)
    const w = randomBetween(random, 45, 80)
    const h = randomBetween(random, 18, 42)
    blob.push(part([Math.cos(a) * r, -2, Math.sin(a) * r - 10], [w, h, w * 0.7], [0, a, 0], colors[i % colors.length]))
  }
  return { blob }
}

const cloudMaterial = new MeshStandardMaterial({
  color: '#fff3e2',
  emissive: '#ffb27a',
  emissiveIntensity: 0.35,
  roughness: 1,
  flatShading: true,
  fog: false,
})

function buildClouds() {
  const random = createRandom(303)
  const blob = []
  for (let i = 0; i < 11; i++) {
    const a = random() * Math.PI * 2
    const r = randomBetween(random, 90, 150)
    const cx = Math.cos(a) * r
    const cz = Math.sin(a) * r
    const cy = randomBetween(random, 45, 70)
    const puffs = 4 + Math.floor(random() * 4)
    for (let p = 0; p < puffs; p++) {
      const s = randomBetween(random, 7, 14)
      blob.push(part([cx + randomBetween(random, -12, 12), cy + randomBetween(random, -2, 3), cz + randomBetween(random, -5, 5)], [s * 1.4, s * 0.7, s], [0, random() * 3, 0], '#ffffff'))
    }
  }
  return { blob }
}

function Clouds() {
  const group = useRef()
  const bundle = useMemo(buildClouds, [])
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += Math.min(delta, 0.1) * 0.004
  })
  return (
    <group ref={group}>
      <PartsBundle bundle={bundle} material={cloudMaterial} castShadow={false} receiveShadow={false} />
    </group>
  )
}

export function KampungEnvironment() {
  const groundGeometry = useMemo(createGroundGeometry, [])
  const roads = useMemo(buildRoads, [])
  const hills = useMemo(buildHills, [])

  return (
    <group>
      <Sky
        distance={450000}
        sunPosition={SUN_POSITION}
        turbidity={7}
        rayleigh={2.2}
        mieCoefficient={0.006}
        mieDirectionalG={0.88}
      />

      <mesh geometry={groundGeometry} material={MAT.ground} receiveShadow />
      {/* the padang: a lighter, well-trodden field */}
      <mesh position={[FIELD.center[0], 0.005, FIELD.center[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[FIELD.radius, 40]} />
        <meshStandardMaterial color="#9fc463" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <PartsBundle bundle={roads} castShadow={false} />
      <PartsBundle bundle={hills} castShadow={false} receiveShadow={false} />
      <Clouds />

      {/* Golden dust in the evening air, fireflies by the pond */}
      <Sparkles count={70} scale={[70, 8, 70]} position={[0, 4, -4]} size={2.4} speed={0.25} opacity={0.55} color="#ffd59a" />
      <Sparkles
        count={30}
        scale={[12, 2.5, 12]}
        position={[POND.center[0], 1.2, POND.center[1]]}
        size={3.2}
        speed={0.4}
        opacity={0.8}
        color="#fff4a8"
      />
      <Sparkles
        count={24}
        scale={[22, 3, 22]}
        position={[FIELD.center[0], 1.5, FIELD.center[1]]}
        size={2.6}
        speed={0.3}
        opacity={0.6}
        color="#ffe2a1"
      />

      {/* Ground and world boundaries */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[GROUND_SIZE / 2, 1, GROUND_SIZE / 2]} position={[0, -1, 0]} />
        <CuboidCollider args={[1, 6, (BOUNDS.zMax - BOUNDS.zMin) / 2 + 2]} position={[BOUNDS.xMin - 1, 5, (BOUNDS.zMax + BOUNDS.zMin) / 2]} />
        <CuboidCollider args={[1, 6, (BOUNDS.zMax - BOUNDS.zMin) / 2 + 2]} position={[BOUNDS.xMax + 1, 5, (BOUNDS.zMax + BOUNDS.zMin) / 2]} />
        <CuboidCollider args={[(BOUNDS.xMax - BOUNDS.xMin) / 2 + 2, 6, 1]} position={[(BOUNDS.xMax + BOUNDS.xMin) / 2, 5, BOUNDS.zMin - 1]} />
        <CuboidCollider args={[(BOUNDS.xMax - BOUNDS.xMin) / 2 + 2, 6, 1]} position={[(BOUNDS.xMax + BOUNDS.xMin) / 2, 5, BOUNDS.zMax + 1]} />
      </RigidBody>
    </group>
  )
}
