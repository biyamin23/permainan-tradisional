import { useMemo } from 'react'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { BOUNDS, HOUSE, HUTAN, KEBUN_KELAPA, isNearGameSpot, isOnRoad, isReserved } from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { MAT, createRandom, makeAlignedMatrix, mergeBundles, part, pick, randomBetween } from './kit'
import { windMaterial } from './life/wind'
import { MODELS } from '../../data/models'

const LEAF_GREENS = ['#4f8a3a', '#5a9440', '#447d35', '#3d7131', '#6a9c45']
const PALM_GREENS = ['#5f9a3c', '#6aa443', '#58913a', '#7aa84a']
const PALM_OLD = ['#a3a24c', '#b49a4a']
const BANANA_GREENS = ['#7db04a', '#8bbc52', '#73a543']
const BUSH_GREENS = ['#3f7a34', '#477f37', '#365f2c', '#4f8a3a']
const TRUNK = ['#6b4a2e', '#5d3f27', '#76523a']

function buildCoconutTree(x, z, random) {
  const box = []
  const cylinder = []
  const ball = []
  const height = randomBetween(random, 6.5, 9.5)
  const lean = randomBetween(random, 0.08, 0.32)
  const yaw = random() * Math.PI * 2
  const segments = 5
  const segLen = height / segments

  let px = x
  let py = 0
  let pz = z
  let dir = [0, 1, 0]
  for (let i = 0; i < segments; i++) {
    const a = lean * (0.35 + (0.9 * i) / (segments - 1))
    dir = [Math.sin(a) * Math.sin(yaw), Math.cos(a), Math.sin(a) * Math.cos(yaw)]
    const radius = 0.4 - i * 0.035
    const center = [px + (dir[0] * segLen) / 2, py + (dir[1] * segLen) / 2, pz + (dir[2] * segLen) / 2]
    cylinder.push({
      matrix: makeAlignedMatrix(center, dir, [radius, segLen * 1.06, radius]),
      color: i % 2 ? '#8a7154' : '#957b5c',
    })
    px += dir[0] * segLen
    py += dir[1] * segLen
    pz += dir[2] * segLen
  }

  const fronds = 9
  for (let k = 0; k < fronds; k++) {
    const fy = (k / fronds) * Math.PI * 2 + randomBetween(random, -0.2, 0.2)
    const inner = randomBetween(random, 0.05, 0.35)
    const outer = inner + randomBetween(random, 0.55, 0.95)
    const l1 = randomBetween(random, 1.4, 1.8)
    const l2 = randomBetween(random, 1.2, 1.6)
    const d1 = [Math.sin(fy) * Math.cos(inner), -Math.sin(inner), Math.cos(fy) * Math.cos(inner)]
    const d2 = [Math.sin(fy) * Math.cos(outer), -Math.sin(outer), Math.cos(fy) * Math.cos(outer)]
    const color = inner > 0.28 ? pick(random, PALM_OLD) : pick(random, PALM_GREENS)
    box.push(
      part([px + (d1[0] * l1) / 2, py + (d1[1] * l1) / 2, pz + (d1[2] * l1) / 2], [0.55, 0.05, l1], [inner, fy, 0], color, 'YXZ'),
    )
    const ex = px + d1[0] * l1
    const ey = py + d1[1] * l1
    const ez = pz + d1[2] * l1
    box.push(
      part([ex + (d2[0] * l2) / 2, ey + (d2[1] * l2) / 2, ez + (d2[2] * l2) / 2], [0.38, 0.04, l2], [outer, fy, 0], color, 'YXZ'),
    )
  }

  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4
    ball.push(
      part([px + Math.cos(a) * 0.3, py - 0.35, pz + Math.sin(a) * 0.3], [0.34, 0.38, 0.34], [0, 0, 0], k % 2 ? '#5d6a2b' : '#7a5d2c'),
    )
  }

  return { kind: 'coconut', bundle: { box, cylinder, ball }, collider: { position: [x, 1.2, z], radius: 0.38, halfHeight: 1.2 } }
}

function buildLeafyTree(x, z, random, { fruit = false, scale = 1 } = {}) {
  const taperedCylinder = []
  const blob = []
  const ball = []
  const trunkH = randomBetween(random, 2.2, 3.2) * scale
  const trunkR = 0.32 * scale
  taperedCylinder.push(part([x, trunkH / 2, z], [trunkR * 2, trunkH, trunkR * 2], [0, random() * 3, 0], pick(random, TRUNK)))

  const blobs = 3 + Math.floor(random() * 3)
  const centers = []
  for (let i = 0; i < blobs; i++) {
    const s = randomBetween(random, 2.3, 3.4) * scale
    const angle = random() * Math.PI * 2
    const r = i === 0 ? 0 : randomBetween(random, 0.8, 1.4) * scale
    const c = [x + Math.cos(angle) * r, trunkH + randomBetween(random, 0.6, 1.6) * scale, z + Math.sin(angle) * r]
    centers.push([c, s])
    blob.push(part(c, [s, s * 0.85, s], [random() * 3, random() * 3, random() * 3], pick(random, LEAF_GREENS)))
  }

  if (fruit) {
    for (let i = 0; i < 14; i++) {
      const [c, s] = pick(random, centers)
      const theta = random() * Math.PI * 2
      const phi = randomBetween(random, 0.3, 1.9)
      const r = s * 0.44
      ball.push(
        part(
          [c[0] + Math.sin(phi) * Math.cos(theta) * r, c[1] + Math.cos(phi) * r * 0.85, c[2] + Math.sin(phi) * Math.sin(theta) * r],
          [0.17, 0.17, 0.17],
          [0, 0, 0],
          i % 3 ? '#c8262b' : '#e0452a',
        ),
      )
    }
  }

  return {
    kind: 'leafy',
    size: scale,
    fruit,
    bundle: { taperedCylinder, blob, ball },
    collider: { position: [x, 1.2, z], radius: trunkR + 0.05, halfHeight: 1.2 },
  }
}

function buildBananaTree(x, z, random) {
  const box = []
  const cylinder = []
  const h = randomBetween(random, 1.6, 2.1)
  cylinder.push(part([x, h / 2, z], [0.34, h, 0.34], [0, 0, 0], '#7d8a4a'))
  const leaves = 7
  for (let k = 0; k < leaves; k++) {
    const fy = (k / leaves) * Math.PI * 2 + randomBetween(random, -0.25, 0.25)
    const up = -randomBetween(random, 0.75, 1.05)
    const down = randomBetween(random, -0.05, 0.35)
    const l1 = 0.9
    const l2 = randomBetween(random, 1.1, 1.5)
    const d1 = [Math.sin(fy) * Math.cos(up), -Math.sin(up), Math.cos(fy) * Math.cos(up)]
    const d2 = [Math.sin(fy) * Math.cos(down), -Math.sin(down), Math.cos(fy) * Math.cos(down)]
    const color = random() > 0.85 ? '#b0a752' : pick(random, BANANA_GREENS)
    box.push(part([x + (d1[0] * l1) / 2, h + (d1[1] * l1) / 2, z + (d1[2] * l1) / 2], [0.32, 0.04, l1], [up, fy, 0], color, 'YXZ'))
    const ex = x + d1[0] * l1
    const ey = h + d1[1] * l1
    const ez = z + d1[2] * l1
    box.push(part([ex + (d2[0] * l2) / 2, ey + (d2[1] * l2) / 2, ez + (d2[2] * l2) / 2], [0.75, 0.04, l2], [down, fy, 0], color, 'YXZ'))
  }
  return { kind: 'banana', bundle: { box, cylinder }, collider: { position: [x, 0.9, z], radius: 0.25, halfHeight: 0.9 } }
}

function buildBush(x, z, random, flowers = false) {
  const blob = []
  const ball = []
  const n = 2 + Math.floor(random() * 2)
  for (let i = 0; i < n; i++) {
    const s = randomBetween(random, 0.8, 1.5)
    const c = [x + randomBetween(random, -0.5, 0.5), s * 0.35, z + randomBetween(random, -0.5, 0.5)]
    blob.push(part(c, [s, s * 0.8, s], [random() * 3, random() * 3, 0], pick(random, BUSH_GREENS)))
    if (flowers) {
      for (let f = 0; f < 4; f++) {
        const a = random() * Math.PI * 2
        ball.push(part([c[0] + Math.cos(a) * s * 0.42, c[1] + randomBetween(random, 0, 0.3) * s, c[2] + Math.sin(a) * s * 0.42], [0.18, 0.12, 0.18], [0, 0, 0], f % 2 ? '#d8283a' : '#ee4a5a'))
      }
    }
  }
  return { bundle: { blob, ball } }
}

// a few fruit trees and banana clumps around Tok Wan's yard (offsets from the house)
const [hx, , hz] = HOUSE.position
const HAND_TREES = [
  { at: [hx - 7, hz + 6], fruit: true },
  { at: [hx + 7.5, hz - 4], fruit: true },
  { at: [hx - 7.5, hz - 3.5], fruit: false },
]
const HAND_BANANAS = [[hx - 7.8, hz + 1], [hx + 7.8, hz + 2.5], [hx - 3, hz - 5]]
const HAND_FLOWER_BUSHES = [[hx - 3.2, hz + 9], [hx + 3.4, hz + 9], [hx + 6.5, hz + 7]]

const inRect = (x, z, r) => x > r.xMin && x < r.xMax && z > r.zMin && z < r.zMax

/** The coconut palms of the kebun kelapa (deterministic). */
export const KEBUN_PALMS = (() => {
  const random = createRandom(4242)
  const out = []
  for (let x = KEBUN_KELAPA.xMin + 2; x < KEBUN_KELAPA.xMax - 1; x += 5.6) {
    for (let z = KEBUN_KELAPA.zMin + 2; z < KEBUN_KELAPA.zMax - 1; z += 5.6) {
      const jx = x + randomBetween(random, -0.9, 0.9)
      const jz = z + randomBetween(random, -0.9, 0.9)
      if (isNearGameSpot(jx, jz, 1) || isOnRoad(jx, jz, 1.5)) continue
      out.push({ x: jx, z: jz, yaw: random() * Math.PI * 2, scale: randomBetween(random, 0.95, 1.3) })
    }
  }
  return out
})()

let layoutCache = null

/**
 * Every tree and bush in the kampung (deterministic). `plants` lists what was
 * planted where, so the Peta can draw the same trees.
 */
export function treeLayout() {
  if (layoutCache) return layoutCache
  layoutCache = (() => {
    const random = createRandom(2026)
    const pieces = []
    const colliderList = []
    const placed = []
    const plants = []

    const KIND = { coconut: 'palm', leafy: 'tree', banana: 'banana' }
    const add = (result, x, z) => {
      pieces.push(result.bundle)
      if (result.collider) colliderList.push(result.collider)
      placed.push([x, z])
      plants.push({ kind: KIND[result.kind] ?? 'tree', x, z, size: result.size ?? 1, fruit: result.fruit })
    }
    const farEnough = (x, z, d) => placed.every(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 > d * d)

    // Kebun kelapa: rows of coconut palms (an open strip is kept for Tarik Upih).
    // With the GLB palm they are drawn by <CoconutGrove>; here they only get trunks to bump into.
    for (const palm of KEBUN_PALMS) {
      if (MODELS.kelapa.url) {
        colliderList.push({ position: [palm.x, 1, palm.z], radius: 0.35, halfHeight: 1 })
        placed.push([palm.x, palm.z])
        plants.push({ kind: 'palm', x: palm.x, z: palm.z, size: palm.scale })
      } else add(buildCoconutTree(palm.x, palm.z, random), palm.x, palm.z)
    }
    // Hutan kecil: thick trees round the waterfall
    let forest = 0
    let tries = 0
    while (forest < 46 && tries < 3000) {
      tries++
      const x = randomBetween(random, HUTAN.xMin, HUTAN.xMax)
      const z = randomBetween(random, HUTAN.zMin, HUTAN.zMax)
      if (isReserved(x, z, 1) || !farEnough(x, z, 3.4)) continue
      const roll = random()
      add(roll < 0.2 ? buildCoconutTree(x, z, random) : buildLeafyTree(x, z, random, { scale: randomBetween(random, 1.1, 1.5) }), x, z)
      forest++
    }
    HAND_TREES.forEach(({ at: [x, z], fruit, scale }) => add(buildLeafyTree(x, z, random, { fruit, scale }), x, z))
    HAND_BANANAS.forEach(([x, z]) => add(buildBananaTree(x, z, random), x, z))
    HAND_FLOWER_BUSHES.forEach(([x, z]) => {
      pieces.push(buildBush(x, z, random, true).bundle)
      plants.push({ kind: 'bush', x, z, size: 1, fruit: true })
    })

    // Scattered trees inside the playable area
    let attempts = 0
    let trees = 0
    while (trees < 120 && attempts < 8000) {
      attempts++
      const x = randomBetween(random, BOUNDS.xMin + 3, BOUNDS.xMax - 3)
      const z = randomBetween(random, BOUNDS.zMin + 3, BOUNDS.zMax - 3)
      if (isReserved(x, z, 2) || !farEnough(x, z, 4.5) || inRect(x, z, KEBUN_KELAPA)) continue
      const roll = random()
      if (roll < 0.28) add(buildCoconutTree(x, z, random), x, z)
      else if (roll < 0.36) add(buildBananaTree(x, z, random), x, z)
      else add(buildLeafyTree(x, z, random, { fruit: roll > 0.9 }), x, z)
      trees++
    }

    // Bushes (no colliders — you can push through them)
    let bushes = 0
    attempts = 0
    while (bushes < 150 && attempts < 8000) {
      attempts++
      const x = randomBetween(random, BOUNDS.xMin + 2, BOUNDS.xMax - 2)
      const z = randomBetween(random, BOUNDS.zMin + 2, BOUNDS.zMax - 2)
      if (isReserved(x, z, 0.5) || !farEnough(x, z, 2)) continue
      const flowers = random() > 0.9
      pieces.push(buildBush(x, z, random, flowers).bundle)
      plants.push({ kind: 'bush', x, z, size: 1, fruit: flowers })
      bushes++
    }

    // Dense tree line just outside the boundary so the world feels enclosed
    const ring = []
    for (let x = BOUNDS.xMin - 4; x <= BOUNDS.xMax + 4; x += 6) {
      ring.push([x + randomBetween(random, -2, 2), BOUNDS.zMin - randomBetween(random, 3, 8)])
      ring.push([x + randomBetween(random, -2, 2), BOUNDS.zMax + randomBetween(random, 3, 8)])
    }
    for (let z = BOUNDS.zMin; z <= BOUNDS.zMax; z += 6) {
      ring.push([BOUNDS.xMin - randomBetween(random, 3, 8), z + randomBetween(random, -2, 2)])
      ring.push([BOUNDS.xMax + randomBetween(random, 3, 8), z + randomBetween(random, -2, 2)])
    }
    ring.forEach(([x, z]) => {
      const tree = random() < 0.35 ? buildCoconutTree(x, z, random) : buildLeafyTree(x, z, random, { scale: 1.3 })
      pieces.push(tree.bundle)
      plants.push({ kind: tree.kind === 'coconut' ? 'palm' : 'tree', x, z, size: tree.size ?? 1.3, edge: true })
    })

    return { bundle: mergeBundles(...pieces), colliders: colliderList, plants }
  })()
  return layoutCache
}

// crowns and fronds sway (the shader leaves the trunk bases still)
const TREE_WIND = windMaterial(MAT.kit, 'tree')

export function Trees() {
  const { bundle, colliders } = useMemo(() => treeLayout(), [])

  return (
    <RigidBody type="fixed" colliders={false}>
      {colliders.map((c, i) => (
        <CylinderCollider key={i} args={[c.halfHeight, c.radius]} position={c.position} />
      ))}
      <PartsBundle bundle={bundle} material={TREE_WIND} />
    </RigidBody>
  )
}
