import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { worldRuntime } from '../../state/worldRuntime'

/** Low evening sun from the west-ish side: long shadows, warm light. */
export const SUN_POSITION = [70, 15, -14]
const SUN_DIRECTION = new Vector3(...SUN_POSITION).normalize()
const SUN_DISTANCE = 60

/**
 * Golden-hour lighting. The shadow-casting sun follows the player so a modest
 * shadow map stays crisp across the whole kampung.
 */
export function Lighting() {
  const sun = useRef()

  useFrame(() => {
    const light = sun.current
    if (!light) return
    const p = worldRuntime.playerPosition
    light.position.set(
      p.x + SUN_DIRECTION.x * SUN_DISTANCE,
      p.y + SUN_DIRECTION.y * SUN_DISTANCE,
      p.z + SUN_DIRECTION.z * SUN_DISTANCE,
    )
    light.target.position.set(p.x, p.y, p.z)
    light.target.updateMatrixWorld()
  })

  return (
    <>
      <hemisphereLight args={['#ffe2bd', '#4d6a33', 0.95]} />
      <directionalLight
        ref={sun}
        color="#ffbd7d"
        intensity={2.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {/* cool fill from the opposite sky so shadows aren't muddy */}
      <directionalLight color="#a9c1ff" intensity={0.35} position={[-40, 30, 40]} />
    </>
  )
}
