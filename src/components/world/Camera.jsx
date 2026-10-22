import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { games, isGameAvailable } from '../../data/games'

const PLAYABLE = games.filter(isGameAvailable)
import { worldRuntime } from '../../state/worldRuntime'

const MIN_DISTANCE = 5.5
const MAX_DISTANCE = 14
const LOOK_HEIGHT = 1.3
const INTRO_SECONDS = 2.8

/**
 * Third-person follow camera: slightly above and behind the player, smoothly
 * damped. Drag (mouse or touch) to orbit around the player, wheel to zoom.
 * Pitch is derived from distance so the camera never takes extreme angles.
 * Also keeps the HUD's objective arrow pointed at the first playable game.
 */
export function CameraRig() {
  const { camera, gl } = useThree()
  const desired = useRef(new Vector3())
  const lookAt = useRef(new Vector3())
  const lookTarget = useRef(new Vector3())
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
    const yaw = worldRuntime.cameraYaw
    const distance = worldRuntime.cameraDistance
    const height = 1.4 + distance * 0.42

    desired.current.set(p.x + Math.sin(yaw) * distance, p.y + height, p.z + Math.cos(yaw) * distance)

    // Slow cinematic glide in on arrival, snappy follow afterwards
    const followRate = MathUtils.lerp(1.4, 6, introProgress * introProgress)
    camera.position.lerp(desired.current, 1 - Math.exp(-followRate * dt))
    lookTarget.current.set(p.x, p.y + LOOK_HEIGHT, p.z)
    lookAt.current.lerp(lookTarget.current, 1 - Math.exp(-10 * dt))
    camera.lookAt(lookAt.current)

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
