import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PartsBundle } from './InstancedParts'
import { MAT, part } from './kit'

/**
 * Sekolah Kebangsaan kampung: two single-storey blocks with red roofs and a
 * covered verandah, a signboard and a flagpole. Front faces +z.
 * (Stand-in until a GLB model of the school is added.)
 */

const WALL = '#efe4c8'
const BAND = '#3f8a7a'
const ROOF = '#b5432e'
const POST = '#d8cdb2'

function block(box, prism, glow, { x, z, w, d, rotY = 0 }) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  const at = (lx, y, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c]
  box.push(part(at(0, 0.15, 0), [w + 2.4, 0.3, d + 2.4], [0, rotY, 0], '#b9b2a4'))
  box.push(part(at(0, 1.75, 0), [w, 2.9, d], [0, rotY, 0], WALL))
  box.push(part(at(0, 0.75, 0), [w + 0.02, 0.9, d + 0.02], [0, rotY, 0], BAND))
  // roof
  prism.push(part(at(0, 3.2, 0), [d + 3, 1.7, w + 0.8], [0, rotY + Math.PI / 2, 0], ROOF))
  // verandah posts along the front
  for (let i = -w / 2 + 0.6; i <= w / 2 - 0.5; i += 2.4) box.push(part(at(i, 1.75, d / 2 + 1.05), [0.18, 2.9, 0.18], [0, rotY, 0], POST))
  // windows and doors on the front wall
  for (let i = -w / 2 + 1.4; i < w / 2 - 0.8; i += 2.4) {
    const door = Math.abs(i) < 1.3
    glow.push(part(at(i, door ? 1.35 : 2.0, d / 2 + 0.02), [door ? 1.2 : 1.5, door ? 2.1 : 1.1, 0.04], [0, rotY, 0], '#ffffff'))
  }
}

function buildSchool() {
  const box = []
  const prism = []
  const cylinder = []
  const glow = []
  block(box, prism, glow, { x: -3, z: 0, w: 20, d: 7 })
  block(box, prism, glow, { x: 11.5, z: 4.5, w: 12, d: 7, rotY: Math.PI / 2 })
  // signboard: SK Kampung
  for (const x of [-3, 1]) box.push(part([x - 8, 0.9, 9.5], [0.14, 1.8, 0.14], [0, 0, 0], '#5a5a5a'))
  box.push(part([-9, 1.8, 9.5], [4.6, 1.1, 0.12], [0, 0, 0], '#1f4f8a'))
  box.push(part([-9, 1.8, 9.57], [4.2, 0.8, 0.02], [0, 0, 0], '#f2efe6'))
  // flagpole with the Jalur Gemilang colours
  cylinder.push(part([-15, 3.5, 7.5], [0.12, 7, 0.12], [0, 0, 0], '#d8d8d8'))
  for (let i = 0; i < 6; i++) box.push(part([-14.25, 6.6 - i * 0.16, 7.5], [1.4, 0.16, 0.03], [0, 0, 0], i % 2 ? '#f2efe6' : '#c4302b'))
  box.push(part([-14.6, 6.5, 7.52], [0.7, 0.5, 0.02], [0, 0, 0], '#1f3f8a'))
  // low fence along the front
  for (let x = -16; x <= 18; x += 1.2) box.push(part([x, 0.45, 11.5], [0.08, 0.9, 0.08], [0, 0, 0], '#e8e1d0'))
  box.push(part([1, 0.75, 11.5], [34, 0.07, 0.06], [0, 0, 0], '#e8e1d0'))
  return { bundle: { box, prism, cylinder }, glow }
}

const PARTS = buildSchool()

export function School({ position, rotationY = 0 }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CuboidCollider args={[11.2, 1.6, 4.7]} position={[-3, 1.6, 0.5]} />
      <CuboidCollider args={[4.7, 1.6, 7.2]} position={[11.5, 1.6, 4.5]} />
      <CuboidCollider args={[0.15, 3.5, 0.15]} position={[-15, 3.5, 7.5]} />
      <PartsBundle bundle={PARTS.bundle} />
      <PartsBundle bundle={{ box: PARTS.glow }} material={MAT.glow} castShadow={false} />
    </RigidBody>
  )
}
