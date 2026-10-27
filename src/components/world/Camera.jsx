import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { MathUtils, Vector3 } from 'three'
import { games, isGameAvailable } from '../../data/games'
import { groundY } from '../../data/kampungLayout'
import { worldRuntime } from '../../state/worldRuntime'

const PLAYABLE = games.filter(isGameAvailable)

const MIN_DISTANCE = 5.5
const MAX_DISTANCE = 14
const LOOK_HEIGHT = 1.3
const INTRO_SECONDS = 2.8
const AUTO_FOLLOW_DELAY = 1.6 // seconds after a drag before the camera drifts back behind you
const MIN_CLEARANCE = 2.2

/**
 * Third-person follow camera: slightly above and behind the player, smoothly
 * damped. Drag (mouse or touch) to orbit around the player, wheel to zoom.
 * Pitch is derived from distance so the camera never takes extreme angles.
 *
 * It follows a softened focus point (a small delay, a little look-ahead in the
 * direction of travel, jumps only half-followed), drifts back behind the
 * player while they walk, pulls in when a house or wall comes between, and
 * dips a touch on a landing. Also keeps the HUD's objective arrow pointed at
 * the first playable game.
 */
export function CameraRig() {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const desired = useRef(new Vector3())
  const lookAt = useRef(new Vector3())
  const lookTarget = useRef(new Vector3())
  const focus = useRef(null)
  const ahead = useRef(new Vector3())
  const rig = useRef({ dist: null, dip: 0 })
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), [rapier])
  const started = useRef(null)
  const lastDistanceText = useRef('')
  const lastTarget = useRef(null)

  useEffect(() => {
    const element = gl.domElement
    let dragging = false
    let lastX = 0
    let pointerId = null

    const onPointerDown = (event) => {
      dragging = true
      lastX = event.clientX
      pointerId = event.pointerId
      element.setPointerCapture?.(event.pointerId)
    }
    const onPointerMove = (event) => {
      if (!dragging || event.pointerId !== pointerId) return
      const dx = event.clientX - lastX
      lastX = event.clientX
      worldRuntime.cameraYaw -= dx * 0.006
      worldRuntime.cameraDraggedAt = performance.now()
    }
    const onPointerUp = (event) => {
      if (event.pointerId !== pointerId) return
      dragging = false
      element.releasePointerCapture?.(event.pointerId)
    }
    const onWheel = (event) => {
      worldRuntime.cameraDistance = MathUtils.clamp(
        worldRuntime.cameraDistance + event.deltaY * 0.01,
        MIN_DISTANCE,
        MAX_DISTANCE,
      )
    }

    element.style.touchAction = 'none'
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    if (started.current === null) {
      started.current = state.clock.elapsedTime
      lookAt.current.set(0, 1, 0).add(worldRuntime.playerPosition)
    }
    const introProgress = MathUtils.clamp((state.clock.elapsedTime - started.current) / INTRO_SECONDS, 0, 1)

    const p = worldRuntime.playerPosition
    const v = worldRuntime.playerVelocity

    // softened focus: a small follow delay, jumps only half-followed
    if (!focus.current || worldRuntime.cameraSnap) focus.current = p.clone()
    const f = focus.current
    f.x = MathUtils.damp(f.x, p.x, 9, dt)
    f.z = MathUtils.damp(f.z, p.z, 9, dt)
    f.y = MathUtils.damp(f.y, worldRuntime.playerAirborne ? (f.y + p.y) / 2 : p.y, 5, dt)
    // look a little ahead of where the player is going
    ahead.current.x = MathUtils.damp(ahead.current.x, v.x * 0.22, 3, dt)
    ahead.current.z = MathUtils.damp(ahead.current.z, v.z * 0.22, 3, dt)

    // drift back behind the player while they walk (not when they come towards the camera)
    const moving = Math.hypot(v.x, v.z)
    const sinceDrag = (performance.now() - worldRuntime.cameraDraggedAt) / 1000
    if (moving > 1 && sinceDrag > AUTO_FOLLOW_DELAY && introProgress >= 1) {
      let yaw0 = worldRuntime.cameraYaw
      const behind = Math.atan2(-v.x, -v.z)
      const forwardness = (-Math.sin(yaw0) * v.x - Math.cos(yaw0) * v.z) / moving
      const w = MathUtils.smoothstep(forwardness, -0.2, 0.7) * Math.min(moving / 2.8, 1)
      let diff = behind - yaw0
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      yaw0 += diff * (1 - Math.exp(-1.1 * w * dt))
      worldRuntime.cameraYaw = yaw0
    }

    const yaw = worldRuntime.cameraYaw
    const wanted = worldRuntime.cameraDistance

    // keep a wall or house from coming between the camera and the player
    const r = rig.current
    if (r.dist === null) r.dist = wanted
    let allowed = wanted
    const headY = f.y + LOOK_HEIGHT
    const dirX = Math.sin(yaw)
    const dirY = (1.4 + wanted * 0.42 - LOOK_HEIGHT) / wanted
    const dirZ = Math.cos(yaw)
    const len = Math.hypot(dirX, dirY, dirZ)
    ray.origin.x = f.x
    ray.origin.y = headY
    ray.origin.z = f.z
    ray.dir.x = dirX / len
    ray.dir.y = dirY / len
    ray.dir.z = dirZ / len
    const flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_KINEMATIC
    const hit = world.castRay(ray, wanted * len, true, flags, undefined, undefined, worldRuntime.playerBody ?? undefined)
    if (hit) allowed = Math.max(MIN_CLEARANCE, hit.timeOfImpact / len - 0.35)
    // pull in quickly, ease back out slowly (no popping past tree trunks)
    r.dist = MathUtils.damp(r.dist, allowed, allowed < r.dist ? 14 : 2.2, dt)
    const distance = r.dist
    // pulled in close: rise a little too, to look over stairs, fences and railings
    const height = 1.4 + distance * 0.42 + Math.min(2, (wanted - distance) * 0.3)

    // a small dip when landing a jump
    const kick = worldRuntime.cameraKick ?? 0
    worldRuntime.cameraKick = kick * Math.exp(-7 * dt)
    r.dip = MathUtils.damp(r.dip, -0.09 * kick, 18, dt)

    const fx = f.x + ahead.current.x
    const fz = f.z + ahead.current.z
    desired.current.set(fx + Math.sin(yaw) * distance, f.y + height + r.dip, fz + Math.cos(yaw) * distance)
    desired.current.y = Math.max(desired.current.y, groundY(desired.current.x, desired.current.z) + 0.5)

    lookTarget.current.set(fx, f.y + LOOK_HEIGHT + r.dip * 0.6, fz)
    const debug = worldRuntime.debugCamera
    if (debug) {
      camera.position.set(...debug.position)
      camera.lookAt(...debug.target)
      if (state.scene.fog) state.scene.fog.far = 3000
    } else if (worldRuntime.cameraSnap) {
      // just travelled from the map: cut straight to the new spot
      worldRuntime.cameraSnap = false
      started.current = -INTRO_SECONDS
      camera.position.copy(desired.current)
      lookAt.current.copy(lookTarget.current)
      camera.lookAt(lookAt.current)
    } else {
      // Slow cinematic glide in on arrival, snappy follow afterwards
      const followRate = MathUtils.lerp(1.4, 8, introProgress * introProgress)
      camera.position.lerp(desired.current, 1 - Math.exp(-followRate * dt))
      lookAt.current.lerp(lookTarget.current, 1 - Math.exp(-10 * dt))
      camera.lookAt(lookAt.current)
    }

    // Objective arrow in the HUD: points to the nearest game you can play
    const { arrow, distance: distanceEl, label } = worldRuntime.hud
    if (arrow || distanceEl) {
      let target = PLAYABLE[0]
      let best = Infinity
      for (const g of PLAYABLE) {
        const d = Math.hypot(g.spot.position[0] - p.x, g.spot.position[1] - p.z) - g.spot.radius
        if (d < best) {
          best = d
          target = g
        }
      }
      if (label && target.id !== lastTarget.current) {
        label.textContent = `Jom main ${target.name}`
        lastTarget.current = target.id
      }
      const [tx, tz] = target.spot.position
      const vx = tx - p.x
      const vz = tz - p.z
      const sx = vx * Math.cos(yaw) - vz * Math.sin(yaw)
      const sy = -vx * Math.sin(yaw) - vz * Math.cos(yaw)
      if (arrow) arrow.style.transform = `rotate(${Math.atan2(sx, sy)}rad)`
      if (distanceEl) {
        const meters = Math.max(0, Math.round(Math.hypot(vx, vz) - target.spot.radius))
        const text = meters < 1 ? 'Dah sampai!' : `${meters} m`
        if (text !== lastDistanceText.current) {
          distanceEl.textContent = text
          lastDistanceText.current = text
        }
      }
    }
  })

  return null
}
