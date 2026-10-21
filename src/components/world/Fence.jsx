import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PartsBundle } from './InstancedParts'
import { createRandom, part } from './kit'

const POST_COLORS = ['#8b6a45', '#7d5d3b', '#977552', '#86643f']
const RAIL_COLOR = '#9a7a55'
const POST_SPACING = 1.5
const HEIGHT = 1.05

/** Wooden picket-and-rail fence along axis-aligned segments [x1, z1, x2, z2]. */
export function Fence({ segments }) {
  const { bundle, colliders } = useMemo(() => {
    const random = createRandom(42)
    const box = []
    const colliderList = []

    for (const [x1, z1, x2, z2] of segments) {
      const dx = x2 - x1
      const dz = z2 - z1
      const length = Math.hypot(dx, dz)
      const alongX = Math.abs(dx) >= Math.abs(dz)
      const count = Math.max(1, Math.round(length / POST_SPACING))

      for (let i = 0; i <= count; i++) {
        const t = i / count
        const h = HEIGHT + (random() - 0.5) * 0.12
        const tilt = (random() - 0.5) * 0.06
        box.push(
          part([x1 + dx * t, h / 2, z1 + dz * t], [0.13, h, 0.13], [tilt, 0, tilt], POST_COLORS[i % POST_COLORS.length]),
        )
        // pointed cap
        box.push(part([x1 + dx * t, h + 0.04, z1 + dz * t], [0.09, 0.09, 0.09], [Math.PI / 4, 0, Math.PI / 4], '#6d5034'))
      }

      const cx = (x1 + x2) / 2
      const cz = (z1 + z2) / 2
      for (const y of [0.38, 0.82]) {
        box.push(
          part(
            [cx + (alongX ? 0 : 0.08), y, cz + (alongX ? 0.08 : 0)],
            alongX ? [length, 0.08, 0.05] : [0.05, 0.08, length],
            [0, 0, 0],
            RAIL_COLOR,
          ),
        )
      }

      colliderList.push({
        position: [cx, 0.6, cz],
        args: alongX ? [length / 2 + 0.1, 0.6, 0.15] : [0.15, 0.6, length / 2 + 0.1],
      })
    }

    return { bundle: { box }, colliders: colliderList }
  }, [segments])

  return (
    <RigidBody type="fixed" colliders={false}>
      {colliders.map((c, i) => (
        <CuboidCollider key={i} args={c.args} position={c.position} />
      ))}
      <PartsBundle bundle={bundle} />
    </RigidBody>
  )
}
