import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MathUtils, Object3D, Vector3 } from 'three'
import { HOUSE, NEIGHBOUR_HOUSES, WARUNG, distanceToRiver, isOnRoad, px } from '../../../data/kampungLayout'
import { clock } from '../../../state/timeOfDay'
import { nearestThreat, worldRuntime } from '../../../state/worldRuntime'
import { MODELS } from '../../../data/models'
import { GEO } from '../kit'
import { autoRigCat } from './autoRig'
import { between, worldFx } from './worldFx'

/**
 * Kampung animals besides the chickens and ducks (npc/Animals.jsx): cats
 * that doze by the houses, sit up, groom, look at you and wander off (the
 * kucing.glb tabby, CC-BY-4.0 by iRahulRajput on Sketchfab, rigged at load by
 * autoRigCat), and little burung pipit that hop about the grass and take off
 * when you come near. Simple state machines, nothing clever.
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
  // one tabby model, tinted: a ginger one, a dark one and a grey one
  { home: local(HOUSE, 2.4, 6.9), tint: '#ffc58a', start: 'sleep' }, // oren, by Tok Wan's stairs
  { home: local(WARUNG, 3.2, 3.8), tint: '#6e665e', start: 'sit' }, // gelap, waiting at the warung
  { home: local(NEIGHBOUR_HOUSES[3], -1.5, 5.6), tint: '#d6d2cc', start: 'walk' }, // kelabu belang
]

const CAT_TIMES = { sleep: [14, 30], sit: [5, 12], look: [2, 4], walk: [3, 7], groom: [4, 8] }
const NEXT = {
  sleep: ['sit', 'sit', 'groom'],
  sit: ['walk', 'look', 'groom', 'sleep'],
  look: ['sit', 'walk'],
  walk: ['sit', 'look', 'walk', 'sleep'],
  groom: ['sit', 'sleep', 'walk'],
}

// the cat GLB (one static mid-stride tabby; autoRigCat gives it legs, head and
// tail) faces +x and is 1 m nose to tail: turned to face +z and made cat-sized
const CAT_SCALE = 0.75

/** Joint angles (radians, model frame) for each thing a cat does; see autoRigCat. */
const CAT_POSES = {
  stand: { FL: 0, FR: 0, BL: 0, BR: 0, rz: 0, ry: 0, hz: 0, tz: 0.2 },
  // nose up about the hips, hind legs tucked forward, front legs straight down
  sit: { FL: -0.6, FR: -0.6, BL: 1.3, BR: 1.3, rz: 0.55, ry: 0, hz: -0.45, tz: -0.6 },
  // a loaf: low down, legs folded under, chin down, tail wrapped round
  sleep: { FL: -1.4, FR: -1.4, BL: 1.4, BR: 1.4, rz: 0, ry: -0.26, hz: -0.35, tz: -0.3 },
}
const POSE_OF = { walk: 'stand', look: 'stand', sit: 'sit', groom: 'sit', sleep: 'sleep' }

function CatModel({ url, tint, rigRef }) {
  const { scene } = useGLTF(url)
  const rig = useMemo(() => {
    let source = null
    scene.traverse((o) => {
      if (o.isMesh && !source) source = o
    })
    const material = source.material.clone()
    material.color.set(tint)
    return autoRigCat(source.geometry, material)
  }, [scene, tint])
  useEffect(() => {
    rigRef.current = rig
  }, [rig, rigRef])
  return (
    <group rotation={[0, -Math.PI / 2, 0]} scale={CAT_SCALE}>
      <primitive object={rig.mesh} />
    </group>
  )
}

function Cat({ cat, index }) {
  const root = useRef()
  const rig = useRef(null)
  const b = useMemo(
    () => ({
      pos: new Vector3(cat.home[0] + between(-1, 1), 0, cat.home[1] + between(-1, 1)),
      heading: Math.random() * 6,
      state: cat.start,
      timer: between(2, 10),
      target: null,
      step: 0,
      pose: { ...CAT_POSES[POSE_OF[cat.start]] },
    }),
    [cat],
  )

  // where the cats are, for Amru and Sameer
  useEffect(() => {
    const list = worldRuntime.npc.cats
    list.push(b.pos)
    return () => list.splice(list.indexOf(b.pos), 1)
  }, [b])

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
    // someone close (you, or a kid chasing it): a sleeping cat opens an eye
    // and sits up; too close and it moves off
    const threat = nearestThreat(b.pos.x, b.pos.z)
    if (threat.d < 2.2 && (b.state !== 'walk' || !b.fleeing)) {
      b.state = 'walk'
      b.fleeing = true
      let away = Math.atan2(b.pos.x - threat.p.x, b.pos.z - threat.p.z) + between(-0.6, 0.6)
      // cats don't run into the river: veer off along the bank instead
      if (distanceToRiver(b.pos.x + Math.sin(away) * 3.5, b.pos.z + Math.cos(away) * 3.5) < 1) away += Math.PI / 2
      b.target = [b.pos.x + Math.sin(away) * 3.5, b.pos.z + Math.cos(away) * 3.5]
      b.timer = 3
    } else if (threat.d < 6 && b.state === 'sleep') {
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
        b.fleeing = false
        b.state = 'sit'
        b.timer = between(...CAT_TIMES.sit)
      } else {
        speed = b.fleeing ? 2.4 : 0.55
        b.heading += angleTo(b.heading, Math.atan2(dx, dz)) * (1 - Math.exp(-5 * dt))
        b.pos.x += Math.sin(b.heading) * speed * dt
        b.pos.z += Math.cos(b.heading) * speed * dt
        b.step += speed * dt * (b.fleeing ? 9 : 14)
      }
    }
    g.position.set(b.pos.x, 0, b.pos.z)
    g.rotation.y = b.heading

    const r = rig.current
    if (!r) return
    // ease every joint towards the pose for what it's doing
    const want = CAT_POSES[POSE_OF[b.state]]
    const k = 1 - Math.exp(-5 * dt)
    for (const key of Object.keys(want)) b.pose[key] = MathUtils.lerp(b.pose[key], want[key], k)
    const P = b.pose
    const [body, FL, FR, BL, BR, head, tail] = r.bones
    // walking: diagonal pairs swing together (wider when it runs)
    const swing = speed > 0 ? Math.sin(b.step) * (b.fleeing ? 0.6 : 0.4) : 0
    FL.rotation.z = P.FL + swing
    BR.rotation.z = P.BR + swing
    FR.rotation.z = P.FR - swing
    BL.rotation.z = P.BL - swing
    // the body pitches up about the hips (sitting), drops (lying down),
    // breathes when asleep and bobs as it walks
    const breathe = b.state === 'sleep' ? Math.sin(t * 1.6) * 0.008 : 0
    const bob = speed > 0 ? Math.abs(Math.sin(b.step)) * 0.02 : 0
    body.rotation.z = P.rz
    body.position.set(r.hipX - r.hipX * Math.cos(P.rz), -r.hipX * Math.sin(P.rz) + P.ry + breathe + bob, 0)
    // the head turns to look at you, grooms, or glances about
    let hy = 0
    let hz = P.hz
    const sitting = b.state === 'sit' || b.state === 'look' || b.state === 'groom'
    if (b.state === 'look' || (sitting && pd < 8)) hy = MathUtils.clamp(angleTo(b.heading, Math.atan2(p.x - b.pos.x, p.z - b.pos.z)), -1.1, 1.1)
    else if (b.state === 'groom') {
      hy = -0.7
      hz -= 0.5 + Math.sin(t * 6) * 0.12
    } else if (sitting) hy = Math.sin(t * 0.4) * 0.5
    else if (b.state === 'sleep') hy = 0.3
    head.rotation.y = MathUtils.lerp(head.rotation.y, hy, k)
    head.rotation.z = MathUtils.lerp(head.rotation.z, hz, k)
    // the tail: a slow swish, quicker when walking, wrapped round when asleep
    tail.rotation.y = MathUtils.lerp(tail.rotation.y, b.state === 'sleep' ? 1.0 : Math.sin(t * (speed > 0 ? 3 : 1.1)) * 0.45, k)
    tail.rotation.z = P.tz
  })

  return (
    <group ref={root}>
      <Suspense fallback={null}>
        <CatModel url={MODELS.kucing.url} tint={cat.tint} rigRef={rig} />
      </Suspense>
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
