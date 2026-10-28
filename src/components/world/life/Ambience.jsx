import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, MeshBasicMaterial, Object3D } from 'three'
import { NEIGHBOUR_HOUSES } from '../../../data/kampungLayout'
import { worldRuntime } from '../../../state/worldRuntime'
import { GEO, part } from '../kit'
import { PartsBundle } from '../InstancedParts'
import { treeLayout } from '../Trees'
import { between } from './worldFx'

/**
 * Small motion that says people live here: a wood fire (tungku) smoking
 * behind a couple of houses, with a periuk on it, and leaves now and then
 * letting go of the trees near you and fluttering down. Pooled and instanced;
 * nothing is created while the game runs.
 */

const _o = new Object3D()
const _c = new Color()

// behind these neighbours' houses (house-local x, z): someone's cooking
const FIRES = [
  { house: 1, at: [2.4, -6.6] },
  { house: 5, at: [-2.2, -6.4] },
  { house: 7, at: [2.6, -6.5] },
]
const PUFFS = 9 // per fire
const emberMaterial = new MeshBasicMaterial({ color: '#ff7a2a' })
const PUFF_LIFE = 6.5

function firePositions() {
  return FIRES.map(({ house, at: [lx, lz] }) => {
    const h = NEIGHBOUR_HOUSES[house]
    const c = Math.cos(h.rotationY)
    const s = Math.sin(h.rotationY)
    return { x: h.position[0] + lx * c + lz * s, z: h.position[2] - lx * s + lz * c, yaw: h.rotationY }
  })
}

/** Three stones, a few logs, a blackened periuk, and the embers under it. */
function buildTungku(fires) {
  const blob = []
  const cylinder = []
  for (const { x, z, yaw } of fires) {
    for (let k = 0; k < 3; k++) {
      const a = yaw + (k / 3) * Math.PI * 2
      blob.push(part([x + Math.sin(a) * 0.32, 0.12, z + Math.cos(a) * 0.32], [0.3, 0.26, 0.28], [k, a, 0], '#7a746b'))
    }
    for (let k = 0; k < 3; k++) {
      const a = yaw + 0.5 + k * 2.1
      cylinder.push(part([x + Math.sin(a) * 0.35, 0.06, z + Math.cos(a) * 0.35], [0.07, 0.75, 0.07], [Math.PI / 2, a, 0], '#5d3f27', 'YXZ'))
    }
    // periuk
    cylinder.push(part([x, 0.38, z], [0.42, 0.3, 0.42], [0, 0, 0], '#2a2420'))
    cylinder.push(part([x, 0.55, z], [0.46, 0.04, 0.46], [0, 0, 0], '#3a3330'))
    // a little pile of firewood beside it
    for (let k = 0; k < 5; k++) {
      cylinder.push(part([x + Math.cos(yaw) * 1.1, 0.07 + (k > 2 ? 0.12 : 0), z - Math.sin(yaw) * 1.1 + (k % 3) * 0.13 - 0.13], [0.11, 0.8, 0.11], [Math.PI / 2, yaw + Math.PI / 2, 0], k % 2 ? '#7a5232' : '#6b4a2e', 'YXZ'))
    }
  }
  return { blob, cylinder }
}

function Fires() {
  const fires = useMemo(firePositions, [])
  const tungku = useMemo(() => buildTungku(fires), [fires])
  const smoke = useRef()
  const puffs = useMemo(
    () => fires.flatMap((f, i) => Array.from({ length: PUFFS }, (_, k) => ({ fire: f, age: (k / PUFFS) * PUFF_LIFE + i, dx: 0, dz: 0, spin: between(0, 6) }))),
    [fires],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const t = state.clock.elapsedTime
    const mesh = smoke.current
    if (mesh) {
      puffs.forEach((p, i) => {
        p.age += dt
        if (p.age >= PUFF_LIFE) {
          p.age -= PUFF_LIFE
          p.dx = between(-0.08, 0.08)
          p.dz = between(-0.08, 0.08)
        }
        const k = p.age / PUFF_LIFE
        // rises, slows, drifts off with the breeze, swells then thins away
        const y = 0.65 + 2.9 * (1 - (1 - k) * (1 - k)) + Math.sin(t * 0.8 + i) * 0.05
        const drift = k * k * 1.6
        const size = (0.22 + k * 0.75) * (k > 0.75 ? 1 - (k - 0.75) * 3.2 : 1)
        _o.position.set(p.fire.x + p.dx * k * 6 + drift, y, p.fire.z + p.dz * k * 6 + drift * 0.4)
        _o.rotation.set(p.spin + k, p.spin * 2 + t * 0.1, 0)
        _o.scale.setScalar(Math.max(0.0001, size))
        _o.updateMatrix()
        mesh.setMatrixAt(i, _o.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    // embers flicker
    emberMaterial.color.setRGB(1, 0.35 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06, 0.08)
  })

  return (
    <>
      <PartsBundle bundle={tungku} />
      <instancedMesh ref={smoke} args={[GEO.blob, undefined, puffs.length]} frustumCulled={false} castShadow={false}>
        <meshStandardMaterial color="#d8d2c8" transparent opacity={0.42} depthWrite={false} flatShading roughness={1} />
      </instancedMesh>
      {fires.map((f, i) => (
        <mesh key={i} position={[f.x, 0.09, f.z]} scale={[0.35, 0.08, 0.35]} geometry={GEO.blob} material={emberMaterial} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------- falling leaves
const LEAVES = 10
const LEAF_COLORS = ['#c98a3a', '#a8a24a', '#8a6a35', '#b5733a', '#6f9a3d']

function FallingLeaves() {
  const ref = useRef()
  const trees = useMemo(() => treeLayout().plants.filter((p) => p.kind === 'tree' && !p.edge), [])
  const pool = useMemo(() => Array.from({ length: LEAVES }, () => ({ state: 'off', x: 0, y: 0, z: 0, t: 0, rest: 0, seed: Math.random() * 10 })), [])
  const timer = useRef(1)

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.1)
    const t = state.clock.elapsedTime
    timer.current -= dt
    if (timer.current <= 0) {
      timer.current = between(0.8, 2.2)
      const p = worldRuntime.playerPosition
      const free = pool.find((l) => l.state === 'off')
      // a tree near you, not one behind the camera a field away
      const near = trees.filter((tr) => Math.abs(tr.x - p.x) < 16 && Math.abs(tr.z - p.z) < 16)
      if (free && near.length) {
        const tr = near[Math.floor(Math.random() * near.length)]
        const a = Math.random() * Math.PI * 2
        const r = between(0.6, 1.8) * tr.size
        Object.assign(free, { state: 'fall', x: tr.x + Math.cos(a) * r, z: tr.z + Math.sin(a) * r, y: between(3.2, 4.4) * tr.size, t: 0, rest: between(3, 6) })
      }
    }
    pool.forEach((l, i) => {
      if (l.state === 'off') {
        _o.position.set(0, -50, 0)
        _o.scale.setScalar(0.0001)
      } else {
        l.t += dt
        let size = 1
        if (l.state === 'fall') {
          // a slow see-saw down, drifting with the breeze
          l.y -= dt * (0.55 + Math.sin(l.t * 3 + l.seed) * 0.25)
          l.x += dt * (0.25 + Math.sin(l.t * 1.7 + l.seed) * 0.5)
          l.z += dt * Math.cos(l.t * 1.3 + l.seed) * 0.35
          if (l.y <= 0.02) {
            l.y = 0.02
            l.state = 'rest'
            l.t = 0
          }
        } else {
          size = l.t > l.rest ? Math.max(0, 1 - (l.t - l.rest)) : 1
          if (size <= 0) l.state = 'off'
        }
        const swing = l.state === 'fall' ? Math.sin(l.t * 3 + l.seed) * 0.8 : 0
        _o.position.set(l.x, l.y, l.z)
        _o.rotation.set(swing, l.seed + l.t * (l.state === 'fall' ? 1.5 : 0), swing * 0.5)
        _o.scale.set(0.11 * size, 0.008, 0.16 * size)
      }
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
        if (el) for (let i = 0; i < LEAVES; i++) el.setColorAt(i, _c.set(LEAF_COLORS[i % LEAF_COLORS.length]))
      }}
      args={[GEO.blob, undefined, LEAVES]}
      frustumCulled={false}
      castShadow={false}
    >
      <meshStandardMaterial roughness={0.9} flatShading side={DoubleSide} />
    </instancedMesh>
  )
}

export function Ambience() {
  return (
    <>
      <Fires />
      <FallingLeaves />
    </>
  )
}
