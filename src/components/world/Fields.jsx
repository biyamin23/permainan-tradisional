import { useMemo } from 'react'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import {
  BOUNDS,
  FIELD,
  PONDOK_SAWAH,
  SAWAH,
  SCARECROW,
  isNearGameSpot,
  isOnRoad,
  isReserved,
} from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { createRandom, part, pick, randomBetween } from './kit'
import { Wakaf } from './Wakaf'

const GRASS = ['#6f9a3f', '#7aa646', '#5f8a37', '#86ad4c', '#93b356']
const PADI = ['#c9c45a', '#d8c25a', '#b9c257', '#e2c862', '#cdb84f']

function buildGrassTufts() {
  const random = createRandom(31)
  const blade = []
  let placed = 0
  let attempts = 0
  while (placed < 1500 && attempts < 9000) {
    attempts++
    const x = randomBetween(random, BOUNDS.xMin, BOUNDS.xMax)
    const z = randomBetween(random, BOUNDS.zMin, BOUNDS.zMax)
    const inField = (x - FIELD.center[0]) ** 2 + (z - FIELD.center[1]) ** 2 < (FIELD.radius - 1) ** 2
    if (inField ? isNearGameSpot(x, z, -0.5) : isReserved(x, z, 0.3)) continue
    const h = randomBetween(random, 0.25, 0.55)
    blade.push(part([x, 0, z], [0.16, h, 0.16], [randomBetween(random, -0.3, 0.3), random() * 3, randomBetween(random, -0.3, 0.3)], pick(random, GRASS)))
    placed++
  }
  return { blade }
}

function buildSawah() {
  const random = createRandom(57)
  const blade = []
  const box = []
  const [px, , pz] = PONDOK_SAWAH.position
  for (let x = SAWAH.xMin + 0.6; x < SAWAH.xMax; x += 1.05) {
    for (let z = SAWAH.zMin + 0.6; z < SAWAH.zMax; z += 0.95) {
      if (isOnRoad(x, z, 1)) continue
      if ((x - px) ** 2 + (z - pz) ** 2 < 16) continue
      if ((x - SCARECROW.position[0]) ** 2 + (z - SCARECROW.position[2]) ** 2 < 2.5) continue
      if (Math.abs(((z - SAWAH.zMax) % 4.5) + 4.5) % 4.5 < 0.7) continue // batas paths
      if (Math.abs(((x - SAWAH.xMin) % 11) + 11) % 11 < 0.7) continue
      const jx = x + randomBetween(random, -0.2, 0.2)
      const jz = z + randomBetween(random, -0.2, 0.2)
      const h = randomBetween(random, 0.75, 1.05)
      blade.push(part([jx, 0, jz], [0.3, h, 0.3], [randomBetween(random, -0.15, 0.15), random() * 3, randomBetween(random, -0.15, 0.15)], pick(random, PADI)))
    }
  }
  // batas (bunds) between plots
  const width = SAWAH.xMax - SAWAH.xMin
  for (let z = SAWAH.zMax; z >= SAWAH.zMin; z -= 4.5) {
    box.push(part([(SAWAH.xMin + SAWAH.xMax) / 2, 0.06, z + 0.35], [width, 0.14, 0.55], [0, 0, 0], '#8f7a45'))
  }
  for (let x = SAWAH.xMin; x <= SAWAH.xMax; x += 11) {
    box.push(part([x + 0.35, 0.06, (SAWAH.zMin + SAWAH.zMax) / 2], [0.55, 0.14, SAWAH.zMax - SAWAH.zMin], [0, 0, 0], '#8f7a45'))
  }
  box.push(part([SAWAH.xMin, 0.06, (SAWAH.zMin + SAWAH.zMax) / 2], [0.55, 0.14, SAWAH.zMax - SAWAH.zMin], [0, 0, 0], '#8f7a45'))
  box.push(part([SAWAH.xMax, 0.06, (SAWAH.zMin + SAWAH.zMax) / 2], [0.55, 0.14, SAWAH.zMax - SAWAH.zMin], [0, 0, 0], '#8f7a45'))
  // muddy water between rows, catching the sunset
  box.push(part([(SAWAH.xMin + SAWAH.xMax) / 2, 0.015, (SAWAH.zMin + SAWAH.zMax) / 2], [width, 0.01, SAWAH.zMax - SAWAH.zMin], [0, 0, 0], '#7d8a55'))
  return { blade, box }
}

function buildScarecrow() {
  const [x, , z] = SCARECROW.position
  const box = []
  const cylinder = []
  const ball = []
  const pyramid = []
  cylinder.push(part([x, 1.1, z], [0.12, 2.2, 0.12], [0, 0, 0], '#6b4a2e'))
  box.push(part([x, 1.55, z], [1.9, 0.1, 0.1], [0, 0, 0.05], '#6b4a2e'))
  box.push(part([x, 1.35, z], [0.62, 0.75, 0.32], [0, 0, 0], '#3a6ea5'))
  box.push(part([x - 0.62, 1.52, z], [0.62, 0.2, 0.22], [0, 0, 0.1], '#3a6ea5'))
  box.push(part([x + 0.62, 1.52, z], [0.62, 0.2, 0.22], [0, 0, -0.1], '#3a6ea5'))
  box.push(part([x, 0.92, z], [0.55, 0.25, 0.3], [0, 0, 0], '#7a5a3a'))
  ball.push(part([x, 2.0, z], [0.42, 0.44, 0.42], [0, 0, 0], '#e3cf9c'))
  cylinder.push(part([x, 2.2, z], [0.95, 0.05, 0.95], [0, 0, 0], '#c9a35a'))
  pyramid.push(part([x, 2.2, z], [0.6, 0.3, 0.6], [0, 0, 0], '#c9a35a'))
  return { box, cylinder, ball, pyramid }
}

export function Fields() {
  const grass = useMemo(buildGrassTufts, [])
  const sawah = useMemo(buildSawah, [])
  const scarecrow = useMemo(buildScarecrow, [])

  return (
    <group>
      <PartsBundle bundle={grass} castShadow={false} />
      <PartsBundle bundle={sawah} castShadow={false} />
      <PartsBundle bundle={scarecrow} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1, 0.25]} position={[SCARECROW.position[0], 1, SCARECROW.position[2]]} />
      </RigidBody>
      <Wakaf position={PONDOK_SAWAH.position} rotationY={-Math.PI / 2} roof="#9b7a4a" />
    </group>
  )
}
