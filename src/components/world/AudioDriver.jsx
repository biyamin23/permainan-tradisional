import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { startAmbience, stopAmbience, updateAmbience } from '../../audio/engine'
import { POND, STREAM } from '../../data/kampungLayout'
import { worldRuntime } from '../../state/worldRuntime'

/** Inside <Canvas>: starts kampung ambience and feeds it distances from the player. */
export function AudioDriver() {
  const timer = useRef(0)

  useEffect(() => {
    startAmbience()
    return stopAmbience
  }, [])

  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.2) return
    timer.current = 0
    const p = worldRuntime.playerPosition
    const { bike, bikeMoving, chickens } = worldRuntime.npc
    let nearestChicken = 99
    for (const c of chickens) {
      const d = Math.hypot(c.x - p.x, c.z - p.z)
      if (d < nearestChicken) nearestChicken = d
    }
    updateAmbience({
      stream: Math.max(0, Math.abs(p.z - STREAM.z) - STREAM.width / 2),
      pond: Math.max(0, Math.hypot(p.x - POND.center[0], p.z - POND.center[1]) - POND.radius),
      chickens: nearestChicken,
      bike: Math.hypot(bike.x - p.x, bike.z - p.z),
      bikeMoving,
    })
  })

  return null
}
