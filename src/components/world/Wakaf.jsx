import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PartsBundle } from './InstancedParts'
import { mergeBundles, part } from './kit'

/** A wakaf / pondok: raised open platform with a pyramid roof. Front faces +z. */
export function buildWakafParts({ roof = '#8f3b26', wood = '#7a5232', size = 3.4 } = {}) {
  const box = []
  const cylinder = []
  const pyramid = []
  const half = size / 2 - 0.2
  box.push(part([0, 0.55, 0], [size, 0.15, size], [0, 0, 0], '#8a5d36'))
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      cylinder.push(part([x, 1.375, z], [0.18, 2.75, 0.18], [0, 0, 0], wood))
      box.push(part([x, 0.06, z], [0.32, 0.12, 0.32], [0, 0, 0], '#a59e90'))
    }
  }
  box.push(part([0, 0.44, half], [size, 0.12, 0.12], [0, 0, 0], wood))
  box.push(part([0, 0.44, -half], [size, 0.12, 0.12], [0, 0, 0], wood))
  box.push(part([half, 0.44, 0], [0.12, 0.12, size], [0, 0, 0], wood))
  box.push(part([-half, 0.44, 0], [0.12, 0.12, size], [0, 0, 0], wood))
  // back rail
  box.push(part([0, 1.05, -half], [size - 0.2, 0.08, 0.08], [0, 0, 0], wood))
  // roof
  pyramid.push(part([0, 2.65, 0], [size * 1.55, 1.5, size * 1.55], [0, 0, 0], roof))
  box.push(part([0, 2.62, 0], [size + 0.3, 0.1, size + 0.3], [0, 0, 0], wood))
  box.push(part([0, 4.2, 0], [0.14, 0.3, 0.14], [0, 0, 0], wood))
  // step
  box.push(part([0, 0.24, size / 2 + 0.3], [1.1, 0.1, 0.5], [0, 0, 0], '#8a5d36'))
  return { box, cylinder, pyramid }
}

export function Wakaf({ position, rotationY = 0, roof, extras }) {
  const bundle = useMemo(() => {
    const base = buildWakafParts({ roof })
    return extras ? mergeBundles(base, extras) : base
  }, [roof, extras])

  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CuboidCollider args={[1.8, 0.6, 1.8]} position={[0, 0.6, 0]} />
      <PartsBundle bundle={bundle} />
    </RigidBody>
  )
}
