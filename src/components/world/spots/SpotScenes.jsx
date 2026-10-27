import { useCallback, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import { useNpcBody } from '../../../state/npcBodies'
import { worldRuntime } from '../../../state/worldRuntime'
import { PersonModel } from '../../character/PersonModel'
import { kidLook } from '../npc/kidLooks'
import { ProximityBubble } from '../npc/ProximityBubble'
import { Bicycle } from '../npc/Npcs'
import { part } from '../kit'
import { HOUSE, ROADS, groundY, pathOf } from '../../../data/kampungLayout'
import { MODELS } from '../../../data/models'
import { ModelSlot } from '../ModelSlot'
import { PartsBundle } from '../InstancedParts'
import { KedaiKopi } from './KedaiKopi'
import { PAK_TEAM } from '../../../games/sepak-raga/cast'
import { RagaBall } from '../../../games/sepak-raga/RagaBall'
import { RUKIAH } from '../../../games/teng-teng/cast'
import { KAMARUL } from '../../../games/lumba-basikal/cast'
import {
  DirtPatch,
  DirtRect,
  FlyingWau,
  GroundLine,
  KondaStick,
  MengkuangMat,
  RestingGasing,
  SpinningGasing,
  WauKite,
  buildCongkakOnMat,
} from './SpotProps'

/**
 * One little scene per traditional game: props plus kampung kids playing.
 * Each scene works in its spot's local coordinates (see GameSpots.jsx),
 * except Congkak, whose wakaf has physics and is placed in world space.
 */

const faceTowards = (dx, dz) => Math.atan2(dx, dz)

/** A kid NPC with a physical body. Looks are deterministic per seed. */
function Kid({ seed, girl = false, look: lookOverride, pose = 'idle', position = [0, 0, 0], rotationY = 0, groupRef, ...rest }) {
  const look = useMemo(() => lookOverride ?? kidLook(seed, girl), [seed, girl, lookOverride])
  const body = useRef(null)
  const setRef = useCallback(
    (el) => {
      body.current = el
      if (groupRef) groupRef.current = el
    },
    [groupRef],
  )
  useNpcBody(body, { radius: 0.28, halfHeight: 0.42 })
  return (
    <group ref={setRef} position={position} rotation={[0, rotationY, 0]}>
      <PersonModel build="kid" look={look} pose={pose} detail={false} watch={worldRuntime.playerPosition} {...rest} />
    </group>
  )
}

/** Rukiah hopping the court; re-renders only when she changes between one foot and two. */
function TengHopper({ motion, pose, hopper }) {
  const [current, setCurrent] = useState('stand1')
  useFrame(() => {
    if (pose.current !== current) setCurrent(pose.current)
  })
  return <Kid look={RUKIAH.look} pose={current} groupRef={hopper} motionRef={motion} phase={0} />
}

/** Speech bubble above a kid's head. */
function KidBubble({ game, position, maxDistance }) {
  return (
    <ProximityBubble
      lines={game.lines}
      position={position}
      maxDistance={maxDistance ?? game.spot.radius + 5}
      interval={3800}
    />
  )
}

// ------------------------------------------------------------------ Congkak
// On the serambi of Tok Wan's house: Aisyah and a friend at the board.
const CONGKAK_EXTRAS = buildCongkakOnMat()
// the congkak props were built for a wakaf floor (top at 0.625 m); lift them onto the serambi
const SERAMBI_Y = MODELS.tokwan.url ? MODELS.tokwan.serambi.y : 1.275
const PORCH_LIFT = SERAMBI_Y - 0.625
const MAT_AT = MODELS.tokwan.url ? { x: -1.7, z: 3.1 } : { x: -1.45, z: 4.75 }

export function CongkakScene({ game }) {
  return (
    <group position={HOUSE.position} rotation={[0, HOUSE.rotationY, 0]}>
      <group position={[MAT_AT.x, PORCH_LIFT, MAT_AT.z - 0.1]}>
        <PartsBundle bundle={CONGKAK_EXTRAS} />
      </group>
      {/* Aisyah, who challenges you to a game */}
      <Kid seed={1} girl pose="toss" position={[MAT_AT.x, SERAMBI_Y, MAT_AT.z - 0.72]} />
      <Kid seed={2} girl pose="sit" position={[MAT_AT.x, SERAMBI_Y, MAT_AT.z + 0.92]} rotationY={Math.PI} phase={0.8} />
      <KidBubble game={game} position={[MAT_AT.x, 2.75, MAT_AT.z - 0.72]} maxDistance={game.spot.radius + 9} />
    </group>
  )
}

// ------------------------------------------------------------------ Gasing
export function GasingScene({ game }) {
  return (
    <group>
      <DirtPatch radius={2.7} />
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.7, 0.05, 6, 40]} />
        <meshStandardMaterial color="#c9a35a" />
      </mesh>
      <SpinningGasing position={[0.4, 0.02, 0.3]} />
      <SpinningGasing position={[-0.7, 0.02, -0.4]} color="#2f7f8a" speed={18} wobble={0.08} />
      <Kid seed={3} pose="throw" position={[0, 0, -2.0]} />
      <Kid seed={4} pose="clap" position={[2.0, 0, 1.0]} rotationY={faceTowards(-2, -1)} phase={1.3} />
      {/* log bench with spare tops */}
      <mesh position={[-2.4, 0.2, 1.6]} rotation={[0, 0.5, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 1.6, 8]} />
        <meshStandardMaterial color="#7a5232" flatShading />
      </mesh>
      <RestingGasing position={[-2.5, 0.48, 1.5]} />
      <RestingGasing position={[-2.1, 0.48, 1.9]} color="#d9473b" rotation={[0.4, 1.2, 1.3]} />
      <KidBubble game={game} position={[0, 1.9, -2.0]} />
    </group>
  )
}

// ------------------------------------------------------------------ Sepak raga

// Geng Pak-pak in the 6 m circle (with the 2 m circle inside), passing the
// raga across the middle as the rules say: player i to i+2.
const RAGA_R = 3
const RAGA_SPOTS = PAK_TEAM.map((_, i) => {
  const a = (i / 5) * Math.PI * 2
  return { x: -Math.sin(a) * RAGA_R, z: Math.cos(a) * RAGA_R }
})
const RAGA_STEP = 1.15 // seconds per touch

function PakPlayer({ pak, at, actionRef, phase }) {
  const body = useRef(null)
  useNpcBody(body, { radius: 0.32, halfHeight: 0.6 })
  return (
    <group ref={body} position={[at.x, 0, at.z]} rotation={[0, Math.atan2(-at.x, -at.z), 0]}>
      <PersonModel build="adult" look={pak.look} pose="raga" actionRef={actionRef} phase={phase} detail={false} />
    </group>
  )
}

export function SepakRagaScene({ game }) {
  const ball = useRef()
  const actions = useRef(PAK_TEAM.map(() => ({ current: { t: -10, kind: 'sila' } })))
  const plan = useRef({ step: -1, from: 0, to: 0, pop: false })

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const step = Math.floor(t / RAGA_STEP)
    const p = (t % RAGA_STEP) / RAGA_STEP
    const k = plan.current
    if (step !== k.step) {
      // each step: the holder either keeps it up (timang) or passes across
      k.step = step
      k.from = k.to
      k.pop = step % 3 === 1
      k.to = k.pop ? k.from : (k.from + 2 + (step % 2)) % 5
      const act = actions.current[k.from].current
      act.t = t
      act.kind = ['sila', 'kuda', 'lutut', 'kepala'][step % 4]
    }
    const a = RAGA_SPOTS[k.from]
    const b = RAGA_SPOTS[k.to]
    if (ball.current) {
      ball.current.position.set(
        MathUtils.lerp(a.x * 0.84, b.x * 0.84, p),
        0.55 + Math.sin(p * Math.PI) * (k.pop ? 1.3 : 2.6),
        MathUtils.lerp(a.z * 0.84, b.z * 0.84, p),
      )
      ball.current.rotation.x = t * 6
      ball.current.rotation.y = t * 4
    }
  })

  return (
    <group>
      <DirtPatch radius={RAGA_R + 1.1} color="#cfa86e" />
      {[RAGA_R, 1].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
          <ringGeometry args={[r - 0.05, r + 0.05, 56]} />
          <meshBasicMaterial color="#f6f1e2" polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
      {PAK_TEAM.map((pak, i) => (
        <PakPlayer key={pak.id} pak={pak} at={RAGA_SPOTS[i]} actionRef={actions.current[i]} phase={i * 0.7} />
      ))}
      <group ref={ball}>
        <RagaBall radius={0.1} old />
      </group>
      {/* a bench for whoever's resting, and a lamp for playing on after Maghrib */}
      <RigidBody type="fixed" colliders={false} position={[0, 0, RAGA_R + 2.3]}>
        <CuboidCollider args={[1.25, 0.25, 0.19]} position={[0, 0.25, 0]} />
        <ModelSlot model={MODELS.bangku} fallback={null} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[RAGA_R + 2.6, 0, -1.5]}>
        <CylinderCollider args={[1.5, 0.15]} position={[0, 1.5, 0]} />
      </RigidBody>
      <group position={[RAGA_R + 2.6, 0, -1.5]} rotation={[0, Math.atan2(RAGA_R + 2.6, -1.5), 0]}>
        <ModelSlot model={MODELS.lampuPadang} fallback={null} />
      </group>
      <KidBubble game={game} position={[RAGA_SPOTS[0].x, 2.5, RAGA_SPOTS[0].z]} />
    </group>
  )
}

// ------------------------------------------------------------------ Wau
// where the flyer's raised right hand ends up (kid faces the wau)
const WAU_HAND = [0.35, 1.32, -0.19]
const WAU_POSITION = [3, 9.5, -9]

export function WauScene({ game }) {
  return (
    <group>
      <Kid seed={20} pose="holdUp" position={[0, 0, 0]} rotationY={faceTowards(3, -9)} />
      <Kid seed={21} girl pose="cheer" position={[1.4, 0, 1.1]} rotationY={faceTowards(1.6, -10)} phase={0.5} />
      <FlyingWau anchor={WAU_HAND} position={WAU_POSITION} />
      {/* a spare wau leaning on a stand */}
      <group position={[-2.2, 0.9, 0.8]} rotation={[-0.35, 0.6, 0]}>
        <WauKite scale={0.55} colors={['#2f6fd1', '#f5efe2', '#c9342c']} />
      </group>
      <mesh position={[-2.2, 0.45, 0.55]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1, 5]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      <KidBubble game={game} position={[0, 1.9, 0]} />
    </group>
  )
}

// ------------------------------------------------------------------ Batu seremban
const TOSS_PERIOD = 1.6

export function BatuSerembanScene({ game }) {
  const stone = useRef()
  useFrame((state) => {
    if (!stone.current) return
    const p = (state.clock.elapsedTime % TOSS_PERIOD) / TOSS_PERIOD
    stone.current.position.y = 0.42 + Math.sin(p * Math.PI) * 0.75
    stone.current.rotation.x = state.clock.elapsedTime * 5
  })
  const stones = [
    [0.1, 0.06, 0.05],
    [-0.15, 0.06, 0.18],
    [0.25, 0.06, -0.1],
    [-0.05, 0.06, -0.2],
  ]
  return (
    <group>
      <MengkuangMat size={2.3} />
      <Kid seed={30} girl pose="toss" position={[0, 0.05, -0.85]} />
      <Kid seed={31} girl pose="sit" position={[0, 0.05, 0.9]} rotationY={Math.PI} phase={1.1} />
      {stones.map((s, i) => (
        <mesh key={i} position={s} castShadow>
          <icosahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial color={['#d9473b', '#f2c14e', '#3f8a7a', '#9b6ad0'][i]} flatShading />
        </mesh>
      ))}
      <mesh ref={stone} position={[-0.27, 0.42, -0.42]}>
        <icosahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#f08a3a" flatShading />
      </mesh>
      <KidBubble game={game} position={[0, 1.45, -0.85]} />
    </group>
  )
}

// ------------------------------------------------------------------ Guli
const MARBLE_COLORS = ['#2f8fd8', '#e0453a', '#3cb371', '#f2c14e', '#9b59d0', '#20b2aa']
const MARBLES = MARBLE_COLORS.map((color, i) => {
  const a = i * 1.7
  const r = i < 4 ? 0.25 + (i % 3) * 0.18 : 1.4 + i * 0.1
  return { color, position: [Math.cos(a) * r, 0.07, Math.sin(a) * r] }
})
const FLICK_PERIOD = 3.4

export function GuliScene({ game }) {
  const rolling = useRef()
  const action = useRef({ t: -10 })
  const lastCycle = useRef(-1)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const cycle = Math.floor(t / FLICK_PERIOD)
    const p = (t % FLICK_PERIOD) / 0.9
    if (cycle !== lastCycle.current) {
      lastCycle.current = cycle
      action.current.t = t
    }
    if (rolling.current) {
      const e = 1 - (1 - Math.min(p, 1)) ** 3
      rolling.current.position.set(MathUtils.lerp(-0.1, 0.15, e), 0.07, MathUtils.lerp(-1.25, 0.05, e))
    }
  })
  return (
    <group>
      <DirtPatch radius={2.3} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 32]} />
        <meshBasicMaterial color="#7d5432" polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {MARBLES.map((m) => (
        <mesh key={m.color} position={m.position} castShadow>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={m.color} roughness={0.1} metalness={0.2} />
        </mesh>
      ))}
      <mesh ref={rolling} position={[-0.1, 0.07, -1.25]}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color="#ff8c42" roughness={0.1} metalness={0.2} />
      </mesh>
      <Kid seed={40} pose="crouch" position={[0, 0, -1.8]} actionRef={action} />
      <Kid seed={41} pose="crouch" position={[1.7, 0, 0.9]} rotationY={faceTowards(-1.7, -0.9)} phase={0.7} />
      <KidBubble game={game} position={[0, 1.4, -1.8]} />
    </group>
  )
}

// ------------------------------------------------------------------ Galah panjang
const GRID = { halfW: 3, halfD: 4.5, lines: [-4.5, -1.5, 1.5, 4.5] }

export function GalahPanjangScene({ game }) {
  const runners = [useRef(), useRef()]
  const guards = [useRef(), useRef()]
  const runnerMotion = [useRef({ speed: 0 }), useRef({ speed: 0 })]
  const guardMotion = [useRef({ speed: 0 }), useRef({ speed: 0 })]
  const guardX = useRef([0, 0])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const runnerPos = [0, 1].map((k) => {
      const z = 4.2 * Math.sin(t * 0.32 + k * 2.4)
      const x = 2.1 * Math.sin(t * 0.85 + k * 1.9)
      return { x, z, vx: 2.1 * 0.85 * Math.cos(t * 0.85 + k * 1.9), vz: 4.2 * 0.32 * Math.cos(t * 0.32 + k * 2.4) }
    })
    runnerPos.forEach((r, k) => {
      const g = runners[k].current
      if (!g) return
      g.position.set(r.x, 0, r.z)
      g.rotation.y = faceTowards(r.vx, r.vz)
      runnerMotion[k].current.speed = Math.min(Math.hypot(r.vx, r.vz) / 4, 1)
    })
    ;[-1.5, 1.5].forEach((lineZ, j) => {
      const target = runnerPos.reduce((a, b) => (Math.abs(a.z - lineZ) < Math.abs(b.z - lineZ) ? a : b))
      const goal = MathUtils.clamp(target.x, -GRID.halfW + 0.3, GRID.halfW - 0.3)
      const current = guardX.current[j]
      const step = MathUtils.clamp(goal - current, -2.6 * dt, 2.6 * dt)
      guardX.current[j] = current + step
      const g = guards[j].current
      if (g) {
        g.position.set(guardX.current[j], 0, lineZ)
        g.rotation.y = faceTowards(target.x - guardX.current[j], target.z - lineZ)
      }
      guardMotion[j].current.speed = Math.min(Math.abs(step / dt) / 4, 1)
    })
  })

  return (
    <group>
      <DirtRect width={GRID.halfW * 2 + 1} depth={GRID.halfD * 2 + 1} />
      {GRID.lines.map((z) => (
        <GroundLine key={z} from={[-GRID.halfW, z]} to={[GRID.halfW, z]} />
      ))}
      <GroundLine from={[0, -GRID.halfD]} to={[0, GRID.halfD]} />
      <GroundLine from={[-GRID.halfW, -GRID.halfD]} to={[-GRID.halfW, GRID.halfD]} />
      <GroundLine from={[GRID.halfW, -GRID.halfD]} to={[GRID.halfW, GRID.halfD]} />
      <Kid seed={50} groupRef={runners[0]} motionRef={runnerMotion[0]} />
      <Kid seed={51} girl groupRef={runners[1]} motionRef={runnerMotion[1]} />
      <Kid seed={52} pose="guard" groupRef={guards[0]} motionRef={guardMotion[0]} />
      <Kid seed={53} pose="guard" groupRef={guards[1]} motionRef={guardMotion[1]} />
      <KidBubble game={game} position={[0, 2.2, 0]} maxDistance={game.spot.radius + 6} />
    </group>
  )
}

// ------------------------------------------------------------------ Konda kondi
const SWING_PERIOD = 2.6

export function KondaKondiScene({ game }) {
  const anak = useRef()
  useFrame((state) => {
    const g = anak.current
    if (!g) return
    const p = state.clock.elapsedTime % SWING_PERIOD
    if (p > 1.35 && p < 2.45) {
      const f = (p - 1.35) / 1.1
      g.position.set(MathUtils.lerp(0, 0.4, f), 0.08 + Math.sin(f * Math.PI) * 2.4, MathUtils.lerp(0, 6.6, f))
      g.rotation.set(f * 12, f * 4, 0)
    } else {
      g.position.set(0, 0.08, 0)
      g.rotation.set(0, Math.PI / 2, Math.PI / 2)
    }
  })
  return (
    <group>
      <DirtRect width={2.4} depth={9.5} position={[0, 0, 3.6]} />
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 14]} />
        <meshBasicMaterial color="#3a2414" polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.36, 14]} />
        <meshStandardMaterial color="#8f6038" polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <mesh ref={anak} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 6]} />
        <meshStandardMaterial color="#a8763f" />
      </mesh>
      <Kid seed={60} pose="swing" position={[0, 0, -0.75]} rightHand={<KondaStick />} />
      <Kid seed={61} pose="cheer" position={[0.5, 0, 7.4]} rotationY={Math.PI} phase={0.4} />
      <KidBubble game={game} position={[0, 1.9, -0.75]} />
    </group>
  )
}

// ------------------------------------------------------------------ Teng-teng
// same court as the game: 1, 2, 3 single; 4|5; 6; 7|8; 9 kepala
const TENG_ROWS = [1, 1, 1, 2, 1, 2, 1]
const ROW_GAP = 0.84
const ROW_START = -2.5
const HOP_TIME = 0.62
const HOP_PREP = 0.18 // share of a hop spent crouching before take-off
const HOP_HIGH = 0.22

export function TengTengScene({ game }) {
  const hopper = useRef()
  const motion = useRef({ jump: { phase: null, u: 0, vy: 0, impact: 0.6 }, look: new Vector3() })
  const pose = useRef('stand1')
  const poseFor = (row) => (row >= 0 && TENG_ROWS[row] === 2 ? 'stand2' : 'stand1')
  useFrame((state) => {
    const g = hopper.current
    if (!g) return
    const t = state.clock.elapsedTime
    const hops = TENG_ROWS.length
    const step = Math.floor(t / HOP_TIME) % (hops * 2)
    const p = (t % HOP_TIME) / HOP_TIME
    const forward = step < hops
    const from = forward ? step - 1 : hops * 2 - 1 - step
    const to = forward ? step : hops * 2 - 2 - step
    const zFor = (row) => ROW_START + Math.max(-1, row) * ROW_GAP
    // crouch, spring, fly an arc, land on the next petak (the landing settles into the next crouch)
    const j = motion.current.jump
    let z = zFor(from)
    let y = 0
    if (p < HOP_PREP) {
      j.phase = p < HOP_PREP * 0.4 ? 'land' : 'prep'
      j.u = p < HOP_PREP * 0.4 ? 0.4 + p / (HOP_PREP * 0.4) * 0.6 : (p - HOP_PREP * 0.4) / (HOP_PREP * 0.6)
    } else {
      const u = (p - HOP_PREP) / (1 - HOP_PREP)
      j.phase = 'air'
      j.vy = Math.cos(u * Math.PI) * 2
      z = MathUtils.lerp(zFor(from), zFor(to), MathUtils.smootherstep(u, 0, 1))
      y = Math.sin(u * Math.PI) * HOP_HIGH
    }
    g.position.set(0, y, z)
    g.rotation.y = forward ? 0 : Math.PI
    // eyes on the petak ahead
    const next = forward ? Math.min(to + 1, hops - 1) : Math.max(to - 1, -1)
    g.parent?.localToWorld(motion.current.look.set(0, 0, zFor(next)))
    pose.current = poseFor(to)
  })
  return (
    <group>
      <DirtRect width={2.2} depth={7.6} position={[0, 0, 0]} color="#cfa86e" />
      {TENG_ROWS.map((count, r) => {
        const z = ROW_START + r * ROW_GAP
        const xs = count === 1 ? [0] : [-0.42, 0.42]
        return xs.map((x) => (
          <group key={`${r}-${x}`} position={[x, 0, z]}>
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.84, 0.84]} />
              <meshBasicMaterial color="#8f5f38" polygonOffset polygonOffsetFactor={-3} />
            </mesh>
            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.72, 0.72]} />
              <meshBasicMaterial color="#e3c99e" polygonOffset polygonOffsetFactor={-4} />
            </mesh>
          </group>
        ))
      })}
      {/* Rukiah hops the court; a friend waits her turn */}
      <TengHopper motion={motion} pose={pose} hopper={hopper} />
      <Kid seed={71} girl pose="clap" position={[1.5, 0, -1.6]} rotationY={-Math.PI / 2} phase={2} />
      <group position={[-1.1, 0, -2.4]} rotation={[0, 0.5, 0]}>
        <ModelSlot model={MODELS.selipar} scale={1.4} fallback={null} />
      </group>
      <group position={[-1.25, 0, -1.7]} rotation={[0, -0.4, 0]}>
        <ModelSlot model={MODELS.selipar} scale={1.4} fallback={null} />
      </group>
      <group position={[0.75, 0.01, ROW_START - 0.7]} rotation={[0, 1.2, 0]}>
        <ModelSlot model={MODELS.kapur} scale={2} fallback={null} />
      </group>
      <KidBubble game={game} position={[0, 1.9, ROW_START]} />
    </group>
  )
}

// ------------------------------------------------------------------ Tarik upih
const TRACK = { from: -4, to: 4, travel: 6, pause: 1.6 }

function Upih() {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.03, 0.62]} />
        <meshStandardMaterial color="#a8924e" roughness={0.9} />
      </mesh>
      <mesh position={[0.68, 0.12, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.25, 0.03, 0.6]} />
        <meshStandardMaterial color="#8f7a3e" />
      </mesh>
      <mesh position={[1.2, 0.3, 0]} rotation={[0, 0, Math.PI / 2 - 0.3]}>
        <cylinderGeometry args={[0.035, 0.05, 1.0, 6]} />
        <meshStandardMaterial color="#7a8a3a" />
      </mesh>
    </group>
  )
}

export function TarikUpihScene({ game }) {
  const team = useRef()
  const pullerMotion = useRef({ speed: 0 })
  useFrame((state) => {
    const g = team.current
    if (!g) return
    const cycle = (TRACK.travel + TRACK.pause) * 2
    const t = state.clock.elapsedTime % cycle
    const leg = TRACK.travel + TRACK.pause
    const forward = t < leg
    const local = forward ? t : t - leg
    const moving = local < TRACK.travel
    const f = moving ? local / TRACK.travel : 1
    const eased = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2
    const x = forward ? MathUtils.lerp(TRACK.from, TRACK.to, eased) : MathUtils.lerp(TRACK.to, TRACK.from, eased)
    g.position.x = x
    g.rotation.y = forward ? 0 : Math.PI
    pullerMotion.current.speed = moving ? Math.sin(f * Math.PI) * 0.7 : 0
  })
  return (
    <group>
      <DirtRect width={11.5} depth={1.8} color="#c8a06a" />
      <group ref={team}>
        {/* the team travels along +x in its own frame */}
        <Kid seed={80} pose="pull" position={[0.9, 0, 0]} rotationY={Math.PI / 2} motionRef={pullerMotion} />
        <group position={[-0.9, 0, 0]}>
          <Upih />
          <Kid seed={81} girl pose="sit" position={[-0.15, 0.08, 0]} rotationY={Math.PI / 2} />
        </group>
        <KidBubble game={game} position={[-1, 1.5, 0]} />
      </group>
      <Kid seed={82} pose="clap" position={[0, 0, 2]} rotationY={Math.PI} phase={0.9} />
    </group>
  )
}

// ------------------------------------------------------------------ Main kejar-kejar
export function KejarKejarScene({ game }) {
  const kids = [useRef(), useRef(), useRef()]
  const motion = [useRef({ speed: 0 }), useRef({ speed: 0 }), useRef({ speed: 0 })]
  useFrame((state) => {
    const t = state.clock.elapsedTime
    kids.forEach((ref, k) => {
      const g = ref.current
      if (!g) return
      // two run round the tree, the third (who is "it") chases a step behind
      const a = t * 0.9 - k * (k === 2 ? 0.55 : 2.2)
      const r = 2.7 + Math.sin(t * 0.7 + k) * 0.5
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      g.rotation.y = faceTowards(-Math.sin(a), Math.cos(a))
      motion[k].current.speed = 0.85
    })
  })
  return (
    <group>
      <DirtPatch radius={3.6} color="#b9a06a" />
      <Kid seed={90} groupRef={kids[0]} motionRef={motion[0]} />
      <Kid seed={91} girl groupRef={kids[1]} motionRef={motion[1]} />
      <Kid seed={92} groupRef={kids[2]} motionRef={motion[2]} />
      <KidBubble game={game} position={[0, 2.2, 0]} maxDistance={game.spot.radius + 6} />
    </group>
  )
}

// ------------------------------------------------------------------ Police & thief
export function PoliceThiefScene({ game }) {
  const thief = useRef()
  const police = useRef()
  const thiefMotion = useRef({ speed: 0 })
  const policeMotion = useRef({ speed: 0 })
  const path = (t) => ({ x: Math.sin(t) * 2.8, z: Math.sin(t * 2) * 1.6 })
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.75
    const p = path(t)
    const q = path(t - 0.55)
    const p2 = path(t + 0.05)
    const q2 = path(t - 0.5)
    if (thief.current) {
      thief.current.position.set(p.x, 0, p.z)
      thief.current.rotation.y = faceTowards(p2.x - p.x, p2.z - p.z)
    }
    if (police.current) {
      police.current.position.set(q.x, 0, q.z)
      police.current.rotation.y = faceTowards(q2.x - q.x, q2.z - q.z)
    }
    thiefMotion.current.speed = 0.9
    policeMotion.current.speed = 0.9
  })
  return (
    <group>
      {/* the "lokap": a square drawn on the ground */}
      <GroundLine from={[2.2, 2.4]} to={[3.4, 2.4]} />
      <GroundLine from={[2.2, 3.6]} to={[3.4, 3.6]} />
      <GroundLine from={[2.2, 2.4]} to={[2.2, 3.6]} />
      <GroundLine from={[3.4, 2.4]} to={[3.4, 3.6]} />
      <Kid seed={95} groupRef={thief} motionRef={thiefMotion} />
      <Kid seed={96} groupRef={police} motionRef={policeMotion} />
      <Kid seed={97} girl pose="clap" position={[2.8, 0, 3]} rotationY={Math.PI} phase={0.4} />
      <KidBubble game={game} position={[2.8, 1.6, 3]} maxDistance={game.spot.radius + 6} />
    </group>
  )
}

// ------------------------------------------------------------------ Lumba basikal
// The race runs along Jalan Kampung (over the bridge), not across the river.
const RACE_ROAD = pathOf(ROADS[0].points)
const RACE_SPAN = 11
const _v = new Vector3()
const _q = new Quaternion()
const _e = new Euler()

function RacingKid({ seed, girl, look, lane, phase }) {
  const rig = useRef()
  const front = useRef()
  const rear = useRef()
  const motion = useRef({ speed: 0.7 })
  const centre = useRef(null)
  useFrame((state, delta) => {
    const g = rig.current
    const parent = g?.parent
    if (!g || !parent) return
    parent.updateWorldMatrix(true, false)
    if (centre.current === null) {
      parent.getWorldPosition(_v)
      centre.current = RACE_ROAD.closest(_v.x, _v.z)
    }
    // up and down the road, racing each other
    const t = state.clock.elapsedTime * 0.3 + phase
    const d = centre.current + Math.sin(t) * RACE_SPAN
    const p = RACE_ROAD.at(d)
    const forward = Math.cos(t) >= 0 ? 1 : -1
    const wx = p.x + p.dz * lane
    const wz = p.z - p.dx * lane
    _v.set(wx, groundY(wx, wz), wz)
    parent.worldToLocal(_v)
    g.position.lerp(_v, g.position.lengthSq() === 0 ? 1 : 0.5)
    const parentYaw = _e.setFromQuaternion(parent.getWorldQuaternion(_q), 'YXZ').y
    const heading = Math.atan2(p.dx * forward, p.dz * forward) - parentYaw
    let diff = heading - g.rotation.y
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    g.rotation.y += diff * (1 - Math.exp(-4 * Math.min(delta, 0.05)))
    const spin = Math.abs(Math.cos(t)) * 0.3 * RACE_SPAN * Math.min(delta, 0.05) / 0.32
    if (front.current) front.current.rotation.x += spin
    if (rear.current) rear.current.rotation.x += spin
  })
  return (
    <group ref={rig}>
      <group scale={0.82}>
        <Bicycle frontWheel={front} rearWheel={rear} />
      </group>
      <group position={[0, 0.05, -0.18]}>
        <PersonModel build="kid" look={look ?? kidLook(seed, girl)} pose="ride" motionRef={motion} detail={false} />
      </group>
    </group>
  )
}

export function LumbaBasikalScene({ game }) {
  return (
    <group>
      {/* Kamarul, always out front practising */}
      <RacingKid seed={100} look={KAMARUL.look} lane={-0.7} phase={0} />
      <RacingKid seed={101} girl lane={0.7} phase={0.25} />
      <Kid seed={102} pose="cheer" position={[3.2, 0, 1]} rotationY={-Math.PI / 2} />
      <KidBubble game={game} position={[3.2, 1.6, 1]} maxDistance={game.spot.radius + 8} />
    </group>
  )
}

// ------------------------------------------------------------------ Baling selipar
const TIN_COLORS = ['#c43d3d', '#e2b44a', '#2f6f9a', '#d8d8d8', '#3f7a4a', '#c8642f']
function buildTins() {
  const cylinder = []
  const box = []
  let i = 0
  for (let row = 0; row < 3; row++) {
    const n = 3 - row
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * 0.17
      cylinder.push(part([x, 0.08 + row * 0.16, -2.2], [0.14, 0.15, 0.14], [0, 0, 0], TIN_COLORS[i++ % TIN_COLORS.length]))
    }
  }
  // a selipar on the ground, and the throwing line
  box.push(part([0.6, 0.02, -1.4], [0.11, 0.03, 0.27], [0, 0.6, 0], '#2f6fd1'))
  box.push(part([-0.4, 0.02, 0.8], [0.11, 0.03, 0.27], [0, -0.4, 0], '#d9473b'))
  return { cylinder, box }
}
const TINS = buildTins()

export function BalingSeliparScene({ game }) {
  return (
    <group>
      <DirtPatch radius={3.2} color="#c39461" scaleZ={1.4} />
      <GroundLine from={[-1.5, 2.2]} to={[1.5, 2.2]} />
      <PartsBundle bundle={TINS} />
      <Kid seed={110} pose="throw" position={[0, 0, 2.7]} rotationY={Math.PI} />
      <Kid seed={111} girl pose="clap" position={[-2, 0, 0.4]} rotationY={faceTowards(2, -0.4)} phase={0.5} />
      <Kid seed={112} pose="guard" position={[1.8, 0, -1.6]} rotationY={faceTowards(-1.8, 2.6)} phase={1.1} />
      <KidBubble game={game} position={[0, 1.6, 2.7]} />
    </group>
  )
}

export const SPOT_SCENES = {
  congkak: CongkakScene,
  dam: KedaiKopi,
  gasing: GasingScene,
  wau: WauScene,
  'batu-seremban': BatuSerembanScene,
  'sepak-raga': SepakRagaScene,
  guli: GuliScene,
  'galah-panjang': GalahPanjangScene,
  'konda-kondi': KondaKondiScene,
  'ting-ting': TengTengScene,
  'lumba-basikal': LumbaBasikalScene,
  'kejar-kejar': KejarKejarScene,
  'police-thief': PoliceThiefScene,
  'baling-selipar': BalingSeliparScene,
  'tarik-upih': TarikUpihScene,
}

/** Scenes that position themselves in world space (they contain physics). */
export const WORLD_SPACE_SCENES = new Set(['congkak', 'dam'])
