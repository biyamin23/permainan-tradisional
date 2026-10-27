import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { MathUtils, Vector3 } from 'three'
import { sfx } from '../../audio/engine'
import { games } from '../../data/games'
import { SPAWN, groundY, isOnBridge, isOnRoad } from '../../data/kampungLayout'
import { consumeJump, getMoveInput } from '../../state/input'
import { worldRuntime } from '../../state/worldRuntime'
import { ChildModel } from '../character/ChildModel'

// a child's walk, and an unhurried jog with Shift
const WALK_SPEED = 2.8
const RUN_SPEED = 4.8
const ACCELERATION = 8 // speeding up
const BRAKING = 11 // slowing down / stopping
const AIR_CONTROL = 0.3
const TURN_SPEED = 13 // at a walk; a run turns wider
// a hop, not a superhero leap: ~0.45 m with the world's gravity of 20
const JUMP_SPEED = 4.3
const JUMP_PREP = 0.1 // knees bend before the feet leave the ground
const LAND_TIME = 0.32
const LOOK_RANGE = 7

const SPOT_POINTS = games.filter((g) => g.spot).map((g) => new Vector3(g.spot.position[0], 0.7, g.spot.position[1]))

function surfaceAt(x, z) {
  if (isOnBridge(x, z)) return 'wood'
  if (isOnRoad(x, z)) return 'dirt'
  return 'grass'
}

/** Shortest-path angle damping. */
function dampAngle(current, target, lambda, dt) {
  let diff = target - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * (1 - Math.exp(-lambda * dt))
}

/**
 * Third-person kid controlled with WASD / arrows (Shift to run, Space to hop).
 * Movement is relative to the camera's yaw. Physics via a dynamic capsule with
 * locked rotations so houses, fences, trees and water block the way.
 *
 * The controller owns velocity and the ground/jump state (ground → prep → air →
 * land); it hands the model a `motion` object (speed, distance walked, run
 * blend, lean into turns, jump phase, what to look at) and the rig animates
 * from that, so the feet match the ground speed.
 */
export function Player({ gender, enabled }) {
  const body = useRef()
  const visual = useRef()
  const { world, rapier } = useRapier()
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier])
  const motion = useRef({
    speed: 0,
    dist: 0,
    run: 0,
    bank: 0,
    jump: { phase: null, u: 0, vy: 0, impact: 0 },
    look: null,
    groundY: 0,
  })
  const ctrl = useRef({ state: 'ground', t: 0, air: 0, fallVy: 0, run: 0, lastFacing: Math.PI })
  const facing = useRef(Math.PI) // start facing into the kampung (-z)
  const stride = useRef(0)

  useEffect(() => {
    if (visual.current) visual.current.rotation.y = facing.current
  }, [])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)
    const m = motion.current
    const c = ctrl.current

    // travelling from the map: appear at the spot, facing into it
    const jump = worldRuntime.teleport
    if (jump) {
      worldRuntime.teleport = null
      rb.setTranslation({ x: jump.x, y: 1.2, z: jump.z }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      worldRuntime.playerPosition.set(jump.x, 0.2, jump.z)
      if (jump.yaw !== undefined) {
        worldRuntime.cameraYaw = jump.yaw
        facing.current = jump.yaw + Math.PI
      }
      worldRuntime.cameraSnap = true
      c.state = 'ground'
      return
    }

    const p = rb.translation()
    const velocity = rb.linvel()

    // ground check: one short ray down from the hips
    ray.origin.x = p.x
    ray.origin.y = p.y + 0.3
    ray.origin.z = p.z
    const hit = world.castRay(ray, 0.42, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rb)
    const grounded = Boolean(hit) && velocity.y < 1.5

    const input = enabled ? getMoveInput() : { x: 0, y: 0, run: false }
    const wantsJump = enabled && consumeJump()
    const yaw = worldRuntime.cameraYaw
    // camera-relative axes on the ground plane
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    // ease into a run rather than snapping to it
    c.run = MathUtils.damp(c.run, input.run && Math.hypot(input.x, input.y) > 0.1 ? 1 : 0, 3, dt)
    const speed = MathUtils.lerp(WALK_SPEED, RUN_SPEED, c.run)
    const targetX = (rx * input.x + fx * input.y) * speed
    const targetZ = (rz * input.x + fz * input.y) * speed

    // ----- ground / jump state
    c.t += dt
    let vy = velocity.y
    if (c.state === 'ground' || c.state === 'land') {
      if (wantsJump && grounded) {
        c.state = 'prep'
        c.t = 0
      } else if (!grounded && vy < -1.5) {
        // walked off an edge
        c.state = 'air'
        c.t = 0
        c.air = 0
      } else if (c.state === 'land' && c.t > LAND_TIME) c.state = 'ground'
    } else if (c.state === 'prep') {
      if (c.t >= JUMP_PREP) {
        c.state = 'air'
        c.t = 0
        c.air = 0
        vy = JUMP_SPEED
        sfx.footstep(surfaceAt(p.x, p.z), false)
      }
    } else if (c.state === 'air') {
      c.air += dt
      c.fallVy = Math.min(c.fallVy, vy)
      if (grounded && c.air > 0.12 && vy <= 0.5) {
        c.state = 'land'
        c.t = 0
        m.jump.impact = MathUtils.clamp(-c.fallVy / 7, 0.35, 1)
        c.fallVy = 0
        worldRuntime.cameraKick = Math.max(worldRuntime.cameraKick ?? 0, m.jump.impact)
        sfx.footstep(surfaceAt(p.x, p.z), true)
        stride.current = 0
      }
    }

    // ----- horizontal velocity: accelerate, brake, a little air control
    const speeding = Math.hypot(targetX, targetZ) > Math.hypot(velocity.x, velocity.z)
    let rate = speeding ? ACCELERATION : BRAKING
    if (c.state === 'air') rate *= AIR_CONTROL
    if (c.state === 'prep' || (c.state === 'land' && c.t < 0.12)) rate *= 0.5
    const k = 1 - Math.exp(-rate * dt)
    const vx = velocity.x + (targetX - velocity.x) * k
    const vz = velocity.z + (targetZ - velocity.z) * k
    rb.setLinvel({ x: vx, y: vy, z: vz }, true)

    // ----- facing: turn towards travel, wider when running; lean into the turn
    const horizontal = Math.hypot(vx, vz)
    if (horizontal > 0.35 && Math.hypot(targetX, targetZ) > 0.1) {
      facing.current = dampAngle(facing.current, Math.atan2(vx, vz), MathUtils.lerp(TURN_SPEED, 8, c.run), dt)
    }
    let turn = facing.current - c.lastFacing
    while (turn > Math.PI) turn -= Math.PI * 2
    while (turn < -Math.PI) turn += Math.PI * 2
    c.lastFacing = facing.current
    const bank = MathUtils.clamp((-turn / Math.max(dt, 1e-3)) * 0.03 * Math.min(horizontal / RUN_SPEED, 1), -0.14, 0.14)
    m.bank = MathUtils.damp(m.bank, c.state === 'air' ? 0 : bank, 8, dt)
    if (visual.current) visual.current.rotation.y = facing.current

    // ----- what the rig needs
    m.speed = Math.min(horizontal / RUN_SPEED, 1) * (horizontal > 0.15 ? 1 : 0)
    m.run = MathUtils.clamp((horizontal - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1)
    if (c.state !== 'air') m.dist += horizontal * dt
    m.groundY = groundY(p.x, p.z)
    m.jump.vy = vy
    m.jump.phase = c.state === 'ground' ? null : c.state
    m.jump.u =
      c.state === 'prep' ? c.t / JUMP_PREP : c.state === 'land' ? Math.min(1, c.t / LAND_TIME) : 0

    // eyes on the nearest game spot when it's close
    let look = null
    let best = LOOK_RANGE * LOOK_RANGE
    for (const s of SPOT_POINTS) {
      const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2
      if (d < best) {
        best = d
        look = s
      }
    }
    m.look = look

    // footsteps: one sound per stride, louder when running
    if (horizontal > 0.6 && c.state !== 'air') {
      stride.current += horizontal * dt
      const strideLength = MathUtils.lerp(0.45, 0.8, m.run)
      if (stride.current > strideLength) {
        stride.current = 0
        sfx.footstep(surfaceAt(p.x, p.z), m.run > 0.5)
      }
    } else if (c.state !== 'air') {
      stride.current = 0.3
    }
    // safety net: if we ever fall out of the world, come back to the road
    if (p.y < -10) {
      rb.setTranslation({ x: SPAWN[0], y: SPAWN[1] + 1, z: SPAWN[2] }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }
    worldRuntime.playerPosition.set(p.x, p.y, p.z)
    worldRuntime.playerVelocity.set(vx, vy, vz)
    worldRuntime.playerAirborne = c.state === 'air'
    worldRuntime.playerBody = rb
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={SPAWN}
      lockRotations
      canSleep={false}
      linearDamping={0.2}
      friction={0}
      ccd
    >
      <CapsuleCollider args={[0.5, 0.3]} position={[0, 0.8, 0]} friction={0} />
      <group ref={visual}>
        <ChildModel gender={gender} motionRef={motion} />
      </group>
    </RigidBody>
  )
}
