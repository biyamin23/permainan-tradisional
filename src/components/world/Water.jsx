import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Color, Object3D } from 'three'
import { BRIDGES, BRIDGE_RAMP, RIVERS, WATERFALL, bridgeDeckY } from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { GEO, MAT, createRandom, part, pick, randomBetween } from './kit'
import { MODELS } from '../../data/models'
import { ModelSlot } from './ModelSlot'
import { riverMaterial } from './life/riverMaterial'
import { windMaterial } from './life/wind'

/**
 * The rivers from the map: the anak sungai from the waterfall in the hutan
 * kecil, and the main sungai winding round the bottom of the kampung, with a
 * wooden bridge wherever a road crosses. Water is a flat ribbon along each
 * polyline; colliders keep you out of it except on the bridges.
 */

const SAND = '#cfa86e'
const ROCKS = ['#8d877c', '#7a746b', '#a09a8e']
const REEDS = ['#7a9a45', '#8aa64e', '#6c8c3d']

/** Walk along a polyline every `step` metres: { x, z, dirX, dirZ, along }. */
export function samplesAlong(points, step) {
  const out = []
  let along = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const dirX = (bx - ax) / len
    const dirZ = (bz - az) / len
    for (let t = 0; t < len; t += step) {
      out.push({ x: ax + dirX * t, z: az + dirZ * t, dirX, dirZ, along: along + t })
    }
    along += len
  }
  return out
}

const REED_WIND = windMaterial(MAT.kit, 'grass')

const nearBridge = (x, z, extra = 0) => BRIDGES.some((b) => Math.hypot(x - b.x, z - b.z) < b.width / 2 + 0.6 + extra)

// ---------------------------------------------------------------- flowing streaks
const _dummy = new Object3D()
function RiverFlow({ river, count }) {
  const ref = useRef()
  const streaks = useMemo(() => {
    const random = createRandom(river.width * 100)
    const total = samplesAlong(river.points, 1).length
    return Array.from({ length: count }, () => ({
      along: random() * total,
      side: randomBetween(random, -river.width / 2 + 0.6, river.width / 2 - 0.6),
      length: randomBetween(random, 1.2, 3),
      speed: randomBetween(random, 0.9, 1.7),
      total,
    }))
  }, [river, count])
  const samples = useMemo(() => samplesAlong(river.points, 1), [river])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.1)
    streaks.forEach((s, i) => {
      s.along = (s.along + s.speed * dt) % s.total
      const p = samples[Math.floor(s.along)] ?? samples[0]
      _dummy.position.set(p.x - p.dirZ * s.side, 0.075, p.z + p.dirX * s.side)
      _dummy.rotation.set(0, Math.atan2(p.dirX, p.dirZ), 0)
      _dummy.scale.set(0.08, 0.01, s.length)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[GEO.box, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial color="#cfeef0" transparent opacity={0.45} />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------- static parts
function buildRiverParts() {
  const random = createRandom(11)
  // a separate stream for the new bank details, so the rocks and reeds stay where they were
  const extraRandom = createRandom(23)
  const water = []
  const bed = { box: [], cylinder: [] }
  const blob = []
  const blade = []
  for (const river of RIVERS) {
    // the water's instance colour carries how far downstream it is (see riverMaterial)
    const yaws = []
    const starts = [0]
    for (let i = 0; i < river.points.length - 1; i++) {
      const [ax, az] = river.points[i]
      const [bx, bz] = river.points[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const yaw = Math.atan2(bx - ax, bz - az)
      yaws.push(yaw)
      starts.push(starts[i] + len)
      const mid = [(ax + bx) / 2, 0, (az + bz) / 2]
      water.push({ kind: 'box', p: part([mid[0], 0.05, mid[2]], [river.width, 0.04, len], [0, yaw, 0], new Color(starts[i] + len / 2, 0, 0)) })
      bed.box.push(part([mid[0], 0.02, mid[2]], [river.width + 0.5, 0.02, len], [0, yaw, 0], '#2f5e5a'))
      bed.box.push(part([mid[0], 0.012, mid[2]], [river.width + 2.4, 0.012, len], [0, yaw, 0], SAND))
      // darker wet mud just above the waterline
      bed.box.push(part([mid[0], 0.016, mid[2]], [river.width + 1.1, 0.012, len], [0, yaw, 0], '#8a6a45'))
    }
    river.points.forEach(([x, z], i) => {
      // round piece at a bend: turned halfway between the two stretches so the flow carries on
      const a = yaws[Math.max(0, i - 1)]
      const b = yaws[Math.min(yaws.length - 1, i)]
      const yaw = a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) / 2
      water.push({ kind: 'cylinder', p: part([x, 0.05, z], [river.width, 0.04, river.width], [0, yaw, 0], new Color(starts[i], 0, 0)) })
      bed.cylinder.push(part([x, 0.02, z], [river.width + 0.5, 0.02, river.width + 0.5], [0, 0, 0], '#2f5e5a'))
      bed.cylinder.push(part([x, 0.012, z], [river.width + 2.4, 0.012, river.width + 2.4], [0, 0, 0], SAND))
      bed.cylinder.push(part([x, 0.016, z], [river.width + 1.1, 0.012, river.width + 1.1], [0, 0, 0], '#8a6a45'))
    })
    // rocks and reeds along both banks
    for (const s of samplesAlong(river.points, 1.6)) {
      if (nearBridge(s.x, s.z, 1)) continue
      for (const side of [-1, 1]) {
        const off = side * (river.width / 2 + randomBetween(random, -0.3, 0.8))
        const x = s.x - s.dirZ * off
        const z = s.z + s.dirX * off
        if (random() < 0.28) {
          const r = randomBetween(random, 0.35, 0.95)
          blob.push(part([x, r * 0.2, z], [r, r * 0.6, r * 0.9], [random(), random() * 3, 0], pick(random, ROCKS)))
        }
        // now and then: an old post in the shallows, or a fallen branch on the bank
        const extra = extraRandom()
        if (extra < 0.035) {
          const inX = s.x - s.dirZ * (off - side * 0.6)
          const inZ = s.z + s.dirX * (off - side * 0.6)
          bed.cylinder.push(part([inX, 0.35, inZ], [0.16, 0.9, 0.16], [randomBetween(extraRandom, -0.12, 0.12), 0, randomBetween(extraRandom, -0.12, 0.12)], '#5e4029'))
        } else if (extra < 0.06) {
          const yaw = Math.atan2(s.dirX, s.dirZ) + randomBetween(extraRandom, -0.5, 0.5)
          bed.cylinder.push(part([x, 0.07, z], [0.11, randomBetween(extraRandom, 1.2, 2.2), 0.11], [Math.PI / 2, yaw, 0], '#6b4f35', 'YXZ'))
        }
        if (random() < 0.6) {
          const h = randomBetween(random, 0.6, 1.3)
          blade.push(part([x, 0, z], [0.12, h, 0.12], [randomBetween(random, -0.2, 0.2), 0, randomBetween(random, -0.2, 0.2)], pick(random, REEDS)))
        }
      }
    }
  }
  return {
    waterBundle: {
      box: water.filter((w) => w.kind === 'box').map((w) => w.p),
      cylinder: water.filter((w) => w.kind === 'cylinder').map((w) => w.p),
    },
    bankBundle: { box: bed.box, cylinder: bed.cylinder, blob, blade },
  }
}

/** A plank bridge across the river, in its own frame (length along local z). */
function buildBridgeParts(b) {
  const box = []
  const cylinder = []
  const plankColors = ['#9b7048', '#8a6340', '#a87b50']
  const half = b.length / 2
  const rail = b.width / 2 + 0.15
  let i = 0
  for (let z = -half + 0.17; z < half; z += 0.36) {
    box.push(part([0, 0.09, z], [b.width, 0.06, 0.32], [0, (i % 3) * 0.01 - 0.01, 0], plankColors[i % 3]))
    i++
  }
  for (const x of [-b.width / 2 + 0.25, b.width / 2 - 0.25]) box.push(part([x, 0.02, 0], [0.22, 0.16, b.length], [0, 0, 0], '#5e4029'))
  for (const x of [-rail, rail]) {
    for (const z of [-half + 0.15, 0, half - 0.15]) cylinder.push(part([x, 0.57, z], [0.16, 1.3, 0.16], [0, 0, 0], '#6b4a2e'))
    box.push(part([x, 1.07, 0], [0.1, 0.1, b.length], [0, 0, 0], '#8a6340'))
    box.push(part([x, 0.62, 0], [0.07, 0.07, b.length], [0, 0, 0], '#8a6340'))
  }
  for (const z of [-1.4, 1.4]) {
    for (const x of [-b.width / 2 + 0.25, b.width / 2 - 0.25]) cylinder.push(part([x, -0.3, z], [0.2, 0.8, 0.2], [0, 0, 0], '#4f3622'))
  }
  return { box, cylinder }
}

// The GLB bridge is arched, so it is sunk a little and its deck colliders follow
// the arch (bridgeDeckY) with a short ramp at each end.
const GLB_SINK = MODELS.jambatan.sink

function Bridge({ bridge }) {
  const parts = useMemo(() => buildBridgeParts(bridge), [bridge])
  const rail = bridge.width / 2 + 0.2
  const glb = MODELS.jambatan.url
  // the deck as a chain of planks that follow the arch, so feet stay on it
  const deck = useMemo(() => {
    const reach = bridge.length / 2 + BRIDGE_RAMP
    const n = glb ? 12 : 1
    const out = []
    for (let i = 0; i < n; i++) {
      const a0 = -reach + (i / n) * reach * 2
      const a1 = -reach + ((i + 1) / n) * reach * 2
      const y0 = glb ? bridgeDeckY(bridge, a0) : 0.12
      const y1 = glb ? bridgeDeckY(bridge, a1) : 0.12
      const angle = Math.atan2(y1 - y0, a1 - a0)
      const half = Math.hypot(a1 - a0, y1 - y0) / 2 + 0.02
      out.push({ position: [0, (y0 + y1) / 2 - 0.06, (a0 + a1) / 2], rotation: [-angle, 0, 0], half: [bridge.width / 2, 0.06, half] })
    }
    return out
  }, [bridge, glb])

  return (
    <group position={[bridge.x, 0, bridge.z]} rotation={[0, bridge.rotationY, 0]}>
      <ModelSlot
        model={MODELS.jambatan}
        scale={[bridge.width / MODELS.jambatan.size[0], 1, bridge.length / MODELS.jambatan.size[1]]}
        offset={[0, -GLB_SINK, 0]}
        fallback={<PartsBundle bundle={parts} />}
      />
      <RigidBody type="fixed" colliders={false}>
        {deck.map((r, i) => (
          <CuboidCollider key={i} args={r.half} position={r.position} rotation={r.rotation} />
        ))}
        <CuboidCollider args={[0.1, 1.2, bridge.length / 2]} position={[-rail, 0.9, 0]} />
        <CuboidCollider args={[0.1, 1.2, bridge.length / 2]} position={[rail, 0.9, 0]} />
      </RigidBody>
    </group>
  )
}

// ---------------------------------------------------------------- waterfall
function buildWaterfallParts() {
  const random = createRandom(77)
  const blob = []
  const [x, z] = WATERFALL.at
  // a rocky ledge across the top of the anak sungai
  for (let i = 0; i < 26; i++) {
    const a = randomBetween(random, -1.4, 1.4)
    const r = randomBetween(random, 1, 2.4)
    const dist = randomBetween(random, 3.2, 6.5)
    blob.push(part([x + Math.sin(a) * dist, randomBetween(random, 0.6, WATERFALL.height), z - Math.cos(a) * dist], [r * 1.4, r, r * 1.2], [random(), random() * 3, 0], pick(random, ROCKS)))
  }
  for (let i = 0; i < 10; i++) {
    const r = randomBetween(random, 0.5, 1)
    blob.push(part([x + randomBetween(random, -3, 3), r * 0.3, z + randomBetween(random, -1, 2)], [r, r * 0.6, r], [random(), random() * 3, 0], pick(random, ROCKS)))
  }
  return { blob }
}

// the anak sungai leaves the waterfall in this direction
const FALL_YAW = (() => {
  const [[ax, az], [bx, bz]] = RIVERS[0].points
  return Math.atan2(bx - ax, bz - az)
})()

function Waterfall() {
  const parts = useMemo(buildWaterfallParts, [])
  const foam = useRef()
  const [x, z] = WATERFALL.at
  useFrame((state) => {
    if (foam.current) foam.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6) * 0.06)
  })
  const standIn = (
    <>
      <PartsBundle bundle={parts} />
      {/* the fall: a sheet of water coming down the rocks */}
      <mesh position={[x, WATERFALL.height / 2, z - 2.6]} rotation={[-0.25, 0, 0]} material={MAT.water}>
        <boxGeometry args={[WATERFALL.width * 0.7, WATERFALL.height, 0.15]} />
      </mesh>
    </>
  )
  return (
    <group>
      {MODELS.airTerjun.url ? (
        <group position={[x, 0, z - 1.5]} rotation={[0, FALL_YAW, 0]}>
          <ModelSlot model={MODELS.airTerjun} scale={1.35} fallback={null} />
        </group>
      ) : (
        standIn
      )}
      <mesh ref={foam} position={[x, 0.12, z + 0.6]}>
        <cylinderGeometry args={[2.2, 2.4, 0.08, 18]} />
        <meshBasicMaterial color="#eaf6f4" transparent opacity={0.65} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[5, 3, 3]} position={[x, 3, z - 4]} />
      </RigidBody>
    </group>
  )
}

// ---------------------------------------------------------------- colliders
// posts that stand in for the water's walls around a bridge
const POST_GAP = 0.6
const POST_R = 0.36

/** True when (x, z) is under a bridge deck, `margin` metres to either side included. */
function underDeck(x, z, margin) {
  return BRIDGES.some((b) => {
    const dx = x - b.x
    const dz = z - b.z
    const along = dx * Math.sin(b.rotationY) + dz * Math.cos(b.rotationY)
    const across = dx * Math.cos(b.rotationY) - dz * Math.sin(b.rotationY)
    return Math.abs(along) < b.length / 2 + 1 && Math.abs(across) < b.width / 2 + margin
  })
}

/**
 * Short collider blocks along each river. Near a bridge the water is
 * walled with small posts instead, and only the ones under the deck are
 * left out, so the water right beside the bridge (outside its railings) is
 * still water you can't walk on, whatever angle the road crosses at.
 */
function riverColliders() {
  const blocks = []
  for (const river of RIVERS) {
    for (let i = 0; i < river.points.length - 1; i++) {
      const [ax, az] = river.points[i]
      const [bx, bz] = river.points[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const yaw = Math.atan2(bx - ax, bz - az)
      const pieces = Math.max(1, Math.ceil(len / 2))
      const pieceLen = len / pieces
      for (let k = 0; k < pieces; k++) {
        const t = (k + 0.5) / pieces
        const x = ax + (bx - ax) * t
        const z = az + (bz - az) * t
        if (!nearBridge(x, z, pieceLen / 2 + 2)) {
          blocks.push({ position: [x, 1, z], yaw, half: [river.width / 2 - 0.2, 1, pieceLen / 2 + 0.25] })
          continue
        }
        // by a bridge (which may cross at a slant): a grid of small posts
        // over this stretch of water, leaving out only those under the deck
        const dirX = (bx - ax) / len
        const dirZ = (bz - az) / len
        const half = river.width / 2 - 0.2
        for (let a = -pieceLen / 2; a <= pieceLen / 2 + 0.01; a += POST_GAP) {
          for (let c = -half; c <= half + 0.01; c += POST_GAP) {
            const px = x + dirX * a - dirZ * c
            const pz = z + dirZ * a + dirX * c
            if (underDeck(px, pz, POST_R)) continue
            blocks.push({ round: true, position: [px, 1, pz], radius: POST_R })
          }
        }
      }
    }
    // the bends: the stretches' boxes leave a wedge open on the outside of each
    // one, so a round post fills it (small posts round a bridge deck)
    const r = river.width / 2 - 0.2
    for (const [x, z] of river.points) {
      if (!nearBridge(x, z, r + 1)) {
        blocks.push({ round: true, position: [x, 1, z], radius: r })
        continue
      }
      for (let gx = -r; gx <= r; gx += POST_GAP) {
        for (let gz = -r; gz <= r; gz += POST_GAP) {
          if (gx * gx + gz * gz > r * r || underDeck(x + gx, z + gz, POST_R)) continue
          blocks.push({ round: true, position: [x + gx, 1, z + gz], radius: POST_R })
        }
      }
    }
  }
  return blocks
}

export function Water() {
  const { waterBundle, bankBundle } = useMemo(buildRiverParts, [])
  const blocks = useMemo(riverColliders, [])

  return (
    <group>
      <PartsBundle bundle={{ ...bankBundle, blade: [] }} castShadow={false} />
      <PartsBundle bundle={{ blade: bankBundle.blade }} material={REED_WIND} castShadow={false} />
      <PartsBundle bundle={waterBundle} material={riverMaterial()} castShadow={false} />
      {RIVERS.map((river) => (
        <RiverFlow key={river.id} river={river} count={river.width > 5 ? 60 : 24} />
      ))}
      {BRIDGES.map((b, i) => (
        <Bridge key={i} bridge={b} />
      ))}
      <Waterfall />
      <RigidBody type="fixed" colliders={false}>
        {blocks.map((b, i) =>
          b.round ? (
            <CylinderCollider key={i} args={[1, b.radius]} position={b.position} />
          ) : (
            <CuboidCollider key={i} args={b.half} position={b.position} rotation={[0, b.yaw, 0]} />
          ),
        )}
      </RigidBody>
    </group>
  )
}
