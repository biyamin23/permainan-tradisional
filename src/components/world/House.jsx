import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PartsBundle } from './InstancedParts'
import { MAT, part } from './kit'
import { MODELS } from '../../data/models'
import { ModelSlot } from './ModelSlot'

/**
 * A traditional Malay kampung house on stilts: raised floor, plank walls,
 * front gable with a tebar layar panel, zinc roof, serambi (porch) and stairs.
 * Local origin is the centre of the footprint at ground level, front faces +z.
 */

const VARIANTS = {
  tokwan: {
    wall: '#bd8a55',
    wallDark: '#a8763f',
    trim: '#f0dcb4',
    shutter: '#3f8a7a',
    roof: '#933d27',
    ridge: '#6d2b1b',
    gable: '#e3c08a',
  },
  biru: {
    wall: '#c39a6a',
    wallDark: '#ad8456',
    trim: '#f4e6c8',
    shutter: '#3b6f9e',
    roof: '#6f6a64',
    ridge: '#4f4b47',
    gable: '#d8c3a0',
  },
  kelabu: {
    wall: '#a9784a',
    wallDark: '#936539',
    trim: '#efdcbc',
    shutter: '#a8453a',
    roof: '#7c4430',
    ridge: '#5c2f20',
    gable: '#d2ac78',
  },
  hijau: {
    wall: '#b48250',
    wallDark: '#9c6d3e',
    trim: '#f2e2c0',
    shutter: '#5f8a3a',
    roof: '#8a5a3c',
    ridge: '#5d3a25',
    gable: '#dcb684',
  },
}

const STILT = '#5b3a22'
const FLOOR = '#6e4527'
const INTERIOR = '#2c1d13'
const FOOTING = '#a59e90'

const W = 8 // width (x)
const D = 7 // depth (z)
const FLOOR_Y = 1.4
const WALL_H = 2.4
const WALL_T = 0.15
const WALL_BASE = FLOOR_Y + 0.1
const WALL_TOP = WALL_BASE + WALL_H
const WALL_MID = WALL_BASE + WALL_H / 2
const ROOF_RISE = 2.6
const FRONT_Z = D / 2

export function buildHouseParts(variantKey = 'tokwan') {
  const c = VARIANTS[variantKey] ?? VARIANTS.tokwan
  const box = []
  const cylinder = []
  const prism = []
  const ball = []

  // --- Stilts (tiang) and stone footings
  for (const x of [-3.8, -1.3, 1.3, 3.8]) {
    for (const z of [-3.3, 0, 3.3]) {
      cylinder.push(part([x, 0.7, z], [0.24, 1.4, 0.24], [0, 0, 0], STILT))
      box.push(part([x, 0.07, z], [0.42, 0.14, 0.42], [0, 0, 0], FOOTING))
    }
  }

  // --- Floor and beams
  box.push(part([0, FLOOR_Y, 0], [W + 0.2, 0.2, D + 0.2], [0, 0, 0], FLOOR))
  box.push(part([0, FLOOR_Y - 0.12, D / 2 + 0.06], [W + 0.35, 0.22, 0.22], [0, 0, 0], STILT))
  box.push(part([0, FLOOR_Y - 0.12, -D / 2 - 0.06], [W + 0.35, 0.22, 0.22], [0, 0, 0], STILT))
  box.push(part([W / 2 + 0.06, FLOOR_Y - 0.12, 0], [0.22, 0.22, D + 0.35], [0, 0, 0], STILT))
  box.push(part([-W / 2 - 0.06, FLOOR_Y - 0.12, 0], [0.22, 0.22, D + 0.35], [0, 0, 0], STILT))

  // --- Back and side walls
  box.push(part([0, WALL_MID, -D / 2 + WALL_T / 2], [W, WALL_H, WALL_T], [0, 0, 0], c.wall))
  box.push(part([W / 2 - WALL_T / 2, WALL_MID, 0], [WALL_T, WALL_H, D], [0, 0, 0], c.wall))
  box.push(part([-W / 2 + WALL_T / 2, WALL_MID, 0], [WALL_T, WALL_H, D], [0, 0, 0], c.wall))

  // --- Front wall with a door and two windows
  const frontZ = FRONT_Z - WALL_T / 2
  const openings = [
    { x0: -3.1, x1: -1.9, bottom: 2.1, top: 3.3 }, // window
    { x0: -0.7, x1: 0.7, bottom: WALL_BASE, top: WALL_BASE + 2.0 }, // door
    { x0: 1.9, x1: 3.1, bottom: 2.1, top: 3.3 }, // window
  ]
  const solidRuns = [
    [-W / 2, -3.1],
    [-1.9, -0.7],
    [0.7, 1.9],
    [3.1, W / 2],
  ]
  for (const [x0, x1] of solidRuns) {
    box.push(part([(x0 + x1) / 2, WALL_MID, frontZ], [x1 - x0, WALL_H, WALL_T], [0, 0, 0], c.wall))
  }
  for (const o of openings) {
    const cx = (o.x0 + o.x1) / 2
    const w = o.x1 - o.x0
    if (o.bottom > WALL_BASE) {
      const h = o.bottom - WALL_BASE
      box.push(part([cx, WALL_BASE + h / 2, frontZ], [w, h, WALL_T], [0, 0, 0], c.wall))
    }
    const hTop = WALL_TOP - o.top
    box.push(part([cx, o.top + hTop / 2, frontZ], [w, hTop, WALL_T], [0, 0, 0], c.wall))
    // frame
    box.push(part([cx, o.top + 0.05, FRONT_Z + 0.03], [w + 0.22, 0.1, 0.08], [0, 0, 0], c.trim))
    box.push(part([o.x0 - 0.05, (o.bottom + o.top) / 2, FRONT_Z + 0.03], [0.1, o.top - o.bottom, 0.08], [0, 0, 0], c.trim))
    box.push(part([o.x1 + 0.05, (o.bottom + o.top) / 2, FRONT_Z + 0.03], [0.1, o.top - o.bottom, 0.08], [0, 0, 0], c.trim))
    if (o.bottom > WALL_BASE) {
      box.push(part([cx, o.bottom - 0.04, FRONT_Z + 0.08], [w + 0.3, 0.08, 0.22], [0, 0, 0], c.trim))
      // shutters swung open flat against the wall
      box.push(part([o.x0 - 0.38, (o.bottom + o.top) / 2, FRONT_Z + 0.05], [0.56, o.top - o.bottom, 0.06], [0, 0, 0], c.shutter))
      box.push(part([o.x1 + 0.38, (o.bottom + o.top) / 2, FRONT_Z + 0.05], [0.56, o.top - o.bottom, 0.06], [0, 0, 0], c.shutter))
    }
  }
  // dark interior seen through the openings
  box.push(part([0, WALL_MID, FRONT_Z - 0.4], [W - 0.4, WALL_H - 0.05, 0.05], [0, 0, 0], INTERIOR))

  // vertical plank seams
  for (let x = -3.85; x <= 3.86; x += 0.45) {
    box.push(part([x, WALL_MID, -D / 2 - 0.01], [0.05, WALL_H, 0.03], [0, 0, 0], c.wallDark))
    const blocked = openings.some((o) => x > o.x0 - 0.08 && x < o.x1 + 0.45)
    if (!blocked) {
      box.push(part([x, WALL_MID, FRONT_Z + 0.01], [0.05, WALL_H, 0.03], [0, 0, 0], c.wallDark))
    }
  }
  for (let z = -3.2; z <= 3.21; z += 0.45) {
    if (Math.abs(z) < 0.85) continue // side windows
    box.push(part([W / 2 + 0.01, WALL_MID, z], [0.03, WALL_H, 0.05], [0, 0, 0], c.wallDark))
    box.push(part([-W / 2 - 0.01, WALL_MID, z], [0.03, WALL_H, 0.05], [0, 0, 0], c.wallDark))
  }

  // side windows with shutters
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.02)
    box.push(part([x, 2.7, 0], [0.04, 1.1, 1.2], [0, 0, 0], INTERIOR))
    box.push(part([x + side * 0.03, 2.7, 0.92], [0.06, 1.1, 0.56], [0, 0, 0], c.shutter))
    box.push(part([x + side * 0.03, 2.7, -0.92], [0.06, 1.1, 0.56], [0, 0, 0], c.shutter))
    box.push(part([x + side * 0.06, 2.12, 0], [0.2, 0.08, 1.4], [0, 0, 0], c.trim))
  }

  // ventilation band (kekisi) under the roof
  box.push(part([0, WALL_TOP - 0.15, FRONT_Z + 0.03], [W + 0.05, 0.22, 0.05], [0, 0, 0], c.trim))
  box.push(part([0, WALL_TOP - 0.15, -D / 2 - 0.03], [W + 0.05, 0.22, 0.05], [0, 0, 0], c.trim))

  // --- Gable (attic) and tebar layar
  prism.push(part([0, WALL_TOP, 0], [W + 0.1, ROOF_RISE, D], [0, 0, 0], c.wall))
  prism.push(part([0, WALL_TOP + 0.08, FRONT_Z + 0.06], [W - 0.7, ROOF_RISE - 0.35, 0.08], [0, 0, 0], c.gable))
  for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) {
    const h = (ROOF_RISE - 0.5) * (1 - Math.abs(x) / ((W - 0.7) / 2))
    box.push(part([x, WALL_TOP + 0.1 + h / 2, FRONT_Z + 0.11], [0.06, h, 0.03], [0, 0, 0], c.wallDark))
  }
  box.push(part([0, WALL_TOP + 1.05, FRONT_Z + 0.13], [0.45, 0.45, 0.05], [0, 0, Math.PI / 4], INTERIOR))

  // --- Roof planes
  const halfWidth = W / 2 + 0.05
  const angle = Math.atan2(ROOF_RISE, halfWidth)
  const slope = Math.hypot(halfWidth, ROOF_RISE)
  const overhang = 0.9
  const len = slope + overhang
  const outX = Math.cos(angle) * (overhang / 2) + Math.sin(angle) * 0.07
  const outY = -Math.sin(angle) * (overhang / 2) + Math.cos(angle) * 0.07
  for (const side of [-1, 1]) {
    box.push(
      part(
        [side * (halfWidth / 2 + outX), WALL_TOP + ROOF_RISE / 2 + outY, 0],
        [len, 0.12, D + 1.4],
        [0, 0, -side * angle],
        c.roof,
      ),
    )
  }
  box.push(part([0, WALL_TOP + ROOF_RISE + 0.08, 0], [0.32, 0.16, D + 1.5], [0, 0, 0], c.ridge))

  // --- Serambi (porch)
  const porchY = 1.2
  const porchZ0 = FRONT_Z
  const porchZ1 = FRONT_Z + 2.6
  const porchMid = (porchZ0 + porchZ1) / 2
  box.push(part([0, porchY, porchMid], [W - 2, 0.15, porchZ1 - porchZ0], [0, 0, 0], FLOOR))
  for (const x of [-2.9, 2.9]) {
    for (const z of [porchZ0 + 0.1, porchZ1 - 0.1]) {
      cylinder.push(part([x, 1.65, z], [0.18, 3.3, 0.18], [0, 0, 0], STILT))
    }
  }
  // balusters
  for (let x = -2.75; x <= 2.76; x += 0.3) {
    if (Math.abs(x) < 0.85) continue // stair opening
    box.push(part([x, porchY + 0.42, porchZ1 - 0.1], [0.06, 0.7, 0.06], [0, 0, 0], c.trim))
  }
  for (let z = porchZ0 + 0.35; z < porchZ1 - 0.2; z += 0.3) {
    box.push(part([-2.9, porchY + 0.42, z], [0.06, 0.7, 0.06], [0, 0, 0], c.trim))
    box.push(part([2.9, porchY + 0.42, z], [0.06, 0.7, 0.06], [0, 0, 0], c.trim))
  }
  box.push(part([-1.85, porchY + 0.8, porchZ1 - 0.1], [2.1, 0.08, 0.12], [0, 0, 0], c.wallDark))
  box.push(part([1.85, porchY + 0.8, porchZ1 - 0.1], [2.1, 0.08, 0.12], [0, 0, 0], c.wallDark))
  box.push(part([-2.9, porchY + 0.8, porchMid], [0.12, 0.08, porchZ1 - porchZ0], [0, 0, 0], c.wallDark))
  box.push(part([2.9, porchY + 0.8, porchMid], [0.12, 0.08, porchZ1 - porchZ0], [0, 0, 0], c.wallDark))
  // porch roof (lean-to)
  const porchRoofDrop = 0.5
  const porchRoofRun = 3.1
  box.push(
    part(
      [0, 3.4, porchZ0 + porchRoofRun / 2],
      [W - 1.2, 0.1, Math.hypot(porchRoofRun, porchRoofDrop)],
      [Math.atan2(porchRoofDrop, porchRoofRun), 0, 0],
      c.roof,
    ),
  )

  // --- Stairs (tangga)
  const stepRise = porchY / 5
  const tread = 0.35
  for (let k = 1; k <= 5; k++) {
    const z = porchZ1 + (5 - k) * tread + tread / 2
    box.push(part([0, stepRise * k - 0.05, z], [1.5, 0.1, tread + 0.02], [0, 0, 0], c.wallDark))
  }
  const stairRun = 5 * tread
  const stringerLen = Math.hypot(stairRun, porchY)
  const stringerAngle = Math.atan2(porchY, stairRun)
  for (const x of [-0.78, 0.78]) {
    box.push(
      part([x, porchY / 2, porchZ1 + stairRun / 2], [0.08, 0.26, stringerLen], [stringerAngle, 0, 0], STILT),
    )
  }

  // --- Tempayan (water jar) by the stairs
  ball.push(part([1.6, 0.38, porchZ1 + 1.4], [0.7, 0.78, 0.7], [0, 0, 0], '#6a3b22'))
  cylinder.push(part([1.6, 0.8, porchZ1 + 1.4], [0.42, 0.12, 0.42], [0, 0, 0], '#5a311c'))
  ball.push(part([-1.7, 0.25, porchZ1 + 1.1], [0.5, 0.5, 0.5], [0, 0, 0], '#b5683c'))
  ball.push(part([-1.7, 0.62, porchZ1 + 1.1], [0.7, 0.45, 0.7], [0, 0, 0], '#4f8a3a'))

  return { box, cylinder, prism, ball }
}

/** Footprint collider in local space (house body + porch + stairs). */
export const HOUSE_COLLIDER = { halfExtents: [4.4, 1.6, 5.8], center: [0, 1.6, 2.1] }

export function House({ position, rotationY = 0, variant = 'tokwan', index = 0 }) {
  const bundle = useMemo(() => buildHouseParts(variant), [variant])
  // neighbours cycle through the house models, when there are any
  const urls = MODELS.rumah.urls
  const modelUrl = variant === 'tokwan' ? MODELS.tokwan.url : urls.length ? urls[index % urls.length] : null

  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CuboidCollider args={HOUSE_COLLIDER.halfExtents} position={HOUSE_COLLIDER.center} />
      <ModelSlot model={variant === 'tokwan' ? MODELS.tokwan : MODELS.rumah} url={modelUrl} fallback={<PartsBundle bundle={bundle} />} />
      {/* interior seen through doors and windows: lamplit at night */}
      <mesh position={[0, WALL_MID, FRONT_Z - 0.37]} material={MAT.glow}>
        <planeGeometry args={[W - 0.5, WALL_H - 0.1]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 2 + 0.045), 2.7, 0]} rotation={[0, side * (Math.PI / 2), 0]} material={MAT.glow}>
          <planeGeometry args={[1.18, 1.08]} />
        </mesh>
      ))}
      <mesh position={[0, WALL_TOP + 1.05, FRONT_Z + 0.16]} rotation={[0, 0, Math.PI / 4]} material={MAT.glow}>
        <planeGeometry args={[0.43, 0.43]} />
      </mesh>
    </RigidBody>
  )
}
