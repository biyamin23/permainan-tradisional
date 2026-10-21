import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody } from '@react-three/rapier'
import { SPAWN } from '../../data/kampungLayout'
import { getMoveInput } from '../../state/input'
import { worldRuntime } from '../../state/worldRuntime'
import { ChildModel } from '../character/ChildModel'

const WALK_SPEED = 4.2
const RUN_SPEED = 7.2
const ACCELERATION = 12
const TURN_SPEED = 12

/** Shortest-path angle damping. */
function dampAngle(current, target, lambda, dt) {
  let diff = target - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * (1 - Math.exp(-lambda * dt))
}

/**
 * Third-person kid controlled with WASD / arrows (Shift to run).
 * Movement is relative to the camera's yaw. Physics via a dynamic capsule with
 * locked rotations so houses, fences, trees and water block the way.
 */
export function Player({ gender, enabled }) {
  const body = useRef()
  const visual = useRef()
  const motion = useRef({ speed: 0 })
  const facing = useRef(Math.PI) // start facing into the kampung (-z)

  useEffect(() => {
    if (visual.current) visual.current.rotation.y = facing.current
  }, [])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)

    const input = enabled ? getMoveInput() : { x: 0, y: 0, run: false }
    const yaw = worldRuntime.cameraYaw
    // camera-relative axes on the ground plane
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    const speed = input.run ? RUN_SPEED : WALK_SPEED
    const targetX = (rx * input.x + fx * input.y) * speed
    const targetZ = (rz * input.x + fz * input.y) * speed

    const velocity = rb.linvel()
    const k = 1 - Math.exp(-ACCELERATION * dt)
    const vx = velocity.x + (targetX - velocity.x) * k
    const vz = velocity.z + (targetZ - velocity.z) * k
    rb.setLinvel({ x: vx, y: velocity.y, z: vz }, true)

    const horizontal = Math.hypot(vx, vz)
    if (horizontal > 0.35 && Math.hypot(targetX, targetZ) > 0.1) {
      facing.current = dampAngle(facing.current, Math.atan2(vx, vz), TURN_SPEED, dt)
    }
    if (visual.current) visual.current.rotation.y = facing.current
    motion.current.speed = Math.min(horizontal / RUN_SPEED, 1) * (horizontal > 0.2 ? 1 : 0)

    const p = rb.translation()
    // safety net: if we ever fall out of the world, come back to the road
    if (p.y < -10) {
      rb.setTranslation({ x: SPAWN[0], y: SPAWN[1] + 1, z: SPAWN[2] }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }
    worldRuntime.playerPosition.set(p.x, p.y, p.z)
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
