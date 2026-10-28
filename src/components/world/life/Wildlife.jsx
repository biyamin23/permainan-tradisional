import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MathUtils, Object3D, Vector3 } from 'three'
import { HOUSE, NEIGHBOUR_HOUSES, WARUNG, distanceToRiver, isOnRoad, px } from '../../../data/kampungLayout'
import { clock } from '../../../state/timeOfDay'
import { worldRuntime } from '../../../state/worldRuntime'
import { getMaterial } from '../../character/PersonModel'
import { GEO } from '../kit'
import { between, worldFx } from './worldFx'

/**
 * Kampung animals besides the chickens and ducks (npc/Animals.jsx): cats
 * that doze by the houses, sit up, stretch their legs and wander off, and
 * little burung pipit that hop about the grass and take off when you come
 * near. Built from the same primitives as the chickens so they sit in the
 * same world. Simple state machines, nothing clever.
 */

const angleTo = (from, to) => {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

// ---------------------------------------------------------------- cats
const local = (house, lx, lz) => {
  const c = Math.cos(house.rotationY)
  const s = Math.sin(house.rotationY)
  return [house.position[0] + lx * c + lz * s, house.position[2] - lx * s + lz * c]
}

const CATS = [
  { home: local(HOUSE, 2.4, 6.9), coat: ['#e0a050', '#f5efe2'], start: 'sleep' }, // oren, by Tok Wan's stairs
  { home: local(WARUNG, 3.2, 3.8), coat: ['#2a2420', '#f5efe2'], start: 'sit' }, // hitam putih, waiting at the warung
  { home: local(NEIGHBOUR_HOUSES[3], -1.5, 5.6), coat: ['#9a8f84', '#6b625a'], start: 'walk' }, // kelabu belang
]

const CAT_TIMES = { sleep: [14, 30], sit: [5, 12], look: [2, 4], walk: [3, 7], groom: [4, 8] }
const NEXT = {
  sleep: ['sit', 'sit', 'groom'],
  sit: ['walk', 'look', 'groom', 'sleep'],
  look: ['sit', 'walk'],
  walk: ['sit', 'look', 'walk', 'sleep'],
  groom: ['sit', 'sleep', 'walk'],
}

function Cat({ cat, index }) {
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const tail = useRef()
  const legs = useRef([])
  const [fur, belly] = cat.coat
  const b = useMemo(
    () => ({
      pos: new Vector3(cat.home[0] + between(-1, 1), 0, cat.home[1] + between(-1, 1)),
      heading: Math.random() * 6,
      state: cat.start,
      timer: between(2, 10),
      target: null,
      step: 0,
      wake: 0,
    }),
    [cat],
  )

  useFrame((s, delta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = s.clock.elapsedTime + index * 7
    const p = worldRuntime.playerPosition
    const pd = Math.hypot(p.x - b.pos.x, p.z - b.pos.z)
    // far away: nobody is watching, just wait (and don't draw)
    g.visible = pd < 55
    if (pd > 55) return

    b.timer -= dt
    // someone close: a sleeping cat opens an eye and sits up; too close and it moves off
    if (pd < 2.2 && b.state !== 'walk') {
      b.state = 'walk'
      const away = Math.atan2(b.pos.x - p.x, b.pos.z - p.z) + between(-0.6, 0.6)
      b.target = [b.pos.x + Math.sin(away) * 3, b.pos.z + Math.cos(away) * 3]
      b.timer = 3
    } else if (pd < 6 && b.state === 'sleep') {
      b.state = 'look'
      b.timer = between(2, 4)
    }
    if (b.timer <= 0) {
      const options = NEXT[b.state]
      b.state = options[Math.floor(Math.random() * options.length)]
      b.timer = between(...CAT_TIMES[b.state])
      if (b.state === 'walk') {
        // somewhere near home, never into the water
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2
          const r = between(1, 4)
          const x = cat.home[0] + Math.sin(a) * r
          const z = cat.home[1] + Math.cos(a) * r
          if (distanceToRiver(x, z) > 1) {
            b.target = [x, z]
            break
          }
        }
      }
    }

    let speed = 0
    if (b.state === 'walk' && b.target) {
      const dx = b.target[0] - b.pos.x
      const dz = b.target[1] - b.pos.z
      const d = Math.hypot(dx, dz)
      if (d < 0.15) {
        b.state = 'sit'
        b.timer = between(...CAT_TIMES.sit)
      } else {
        speed = pd < 2.2 ? 1.6 : 0.55
        b.heading += angleTo(b.heading, Math.atan2(dx, dz)) * (1 - Math.exp(-5 * dt))
        b.pos.x += Math.sin(b.heading) * speed * dt
        b.pos.z += Math.cos(b.heading) * speed * dt
        b.step += speed * dt * 9
      }
    }
    g.position.set(b.pos.x, 0, b.pos.z)
    g.rotation.y = b.heading

    // pose: body height and tilt, head, tail, legs
    const lying = b.state === 'sleep'
    const sitting = b.state === 'sit' || b.state === 'look' || b.state === 'groom'
    const bodyY = lying ? 0.1 : sitting ? 0.2 : 0.23
    const bodyTilt = sitting ? -0.55 : 0
    body.current.position.y = MathUtils.lerp(body.current.position.y, bodyY, 1 - Math.exp(-6 * dt))
    body.current.rotation.x = MathUtils.lerp(body.current.rotation.x, bodyTilt, 1 - Math.exp(-6 * dt))
    body.current.scale.y = MathUtils.lerp(body.current.scale.y, lying ? 0.75 : 1, 1 - Math.exp(-4 * dt)) + (lying ? Math.sin(t * 1.6) * 0.03 : 0)
    let hx = lying ? 0.5 : 0
    let hy = 0
    if (b.state === 'look' || (sitting && pd < 8)) {
      // turn the head to look at you
      hy = MathUtils.clamp(angleTo(b.heading, Math.atan2(p.x - b.pos.x, p.z - b.pos.z)), -1.2, 1.2)
    } else if (b.state === 'groom') {
      hx = 0.6 + Math.sin(t * 6) * 0.15
      hy = -0.6
    } else if (sitting) hy = Math.sin(t * 0.4) * 0.5
    head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, hx, 1 - Math.exp(-5 * dt))
    head.current.rotation.y = MathUtils.lerp(head.current.rotation.y, hy, 1 - Math.exp(-5 * dt))
    head.current.position.y = MathUtils.lerp(head.current.position.y, lying ? 0.14 : sitting ? 0.45 : 0.33, 1 - Math.exp(-6 * dt))
    head.current.position.z = MathUtils.lerp(head.current.position.z, lying ? 0.22 : sitting ? 0.1 : 0.24, 1 - Math.exp(-6 * dt))
    tail.current.rotation.x = lying ? 1.4 : -0.6 + Math.sin(t * (speed > 0 ? 3 : 1.2)) * 0.15
    tail.current.rotation.z = Math.sin(t * 0.9) * (lying ? 0.1 : 0.5)
    legs.current.forEach((leg, k) => {
      if (!leg) return
      const swing = speed > 0 ? Math.sin(b.step + (k % 2 === (k < 2 ? 0 : 1) ? 0 : Math.PI)) * 0.5 : 0
      leg.rotation.x = lying ? 1.4 : swing
      leg.visible = !lying
    })
  })

  return (
    <group ref={root}>
      <group ref={body} position={[0, 0.22, 0]}>
        <mesh scale={[0.13, 0.12, 0.25]} material={getMaterial(fur)} castShadow>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        <mesh position={[0, -0.05, 0.03]} scale={[0.1, 0.08, 0.2]} material={getMaterial(belly)}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      </group>
      <group ref={head} position={[0, 0.33, 0.24]}>
        <mesh scale={[0.1, 0.09, 0.09]} material={getMaterial(fur)} castShadow>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.055, 0.085, 0]} rotation={[0, 0, -side * 0.25]} scale={[0.035, 0.06, 0.02]} material={getMaterial(fur)}>
            <coneGeometry args={[1, 1, 4]} />
          </mesh>
        ))}
        <mesh position={[0, -0.02, 0.08]} scale={[0.05, 0.035, 0.03]} material={getMaterial(belly)}>
          <sphereGeometry args={[1, 6, 5]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.04, 0.02, 0.083]} scale={0.012} material={getMaterial('#1e1a1a')}>
            <sphereGeometry args={[1, 5, 4]} />
          </mesh>
        ))}
      </group>
      <group ref={tail} position={[0, 0.24, -0.23]}>
        <mesh position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]} scale={[0.025, 0.3, 0.025]} material={getMaterial(fur)}>
          <cylinderGeometry args={[0.7, 1, 1, 5]} />
        </mesh>
      </group>
      {[
        [-0.07, 0.15],
        [0.07, 0.15],
        [-0.07, -0.15],
        [0.07, -0.15],
      ].map(([x, z], k) => (
        <group key={k} ref={(el) => (legs.current[k] = el)} position={[x, 0.16, z]}>
          <mesh position={[0, -0.08, 0]} scale={[0.03, 0.16, 0.03]} material={getMaterial(fur)}>
            <cylinderGeometry args={[1, 1, 1, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- burung pipit
const BIRDS = 7
const LANDINGS = [px(905, 395), px(560, 480), px(1210, 300), px(280, 690), px(990, 590), px(420, 470)].map(([x, z]) => ({ x, z }))
const _o = new Object3D()
const _c = new Color()

function GroundBirds() {
  const bodies = useRef()
  const wings = useRef()
  const flock = useMemo(() => {
    const land = LANDINGS[Math.floor(Math.random() * LANDINGS.length)]
    return {
      land,
      state: 'ground',
      timer: between(20, 40),
      birds: Array.from({ length: BIRDS }, (_, i) => ({
        x: land.x + between(-2, 2),
        y: 0,
        z: land.z + between(-2, 2),
        heading: Math.random() * 6,
        hop: Math.random(),
        peck: 0,
        delay: i * 0.07,
        fx: 0,
        fz: 0,
      })),
    }
  }, [])

  // the scheduler can send the flock somewhere else
  useEffect(() => worldFx.on('birdsMove', () => (flock.timer = 0)), [flock])

  const takeOff = () => {
    const options = LANDINGS.filter((l) => l !== flock.land)
    flock.land = options[Math.floor(Math.random() * options.length)]
    flock.state = 'fly'
    flock.flight = 0
    flock.birds.forEach((b) => {
      b.fx = b.x
      b.fz = b.z
      b.tx = flock.land.x + between(-2.2, 2.2)
      b.tz = flock.land.z + between(-2.2, 2.2)
    })
  }

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = s.clock.elapsedTime
    const body = bodies.current
    const wing = wings.current
    if (!body || !wing) return
    const p = worldRuntime.playerPosition
    flock.timer -= dt
    if (flock.state === 'ground') {
      const near = flock.birds.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 5)
      if (near || flock.timer <= 0) takeOff()
    } else {
      flock.flight += dt
    }
    const roost = clock.daylight < 0.3
    flock.birds.forEach((b, i) => {
      let flap = 0
      if (flock.state === 'ground') {
        // hop, stop, peck
        b.hop -= dt
        if (b.hop <= 0) {
          b.hop = between(0.6, 2.2)
          b.heading += between(-1.2, 1.2)
          b.peck = between(0, 1) < 0.5 ? 0.6 : 0
        }
        if (b.hop > 0.45 && b.hop < 0.62) {
          b.x += Math.sin(b.heading) * dt * 1.4
          b.z += Math.cos(b.heading) * dt * 1.4
          b.y = Math.sin(((b.hop - 0.45) / 0.17) * Math.PI) * 0.06
        } else b.y = 0
        b.peck = Math.max(0, b.peck - dt)
        // keep near the landing spot and off the road
        const dx = flock.land.x - b.x
        const dz = flock.land.z - b.z
        if (Math.hypot(dx, dz) > 3) b.heading = Math.atan2(dx, dz)
        if (isOnRoad(b.x, b.z)) b.heading = Math.atan2(dx, dz)
      } else {
        // an arc up and over to the next spot, each bird a moment behind the last
        const k = MathUtils.clamp((flock.flight - b.delay) / 5, 0, 1)
        const e = k * k * (3 - 2 * k)
        b.x = MathUtils.lerp(b.fx, b.tx, e)
        b.z = MathUtils.lerp(b.fz, b.tz, e)
        b.y = Math.sin(k * Math.PI) * 7 + (k > 0 && k < 1 ? 0.2 : 0)
        b.heading = Math.atan2(b.tx - b.fx, b.tz - b.fz)
        flap = k > 0 && k < 1 ? 1 : 0
        if (flock.birds.every((o) => (flock.flight - o.delay) / 5 >= 1)) {
          flock.state = 'ground'
          flock.timer = between(25, 60)
        }
      }
      const hidden = roost
      _o.position.set(b.x, hidden ? -50 : b.y + 0.07, b.z)
      _o.rotation.set(b.peck > 0.3 ? 0.6 : flap ? -0.1 : -0.25, b.heading, 0)
      _o.scale.set(0.06, 0.055, 0.1)
      _o.updateMatrix()
      body.setMatrixAt(i, _o.matrix)
      for (let side = 0; side < 2; side++) {
        const sgn = side ? 1 : -1
        const beat = flap ? Math.sin(t * 28 + i) * 0.9 : 0
        _o.position.set(b.x, hidden ? -50 : b.y + 0.09, b.z)
        _o.rotation.set(0, b.heading, sgn * (flap ? beat : 0.15))
        _o.translateX(sgn * (flap ? 0.07 : 0.035))
        _o.scale.set(flap ? 0.12 : 0.05, 0.008, flap ? 0.07 : 0.08)
        _o.updateMatrix()
        wing.setMatrixAt(i * 2 + side, _o.matrix)
      }
    })
    body.instanceMatrix.needsUpdate = true
    wing.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh
        ref={(el) => {
          bodies.current = el
          if (el) for (let i = 0; i < BIRDS; i++) el.setColorAt(i, _c.set(i % 3 ? '#8a6a4a' : '#a07850'))
        }}
        args={[GEO.ball, undefined, BIRDS]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={wings} args={[GEO.box, undefined, BIRDS * 2]} frustumCulled={false}>
        <meshStandardMaterial color="#5a4330" roughness={0.9} />
      </instancedMesh>
    </>
  )
}

export function Wildlife() {
  return (
    <>
      {CATS.map((cat, i) => (
        <Cat key={i} cat={cat} index={i} />
      ))}
      <GroundBirds />
    </>
  )
}
