import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, Object3D, RingGeometry } from 'three'
import { RIVERS, distanceToRiver } from '../../../data/kampungLayout'
import { worldSfx } from '../../../audio/engine'
import { worldRuntime } from '../../../state/worldRuntime'
import { GEO, createRandom } from '../kit'
import { samplesAlong } from '../Water'
import { FLOW_SPEED } from './riverMaterial'
import { between, worldFx } from './worldFx'

/**
 * Small things happening on the sungai: rings spreading where something
 * touched the water (a skimmed stone, a fish, Pak Abu's float), the odd fish
 * jumping, splashes, and leaves floating downstream (when they happen is
 * up to AmbientEvents.jsx). Everything is pooled and
 * drawn as one instanced mesh per kind, so a splash costs nothing to start.
 * The water surface itself is riverMaterial.js.
 */

const WATER_Y = 0.075
const RIPPLES = 14
const DROPS = 18
const LEAVES = 16
const _o = new Object3D()
/** 1 right beside you, 0 from 25 m away. */
const nearness = (x, z) => Math.max(0, 1 - Math.hypot(x - worldRuntime.playerPosition.x, z - worldRuntime.playerPosition.z) / 25)
const _c = new Color()

const ringGeometry = new RingGeometry(0.82, 1, 24).rotateX(-Math.PI / 2)
// additive: a ring brightens the water and fades out simply by going dark
const ringMaterial = new MeshBasicMaterial({ color: '#cfe8e2', transparent: true, opacity: 0.6, depthWrite: false, blending: AdditiveBlending })

function hide(mesh, i) {
  _o.position.set(0, -50, 0)
  _o.scale.setScalar(0.0001)
  _o.updateMatrix()
  mesh.setMatrixAt(i, _o.matrix)
}

/** Rings: each grows and fades out over its life. */
function Ripples() {
  const ref = useRef()
  const pool = useMemo(() => Array.from({ length: RIPPLES }, () => ({ age: 99, life: 1, x: 0, z: 0, size: 1 })), [])
  const next = useRef(0)

  useEffect(
    () =>
      worldFx.on('ripple', (x, z, size = 1) => {
        if (distanceToRiver(x, z) > -0.3) return // only on the water
        const r = pool[next.current]
        next.current = (next.current + 1) % RIPPLES
        Object.assign(r, { age: 0, life: 1.2 + size * 0.8, x, z, size })
      }),
    [pool],
  )

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.1)
    pool.forEach((r, i) => {
      r.age += dt
      if (r.age >= r.life) return hide(mesh, i)
      const k = r.age / r.life
      // drifts downstream a little as it spreads; thins as it goes
      const s = (0.15 + k * 1.4) * r.size
      _o.position.set(r.x, WATER_Y + 0.004, r.z)
      _o.scale.set(s, 1, s)
      _o.rotation.set(0, 0, 0)
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
      mesh.setColorAt(i, _c.setScalar(1 - k * k))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
        if (el) {
          for (let i = 0; i < RIPPLES; i++) {
            hide(el, i)
            el.setColorAt(i, _c.setScalar(0))
          }
        }
      }}
      args={[ringGeometry, ringMaterial, RIPPLES]}
      frustumCulled={false}
      renderOrder={2}
    />
  )
}

/** Splash drops and the occasional jumping fish. */
function Splashes() {
  const drops = useRef()
  const fish = useRef()
  const pool = useMemo(() => Array.from({ length: DROPS }, () => ({ age: 99, x: 0, z: 0, vx: 0, vy: 0, vz: 0, y: 0 })), [])
  const jump = useMemo(() => ({ age: 99, x: 0, z: 0, dx: 0, dz: 0 }), [])
  const next = useRef(0)

  useEffect(() => {
    const splash = (x, z, size = 1) => {
      worldFx.emit('ripple', x, z, 0.8 * size)
      worldSfx.splash(nearness(x, z), size >= 1)
      const n = Math.round(5 + size * 3)
      for (let k = 0; k < n; k++) {
        const d = pool[next.current]
        next.current = (next.current + 1) % DROPS
        const a = Math.random() * Math.PI * 2
        const v = between(0.6, 1.5) * size
        Object.assign(d, { age: 0, x, z, y: WATER_Y, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: between(1.6, 2.8) * Math.sqrt(size) })
      }
    }
    const offSplash = worldFx.on('splash', splash)
    const offFish = worldFx.on('fishJump', (x, z, dirX, dirZ) => {
      Object.assign(jump, { age: 0, x, z, dx: dirX, dz: dirZ })
      worldFx.emit('ripple', x, z, 0.5)
      worldSfx.plop(nearness(x, z))
    })
    return () => {
      offSplash()
      offFish()
    }
  }, [pool, jump])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const mesh = drops.current
    if (mesh) {
      pool.forEach((d, i) => {
        d.age += dt
        if (d.age > 1.2 || d.y < WATER_Y - 0.05) return hide(mesh, i)
        d.vy -= 9.8 * dt
        d.x += d.vx * dt
        d.z += d.vz * dt
        d.y += d.vy * dt
        _o.position.set(d.x, d.y, d.z)
        _o.scale.setScalar(0.05)
        _o.updateMatrix()
        mesh.setMatrixAt(i, _o.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    // the fish: an arc out of the water and back in, 0.7 s
    const f = fish.current
    if (f) {
      jump.age += dt
      const k = jump.age / 0.7
      f.visible = k < 1
      if (f.visible) {
        const reach = 0.9
        f.position.set(jump.x + jump.dx * reach * k, WATER_Y + Math.sin(k * Math.PI) * 0.55, jump.z + jump.dz * reach * k)
        f.rotation.set(-Math.cos(k * Math.PI) * 1.1, Math.atan2(jump.dx, jump.dz), Math.sin(k * 9) * 0.2)
        if (k > 0.92 && !jump.landed) {
          jump.landed = true
          worldFx.emit('splash', f.position.x, f.position.z, 0.5)
        }
      } else jump.landed = false
    }
  })

  return (
    <>
      <instancedMesh
        ref={(el) => {
          drops.current = el
          if (el) for (let i = 0; i < DROPS; i++) hide(el, i)
        }}
        args={[GEO.ball, undefined, DROPS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color="#e6f4f2" transparent opacity={0.85} />
      </instancedMesh>
      <group ref={fish} visible={false}>
        <mesh scale={[0.06, 0.1, 0.24]} castShadow>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#9aa68a" roughness={0.35} flatShading />
        </mesh>
        <mesh position={[0, 0, -0.27]} rotation={[Math.PI / 2, 0, 0]} scale={[0.02, 0.1, 0.09]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#7d8a6e" flatShading />
        </mesh>
      </group>
    </>
  )
}

const LEAF_COLORS = ['#c98a3a', '#8aa64e', '#b5a04a', '#a0522d']

/** Leaves (and the odd twig) drifting downstream, turning slowly as they go. */
function FloatingLeaves() {
  const ref = useRef()
  const rivers = useMemo(() => RIVERS.map((r) => ({ r, samples: samplesAlong(r.points, 1) })), [])
  const leaves = useMemo(() => {
    const random = createRandom(404)
    return Array.from({ length: LEAVES }, (_, i) => {
      const river = rivers[i % 4 === 0 ? 0 : 1]
      return {
        river,
        along: random() * river.samples.length,
        side: between(-river.r.width / 2 + 0.7, river.r.width / 2 - 0.7, random),
        speed: FLOW_SPEED * between(0.75, 1.15, random),
        spin: between(-0.4, 0.4, random),
        yaw: random() * 6,
        size: between(0.7, 1.2, random),
        twig: random() < 0.2,
      }
    })
  }, [rivers])

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.1)
    const t = state.clock.elapsedTime
    leaves.forEach((l, i) => {
      const n = l.river.samples.length
      l.along += l.speed * dt
      // reached the end of the river: start again at a random point upstream
      if (l.along >= n - 1) {
        l.along = Math.random() * n * 0.3
        l.side = between(-l.river.r.width / 2 + 0.7, l.river.r.width / 2 - 0.7)
      }
      const s = l.river.samples[Math.floor(l.along)]
      // a gentle sideways meander
      const side = l.side + Math.sin(t * 0.3 + i) * 0.25
      l.yaw += l.spin * dt
      _o.position.set(s.x - s.dirZ * side, WATER_Y + 0.008 + Math.sin(t * 2 + i) * 0.006, s.z + s.dirX * side)
      _o.rotation.set(0, l.yaw, 0)
      if (l.twig) _o.scale.set(0.04 * l.size, 0.03, 0.5 * l.size)
      else _o.scale.set(0.16 * l.size, 0.012, 0.24 * l.size)
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
        if (el) leaves.forEach((l, i) => el.setColorAt(i, _c.set(l.twig ? '#6b4f35' : LEAF_COLORS[i % LEAF_COLORS.length])))
      }}
      args={[GEO.blob, undefined, LEAVES]}
      frustumCulled={false}
    >
      <meshStandardMaterial roughness={0.9} flatShading side={DoubleSide} />
    </instancedMesh>
  )
}

export function RiverLife() {
  return (
    <>
      <Ripples />
      <Splashes />
      <FloatingLeaves />
    </>
  )
}
