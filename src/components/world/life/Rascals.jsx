import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { MathUtils, Vector3 } from 'three'
import { HOUSE, NEIGHBOUR_HOUSES, SCHOOL, WARUNG, distanceToRiver, groundY } from '../../../data/kampungLayout'
import { MODELS } from '../../../data/models'
import { PLACES } from '../../../data/villagers'
import { useNpcBody } from '../../../state/npcBodies'
import { worldRuntime } from '../../../state/worldRuntime'
import { autoRig } from './autoRig'
import { planWalk } from './navigation'
import { Say } from './Villagers'
import { between } from './worldFx'

/**
 * AMRU and SAMEER: two kampung boys who wander about the whole kampung
 * together and can't see a chicken or a cat without running after it. They
 * never catch one (the animals scatter, life/Wildlife and npc/Animals), so
 * they stop, laugh, catch their breath and wander on.
 *
 * Amru leads: he picks where to go (along the roads, navigation.js) and
 * spots the animals; Sameer trots at his shoulder and joins every chase.
 * Their models (public/models/npc_*.glb) are single static meshes, given a
 * small skeleton by autoRig.js so legs and arms swing as they walk and run.
 */

const KID_HEIGHT = 1.22
const WALK = 1.55
const RUN = 3.5
const CHASE_SEE = 13 // they notice an animal this close
const CHASE_MAX = 8 // seconds before they give up
const LAUGH = ['Hahaha! Laju betul!', 'Alamak, terlepas!', 'Ayam tu pandai lari!', 'Kucing tu dah lari!', 'Penatnya… hahaha!']
const SPOT = ['Tu! Ayam!', 'Jom kejar!', 'Sameer, cepat!', 'Kejar kucing tu!']

// round the buildings (centre, radius): a chase never runs through a house
const BLOCKS = [
  { p: HOUSE.position, r: 6 },
  { p: SCHOOL.position, r: 9 },
  { p: WARUNG.position, r: 5 },
  ...NEIGHBOUR_HOUSES.map((h) => ({ p: h.position, r: 4.8 })),
]
const blocked = (x, z) => distanceToRiver(x, z) < 0.6 || BLOCKS.some((b) => Math.hypot(x - b.p[0], z - b.p[2]) < b.r)

// the whole kampung: every place people go, and the chickens' and cats' haunts
const ROAM = Object.keys(PLACES)

const BOYS = [
  {
    id: 'amru',
    name: 'Amru',
    model: MODELS.amru,
    start: 'taman',
    greet: ['Hoi! Jom ikut kami!', 'Kau nampak ayam tak?', 'Assalamualaikum!'],
  },
  {
    id: 'sameer',
    name: 'Sameer',
    model: MODELS.sameer,
    follow: 'amru',
    start: 'taman',
    greet: ['Hai! Aku Sameer.', 'Amru laju sangat lah!', 'Jom main kejar-kejar!'],
  },
]

const brains = new Map()
if (typeof window !== 'undefined' && window.location.search.includes('debug')) window.__rascals = brains
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

/** The nearest chicken or cat within `range`: its live position. */
function animalNear(x, z, range) {
  let best = null
  let bestD = range
  for (const list of [worldRuntime.npc.chickens, worldRuntime.npc.cats]) {
    for (const a of list) {
      const d = Math.hypot(a.x - x, a.z - z)
      if (d < bestD && !blocked(a.x, a.z)) {
        best = a
        bestD = d
      }
    }
  }
  return best
}

function Boy({ boy, index }) {
  const { scene } = useGLTF(boy.model.url)
  const rig = useMemo(() => {
    let source = null
    scene.traverse((o) => {
      if (o.isMesh && !source) source = o
    })
    return autoRig(source.geometry, source.material)
  }, [scene])
  const scale = KID_HEIGHT / rig.height
  const group = useRef()
  const say = useRef(null)
  useNpcBody(group, { radius: 0.28, halfHeight: 0.4 })

  const b = useMemo(() => {
    const p = PLACES[boy.start]
    return {
      pos: new Vector3(p.x + index * 1.1, 0, p.z + index * 0.6),
      heading: Math.random() * 6,
      mode: 'wait', // wait | walk | chase | laugh
      timer: between(1, 4),
      path: [],
      pi: 0,
      place: boy.start,
      target: null,
      speed: 0,
      gait: Math.random() * 6,
      nextChase: between(6, 14),
      nextLook: 0,
      lastSay: -99,
      greetedAt: -99,
    }
  }, [boy, index])

  useEffect(() => {
    brains.set(boy.id, b)
    // a chasing boy is something animals run from
    const chasers = worldRuntime.npc.chasers
    chasers.push(b.pos)
    return () => {
      brains.delete(boy.id)
      chasers.splice(chasers.indexOf(b.pos), 1)
    }
  }, [boy, b])

  const speak = (lines, now, force = false) => {
    if (!say.current || (!force && now - b.lastSay < 6)) return
    const p = worldRuntime.playerPosition
    if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) > 16) return
    b.lastSay = now
    say.current(lines[Math.floor(Math.random() * lines.length)])
  }

  const goTo = (x, z) => {
    b.path = planWalk(b.pos.x, b.pos.z, x, z)
    b.pi = 0
    b.mode = 'walk'
  }

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const now = state.clock.elapsedTime
    const leader = boy.follow ? brains.get(boy.follow) : null
    let want = 0
    let heading = b.heading
    let run = false

    if (leader) {
      // Sameer: chase what Amru chases, laugh when he laughs, otherwise stay at his shoulder
      if (leader.mode === 'chase' && leader.target) {
        b.mode = 'chase'
        b.target = leader.target
      } else if (leader.mode === 'laugh' && b.mode !== 'laugh') {
        b.mode = 'laugh'
        b.timer = leader.timer + 0.3
        setTimeout(() => speak(LAUGH, state.clock.elapsedTime, true), 600)
      } else if (b.mode !== 'laugh' || b.timer <= 0) b.mode = 'follow'
    }

    b.timer -= dt
    if (b.mode === 'wait') {
      if (b.timer <= 0) {
        b.place = ROAM.filter((k) => k !== b.place)[Math.floor(Math.random() * (ROAM.length - 1))]
        const p = PLACES[b.place]
        goTo(p.x + between(-2, 2), p.z + between(-2, 2))
      }
    } else if (b.mode === 'walk') {
      const [tx, tz] = b.path[b.pi]
      const d = Math.hypot(tx - b.pos.x, tz - b.pos.z)
      if (d < 0.4) {
        b.pi++
        if (b.pi >= b.path.length) {
          b.mode = 'wait'
          b.timer = between(3, 8)
        }
      } else {
        heading = Math.atan2(tx - b.pos.x, tz - b.pos.z)
        want = WALK
      }
    } else if (b.mode === 'chase') {
      const t = b.target
      const d = Math.hypot(t.x - b.pos.x, t.z - b.pos.z)
      heading = Math.atan2(t.x - b.pos.x, t.z - b.pos.z)
      want = d > 0.7 ? RUN * (leader ? 0.95 : 1) : 0
      run = true
      // never into the river or a house; give up after a while, or when it's got away
      const nx = b.pos.x + Math.sin(heading) * 0.8
      const nz = b.pos.z + Math.cos(heading) * 0.8
      if (!leader && (b.timer <= 0 || d > CHASE_SEE + 4 || blocked(nx, nz))) {
        b.mode = 'laugh'
        b.timer = between(2.2, 3.2)
        b.target = null
        b.nextChase = now + between(12, 30)
        speak(LAUGH, now, true)
      } else if (blocked(nx, nz)) want = 0
    } else if (b.mode === 'laugh') {
      if (b.timer <= 0 && !leader) {
        b.mode = 'wait'
        b.timer = between(1, 3)
      }
    } else if (b.mode === 'follow' && leader) {
      // a step to the side and behind
      const side = leader.heading + Math.PI / 2
      const tx = leader.pos.x + Math.sin(side) * 0.9 - Math.sin(leader.heading) * 0.5
      const tz = leader.pos.z + Math.cos(side) * 0.9 - Math.cos(leader.heading) * 0.5
      const d = Math.hypot(tx - b.pos.x, tz - b.pos.z)
      if (d > 0.35) {
        heading = Math.atan2(tx - b.pos.x, tz - b.pos.z)
        want = Math.min(RUN, Math.max(leader.speed, d * 1.4))
        run = want > 2.4
      } else heading = leader.heading
    }

    // Amru spots an animal (not too often): off they go
    if (!leader && (b.mode === 'walk' || b.mode === 'wait') && now > b.nextChase) {
      b.nextChase = now + 1
      const a = animalNear(b.pos.x, b.pos.z, CHASE_SEE)
      if (a) {
        b.mode = 'chase'
        b.target = a
        b.timer = CHASE_MAX
        speak(SPOT, now, true)
      }
    }

    // hello, when you come by
    if (now > b.nextLook) {
      b.nextLook = now + 0.5
      const p = worldRuntime.playerPosition
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 4.5 && now - b.greetedAt > 50 && b.mode !== 'chase') {
        b.greetedAt = now
        speak(boy.greet, now, true)
      }
    }

    // move
    b.speed = MathUtils.lerp(b.speed, want, 1 - Math.exp(-(want > b.speed ? 5 : 8) * dt))
    if (b.speed < 0.03) b.speed = 0
    b.heading += angleTo(b.heading, heading) * (1 - Math.exp(-(run ? 10 : 6) * dt))
    b.pos.x += Math.sin(b.heading) * b.speed * dt
    b.pos.z += Math.cos(b.heading) * b.speed * dt

    // animate: stride from distance covered, arms against legs, a bounce, a lean when running
    const running = MathUtils.clamp((b.speed - 2) / 1.5, 0, 1)
    b.gait += b.speed * dt * (running > 0.5 ? 3.4 : 4.4)
    const moving = MathUtils.clamp(b.speed / 0.6, 0, 1)
    const swing = Math.sin(b.gait) * moving * (0.45 + running * 0.35)
    const [, legL, legR, armL, armR, head] = rig.bones
    const laughing = b.mode === 'laugh'
    legL.rotation.x = swing
    legR.rotation.x = -swing
    if (laughing) {
      // arms up, a little hop: hahaha
      const hop = Math.abs(Math.sin(now * 9))
      armL.rotation.x = MathUtils.lerp(armL.rotation.x, -2.6 + hop * 0.3, 0.3)
      armR.rotation.x = MathUtils.lerp(armR.rotation.x, -2.6 + hop * 0.3, 0.3)
      armL.rotation.z = MathUtils.lerp(armL.rotation.z, 0.35, 0.3)
      armR.rotation.z = MathUtils.lerp(armR.rotation.z, -0.35, 0.3)
    } else {
      armL.rotation.x = MathUtils.lerp(armL.rotation.x, -swing * (1 + running * 0.5) + (1 - moving) * Math.sin(now * 1.3 + index) * 0.04, 0.4)
      armR.rotation.x = MathUtils.lerp(armR.rotation.x, swing * (1 + running * 0.5) + (1 - moving) * Math.sin(now * 1.1 + index) * 0.04, 0.4)
      armL.rotation.z = MathUtils.lerp(armL.rotation.z, 0.06 + running * 0.15, 0.3)
      armR.rotation.z = MathUtils.lerp(armR.rotation.z, -0.06 - running * 0.15, 0.3)
    }
    // the head turns to you when you're near and they're not busy, else looks about
    const p = worldRuntime.playerPosition
    let look = Math.sin(now * 0.4 + index * 2) * 0.35 * (1 - moving)
    if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 6 && b.mode !== 'chase') look = MathUtils.clamp(angleTo(b.heading, Math.atan2(p.x - b.pos.x, p.z - b.pos.z)), -1, 1)
    head.rotation.y = MathUtils.lerp(head.rotation.y, look, 0.1)
    head.rotation.x = laughing ? -0.25 : 0
    const bounce = laughing ? Math.abs(Math.sin(now * 9)) * 0.08 : Math.abs(Math.sin(b.gait)) * moving * (0.03 + running * 0.05)
    g.position.set(b.pos.x, groundY(b.pos.x, b.pos.z) + bounce, b.pos.z)
    g.rotation.set(running * 0.18, b.heading, 0, 'YXZ')
    g.visible = Math.hypot(state.camera.position.x - b.pos.x, state.camera.position.z - b.pos.z) < 75
  })

  return (
    <group ref={group}>
      <primitive object={rig.mesh} scale={scale} />
      <Say api={say} y={KID_HEIGHT + 0.45} />
    </group>
  )
}

class Quiet extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function Rascals() {
  return (
    <Quiet>
      <Suspense fallback={null}>
        {BOYS.map((boy, i) => (
          <Boy key={boy.id} boy={boy} index={i} />
        ))}
      </Suspense>
    </Quiet>
  )
}
