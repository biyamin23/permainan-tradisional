import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'
import { worldRuntime } from '../../../state/worldRuntime'

const _world = new Vector3()

/**
 * Speech bubble / label that only appears when the player is nearby.
 * Distance is checked a few times per second, so many bubbles stay cheap.
 *
 * minDistance hides it again when the player is very close (e.g. inside a
 * game zone, where the interaction prompt takes over).
 */
export function ProximityBubble({
  lines,
  position = [0, 0, 0],
  maxDistance = 9,
  minDistance = 0,
  interval = 4200,
  variant = 'speech',
  children,
}) {
  const anchor = useRef()
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)
  const timer = useRef(0)

  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.25 || !anchor.current) return
    timer.current = 0
    anchor.current.getWorldPosition(_world)
    const p = worldRuntime.playerPosition
    const d = Math.hypot(_world.x - p.x, _world.z - p.z)
    const next = d < maxDistance && d >= minDistance
    setVisible((current) => (current === next ? current : next))
  })

  useEffect(() => {
    if (!visible || !lines || lines.length < 2) return undefined
    const id = setInterval(() => setIndex((i) => (i + 1) % lines.length), interval)
    return () => clearInterval(id)
  }, [visible, lines, interval])

  return (
    <group ref={anchor} position={position}>
      {visible && (
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`bubble bubble--${variant}`} key={index}>
            {children ?? lines?.[index % lines.length]}
          </div>
        </Html>
      )}
    </group>
  )
}
