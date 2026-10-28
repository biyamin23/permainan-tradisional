import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MathUtils, Vector3 } from 'three'
import { groundY } from '../../../data/kampungLayout'
import { MODELS } from '../../../data/models'
import { PLACES, VILLAGERS, activitiesFor } from '../../../data/villagers'
import { useNpcBody } from '../../../state/npcBodies'
import { clock } from '../../../state/timeOfDay'
import { worldRuntime } from '../../../state/worldRuntime'
import { PersonModel } from '../../character/PersonModel'
import { ModelSlot } from '../ModelSlot'
import { kidLook } from '../npc/kidLooks'
import { Broom } from '../spots/SpotProps'
import { planWalk } from './navigation'
import { between, weightedPick, worldFx } from './worldFx'

/**
 * Villagers going about their petang (data/villagers.js). Each one is a small
 * state machine: WALK to a place along the roads, then DO a few things there
 * (sit, talk, sweep, play, skim stones…), then pick somewhere else. Walking is
 * moved every frame (cheap); decisions only happen when an activity ends.
 * Every visit is a little different: the starting activity, the order of
 * places and how long anything takes are random.
 */

const SEAT_Y = 0.45
const SEAT_OFFSETS = [-0.6, 0.6]
const GREET_GAP = 45 // seconds before the same person greets you again
const SAY_GAP = 9 // seconds between anything one person says

// everyone at a place, so newcomers stand beside them, not inside them
const occupancy = new Map()
const positions = new Map() // id → Vector3 (live), for talking partners and followers
const brains = new Map()
// ?debug: let scripts see what everyone is doing
if (typeof window !== 'undefined' && window.location.search.includes('debug')) window.__villagers = brains

function Basket() {
  return (
    <group position={[0, -0.32, 0.06]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.13, 0.2, 9, 1, true]} />
        <meshStandardMaterial color="#b98a4a" side={2} flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 9]} />
        <meshStandardMaterial color="#8a6438" />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <icosahedronGeometry args={[0.11, 0]} />
        <meshStandardMaterial color="#d9473b" flatShading />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.16, 0.012, 4, 12, Math.PI]} />
        <meshStandardMaterial color="#8a6438" />
      </mesh>
    </group>
  )
}

/** A short line over someone's head, shown for a few seconds when they speak. */
function Say({ api, y }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    let timer
    api.current = (line) => {
      clearTimeout(timer)
      setText(line)
      timer = setTimeout(() => setText(null), 3400)
    }
    return () => clearTimeout(timer)
  }, [api])
  return (
    <group position={[0, y, 0]}>
      {text && (
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="bubble bubble--speech">{text}</div>
        </Html>
      )}
    </group>
  )
}

/** Where person `id` stands (or sits) at a place, next to whoever is already there. */
function spotAt(placeId, id) {
  const p = PLACES[placeId]
  let set = occupancy.get(placeId)
  if (!set) occupancy.set(placeId, (set = []))
  if (!set.includes(id)) set.push(id)
  const slot = set.indexOf(id)
  if (p.seat && slot < SEAT_OFFSETS.length) {
    const o = SEAT_OFFSETS[slot]
    // a hand's width back from the front edge, so they sit on it, not off it
    const back = 0.12
    return { x: p.x + Math.cos(p.face) * o - Math.sin(p.face) * back, z: p.z - Math.sin(p.face) * o - Math.cos(p.face) * back, yaw: p.face, seated: true }
  }
  // stand side by side looking the same way (at the river, the gasing…),
  // beside the bench when it's full
  const k = p.seat ? slot - SEAT_OFFSETS.length + 2 : slot
  const lateral = Math.ceil(k / 2) * (k % 2 ? 1 : -1) * (p.seat ? 1.9 : Math.max(1, p.spread * 0.7))
  const back = k ? 0.3 : 0
  return {
    x: p.x + Math.cos(p.face) * lateral - Math.sin(p.face) * back,
    z: p.z - Math.sin(p.face) * lateral - Math.cos(p.face) * back,
    yaw: p.face,
    seated: false,
  }
}

// someone who found the bench full stands beside it instead
const actsAt = (person, placeId, spot) => activitiesFor(person, spot.seated ? PLACES[placeId] : { ...PLACES[placeId], seat: false })

function leave(placeId, id) {
  const set = occupancy.get(placeId)
  if (set) occupancy.set(placeId, set.filter((o) => o !== id))
}

const angleTo = (from, to) => {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function Villager({ person }) {
  const group = useRef()
  const motion = useRef({ speed: 0, dist: 0, run: 0 })
  const action = useRef({ t: -99, kind: null })
  const say = useRef(null)
  const look = useMemo(() => (person.kid ? kidLook(person.kid.seed, person.kid.girl) : person.look), [person])
  const phase = useMemo(() => Math.random() * 3, [])
  const watch = useMemo(() => new Vector3(), [])
  const [pose, setPose] = useState({ name: 'idle', hand: null, watch: false })
  useNpcBody(group, { radius: person.build === 'kid' ? 0.26 : 0.32, halfHeight: person.build === 'kid' ? 0.4 : 0.6 })

  const brain = useMemo(() => {
    const start = spotAt(person.start, person.id)
    const b = {
      pos: new Vector3(start.x + between(-0.5, 0.5), 0, start.z + between(-0.5, 0.5)),
      heading: start.yaw,
      place: person.start,
      spot: start,
      mode: 'do',
      path: [],
      pi: 0,
      acts: [],
      ai: 0,
      timer: between(0.5, 6), // nobody starts in step with anybody else
      speed: 0,
      pose: 'idle',
      blocked: 0,
      lastSay: -99,
      greetedAt: -99,
      nextCheck: 0,
      play: null,
      skip: 0,
    }
    b.acts = actsAt(person, person.start, start)
    b.ai = Math.floor(Math.random() * b.acts.length)
    return b
  }, [person])

  useEffect(() => {
    positions.set(person.id, brain.pos)
    brains.set(person.id, brain)
    return () => {
      positions.delete(person.id)
      brains.delete(person.id)
      leave(brain.place, person.id)
    }
  }, [person, brain])

  const speak = (lines, now) => {
    if (!lines?.length || now - brain.lastSay < SAY_GAP || !say.current) return
    brain.lastSay = now
    say.current(lines[Math.floor(Math.random() * lines.length)])
  }

  const show = (name, hand = null, watching = false) => {
    if (brain.pose === name && pose.hand === hand && pose.watch === watching) return
    brain.pose = name
    setPose({ name, hand, watch: watching })
  }

  // pick the next place and set off
  const goSomewhere = () => {
    const b = brain
    let next
    if (person.follow && brains.get(person.follow)) next = brains.get(person.follow).place
    else next = weightedPick(person.places, Math.random, b.place)
    if (clock.night > 0.5) next = person.start
    leave(b.place, person.id)
    b.place = next
    b.spot = spotAt(next, person.id)
    const approach = b.spot.seated ? { x: b.spot.x + Math.sin(b.spot.yaw) * 0.7, z: b.spot.z + Math.cos(b.spot.yaw) * 0.7 } : b.spot
    b.path = planWalk(b.pos.x, b.pos.z, approach.x, approach.z)
    if (b.spot.seated) b.path.push([b.spot.x, b.spot.z])
    b.pi = 0
    b.mode = 'walk'
    show('idle', null)
  }

  const startActivity = (now) => {
    const b = brain
    const act = b.acts[b.ai % b.acts.length]
    b.timer = between(act.dur[0], act.dur[1])
    const name = act.pose
    if (name === 'play') {
      b.play = { a: Math.random() * 6, dir: Math.random() < 0.5 ? 1 : -1 }
      show('idle')
    } else if (name === 'skip') {
      b.skip = 0
      show('throw')
    } else if (name === 'talk') show('idle', null, true)
    else show(name, act.hand ?? null)
    // arriving somewhere you might say something about it
    if (b.ai === 0 && Math.random() < 0.5) {
      const p = worldRuntime.playerPosition
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 12) speak(PLACES[b.place].say, now)
    }
  }

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const now = state.clock.elapsedTime
    const b = brain
    const m = motion.current
    const player = worldRuntime.playerPosition
    if (!b.started) {
      // begin part-way through whatever they were doing (timers already random)
      b.started = true
      const left = b.timer
      startActivity(now)
      b.timer = Math.min(b.timer, left + 2)
    }
    let wantSpeed = 0
    let wantHeading = b.heading

    if (b.mode === 'walk') {
      const [tx, tz] = b.path[b.pi]
      const dx = tx - b.pos.x
      const dz = tz - b.pos.z
      const d = Math.hypot(dx, dz)
      const last = b.pi === b.path.length - 1
      if (d < (last ? 0.12 : 0.45)) {
        b.pi++
        if (b.pi >= b.path.length) {
          b.mode = 'do'
          b.acts = actsAt(person, b.place, b.spot)
          b.ai = 0
          startActivity(now)
        }
      } else {
        wantHeading = Math.atan2(dx, dz)
        wantSpeed = person.speed * (last ? Math.min(1, d / 0.8 + 0.25) : 1)
        // someone in the way: stop, ask, then carry on (the body nudges them aside)
        const px = player.x - b.pos.x
        const pz = player.z - b.pos.z
        const pd = Math.hypot(px, pz)
        if (pd < 1.3 && (px * dx + pz * dz) / (d * pd || 1) > 0.5) {
          b.blocked += dt
          if (b.blocked < 1.6) wantSpeed = 0
          if (b.blocked > 0.3) speak(['Tumpang lalu!', 'Eh, maaf!'], now)
        } else b.blocked = 0
        // a turn in the road: slow a little rather than spin on the spot
        wantSpeed *= 1 - Math.min(0.6, Math.abs(angleTo(b.heading, wantHeading)) / 2.5)
      }
    } else {
      b.timer -= dt
      const act = b.acts[b.ai % b.acts.length]
      if (act.pose === 'play') {
        // chase round the place: a loose circle that wanders
        const p = PLACES[b.place]
        const leader = person.follow ? positions.get(person.follow) : null
        let tx
        let tz
        if (leader) {
          tx = leader.x
          tz = leader.z
        } else {
          b.play.a += b.play.dir * dt * 0.7
          tx = p.x + Math.sin(b.play.a) * p.spread + Math.sin(b.play.a * 2.3) * 0.6
          tz = p.z + Math.cos(b.play.a) * p.spread
        }
        const dx = tx - b.pos.x
        const dz = tz - b.pos.z
        const d = Math.hypot(dx, dz)
        if (d > (leader ? 1.1 : 0.2)) {
          wantHeading = Math.atan2(dx, dz)
          wantSpeed = Math.min(person.speed * (leader ? 1.15 : 1), d * 3)
        }
      } else if (b.spot && !b.spot.seated) {
        // drift back to your spot (after playing), then face where you should
        const dx = b.spot.x - b.pos.x
        const dz = b.spot.z - b.pos.z
        const d = Math.hypot(dx, dz)
        if (d > 0.3) {
          wantHeading = Math.atan2(dx, dz)
          wantSpeed = Math.min(1.2, d * 2)
        } else wantHeading = b.spot.yaw
      } else if (b.spot?.seated) {
        // slide onto the bench
        b.pos.x = MathUtils.lerp(b.pos.x, b.spot.x, 1 - Math.exp(-6 * dt))
        b.pos.z = MathUtils.lerp(b.pos.z, b.spot.z, 1 - Math.exp(-6 * dt))
        wantHeading = b.spot.yaw
      }

      if (act.pose === 'talk') {
        // turn to whoever else is here, else look about
        const others = (occupancy.get(b.place) ?? []).filter((o) => o !== person.id)
        const other = others.length ? positions.get(others[0]) : null
        if (other) {
          watch.set(other.x, 0.4, other.z)
          if (!b.spot?.seated) wantHeading = Math.atan2(other.x - b.pos.x, other.z - b.pos.z)
          // a gesture now and then while chatting
          if (Math.random() < dt * 0.25) show(brain.pose === 'idle' ? 'wave' : 'idle', null, true)
        } else watch.copy(player)
      }

      if (act.pose === 'skip') {
        // the throw pose releases ~0.8 s into each 3.2 s swing: the stone skims three times
        const swing = (now + phase) % 3.2
        if (swing >= 0.8 && b.skip === 0) {
          b.skip = 1
          const fx = b.pos.x + Math.sin(b.heading) * 4.5
          const fz = b.pos.z + Math.cos(b.heading) * 4.5
          ;[0, 1, 2].forEach((k) =>
            setTimeout(() => worldFx.emit('ripple', fx + Math.sin(b.heading) * k * 1.6, fz + Math.cos(b.heading) * k * 1.6, 0.6 - k * 0.15), 250 + k * 280),
          )
        } else if (swing < 0.8) b.skip = 0
      }

      if (b.timer <= 0) {
        b.ai++
        if (b.ai >= b.acts.length || (person.follow && brains.get(person.follow)?.place !== b.place)) goSomewhere()
        else startActivity(now)
      }
    }

    // say hello when you come close (and wave, if not busy)
    if (now > b.nextCheck) {
      b.nextCheck = now + 0.5
      const pd = Math.hypot(player.x - b.pos.x, player.z - b.pos.z)
      if (pd < 4.5 && now - b.greetedAt > GREET_GAP) {
        b.greetedAt = now
        speak(person.greet, now)
        if (b.mode === 'do' && !b.spot?.seated && (b.pose === 'idle' || b.pose === 'sweep')) {
          const was = { name: b.pose, hand: pose.hand }
          show('wave')
          setTimeout(() => brain.mode === 'do' && show(was.name, was.hand), 1800)
        }
      }
    }

    // move
    b.speed = MathUtils.lerp(b.speed, wantSpeed, 1 - Math.exp(-(wantSpeed > b.speed ? 4 : 7) * dt))
    if (b.speed < 0.02) b.speed = 0
    const turn = angleTo(b.heading, wantHeading)
    b.heading += turn * (1 - Math.exp(-(b.speed > 0.1 ? 7 : 4) * dt))
    if (b.speed > 0) {
      b.pos.x += Math.sin(b.heading) * b.speed * dt
      b.pos.z += Math.cos(b.heading) * b.speed * dt
      m.dist += b.speed * dt
    }
    m.speed = Math.min(1, b.speed / 4.8)
    m.run = MathUtils.clamp((b.speed - 2.8) / 2, 0, 1)
    const ground = groundY(b.pos.x, b.pos.z)
    const seat = b.mode === 'do' && b.spot?.seated ? SEAT_Y : 0
    g.position.set(b.pos.x, MathUtils.lerp(g.position.y, ground + seat, 1 - Math.exp(-10 * dt)), b.pos.z)
    g.rotation.y = b.heading
    // out of sight across the kampung: keep living, stop drawing
    g.visible = Math.hypot(state.camera.position.x - b.pos.x, state.camera.position.z - b.pos.z) < 75
  })

  const sitting = pose.name === 'sit' || pose.name === 'sitThink'
  const hand = pose.hand === 'broom' ? <Broom /> : null
  return (
    <group ref={group}>
      <PersonModel
        build={person.build}
        look={look}
        elder={person.elder}
        pose={pose.name}
        phase={phase}
        motionRef={motion}
        actionRef={action}
        rightHand={hand}
        leftHand={person.carry === 'bakul' && pose.name !== 'sweep' ? <Basket /> : null}
        watch={pose.watch ? watch : worldRuntime.playerPosition}
        detail={false}
      />
      <Say api={say} y={(person.build === 'kid' ? 1.8 : 2.35) - (sitting ? 0.7 : 0)} />
    </group>
  )
}

/** Benches at the sitting places. */
function Benches() {
  const seats = Object.values(PLACES).filter((p) => p.seat)
  return (
    <RigidBody type="fixed" colliders={false}>
      {seats.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.face, 0]}>
          <ModelSlot model={MODELS.bangku} fallback={null} />
          <CuboidCollider args={[1.25, 0.25, 0.2]} position={[0, 0.25, 0]} />
        </group>
      ))}
    </RigidBody>
  )
}

export function Villagers() {
  return (
    <>
      <Benches />
      {VILLAGERS.map((v) => (
        <Villager key={v.id} person={v} />
      ))}
    </>
  )
}
