import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BufferAttribute, Color, PlaneGeometry } from 'three'
import {
  BOUNDS,
  HUTAN,
  LAMAN_GASING,
  OPEN_AREAS,
  PASIR_GULI,
  POND,
  ROADS,
  SAWAH,
  TAMAN,
  distanceToRiver,
} from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { MAT, createRandom, part, randomBetween } from './kit'

const GROUND_SIZE = 380

function createGroundGeometry() {
  const geometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 190, 190)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const grassA = new Color('#6b973d')
  const grassB = new Color('#8bb14f')
  const dry = new Color('#a8a457')
  const sawah = new Color('#9aa04f')
  const far = new Color('#5d7f3a')
  const open = new Color('#a3c766')
  const sand = new Color('#d6b77c')
  const dirt = new Color('#b98a5a')
  const forest = new Color('#4d7432')
  const bank = new Color('#9a9a5a')
  const c = new Color()
  const inRect = (x, z, r, m = 0) => x > r.xMin - m && x < r.xMax + m && z > r.zMin - m && z < r.zMax + m

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const n =
      Math.sin(x * 0.07) * Math.cos(z * 0.06) * 0.5 +
      Math.sin((x + z) * 0.17) * 0.25 +
      Math.cos(x * 0.31 - z * 0.23) * 0.15
    c.lerpColors(grassA, grassB, 0.5 + n * 0.6)
    if (n > 0.45) c.lerp(dry, (n - 0.45) * 1.4)
    if (inRect(x, z, SAWAH, 2)) c.lerp(sawah, 0.75)
    if (OPEN_AREAS.some((a) => inRect(x, z, a, 1))) c.lerp(open, 0.7)
    if (inRect(x, z, TAMAN, 0)) c.lerp(open, 0.3)
    if (inRect(x, z, PASIR_GULI, 1)) c.lerp(sand, 0.85)
    if (inRect(x, z, HUTAN, 4)) c.lerp(forest, 0.6)
    if ((x - LAMAN_GASING.center[0]) ** 2 + (z - LAMAN_GASING.center[1]) ** 2 < (LAMAN_GASING.radius + 1.5) ** 2) c.lerp(dirt, 0.8)
    const bankDistance = distanceToRiver(x, z)
    if (bankDistance < 2.5) c.lerp(bank, 0.6)
    const outside = Math.max(BOUNDS.xMin - x, x - BOUNDS.xMax, BOUNDS.zMin - z, z - BOUNDS.zMax, 0)
    if (outside > 0) c.lerp(far, Math.min(outside / 30, 0.8))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/** Roads drawn along their polylines: a flat box per segment and a disc at each bend. */
function buildRoads() {
  const box = []
  const cylinder = []
  ROADS.forEach((road, ri) => {
    const y = 0.012 + ri * 0.002 // keep crossings from flickering
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i]
      const [bx, bz] = road.points[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const yaw = Math.atan2(bx - ax, bz - az)
      const mid = [(ax + bx) / 2, y, (az + bz) / 2]
      box.push(part(mid, [road.width + 0.9, 0.012, len], [0, yaw, 0], '#a08850'))
      box.push(part([mid[0], y + 0.008, mid[2]], [road.width, 0.014, len], [0, yaw, 0], '#b97b4b'))
      if (road.width >= 3.5) {
        // tyre ruts
        for (const off of [-0.75, 0.75]) {
          box.push(part([mid[0] + Math.cos(yaw) * off, y + 0.016, mid[2] - Math.sin(yaw) * off], [0.35, 0.006, len], [0, yaw, 0], '#a86c40'))
        }
      }
    }
    for (const [x, z] of road.points) {
      cylinder.push(part([x, y, z], [road.width + 0.9, 0.012, road.width + 0.9], [0, 0, 0], '#a08850'))
      cylinder.push(part([x, y + 0.008, z], [road.width, 0.014, road.width], [0, 0, 0], '#b97b4b'))
    }
  })
  return { box, cylinder }
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
      <PartsBundle bundle={bundle} material={MAT.cloud} castShadow={false} receiveShadow={false} />
    </group>
  )
}

export function KampungEnvironment() {
  const groundGeometry = useMemo(createGroundGeometry, [])
  const roads = useMemo(buildRoads, [])
  const hills = useMemo(buildHills, [])

  return (
    <group>
      <mesh geometry={groundGeometry} material={MAT.ground} receiveShadow />
      <PartsBundle bundle={roads} castShadow={false} />
      <PartsBundle bundle={hills} castShadow={false} receiveShadow={false} />
      <Clouds />

      {/* Golden dust in the evening air, fireflies by the river bend */}
      <Sparkles count={90} scale={[140, 8, 90]} position={[0, 4, 0]} size={2.4} speed={0.25} opacity={0.55} color="#ffd59a" />
      <Sparkles
        count={30}
        scale={[12, 2.5, 12]}
        position={[POND.center[0], 1.2, POND.center[1]]}
        size={3.2}
        speed={0.4}
        opacity={0.8}
        color="#fff4a8"
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
