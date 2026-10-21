/**
 * Single source of truth for where things are in the kampung.
 * World units are metres. +z points "south" (towards the spawn point),
 * -z points "north" (towards the stream and the sawah).
 */

export const SPAWN = [0, 1, 24]

export const BOUNDS = { xMin: -70, xMax: 70, zMin: -80, zMax: 56 }

/** Dirt roads as axis-aligned rectangles: centre (x, z), size (w along x, d along z). */
export const ROADS = [
  { x: 0, z: -12, w: 3.6, d: 132 }, // main kampung road, crosses the bridge
  { x: -7.4, z: 6, w: 11.2, d: 2.6 }, // to Tok Wan's house
  { x: -13, z: 4.9, w: 1.9, d: 2.4 }, // up to the stairs
  { x: 3.6, z: -6, w: 4.4, d: 2.6 }, // to the padang
]

export const HOUSE = { position: [-13, 0, -4], rotationY: 0 }

export const NEIGHBOUR_HOUSES = [
  { position: [26, 0, 24], rotationY: -Math.PI / 2, variant: 'biru' },
  { position: [-32, 0, 28], rotationY: Math.PI / 2, variant: 'kelabu' },
  { position: [-34, 0, -46], rotationY: Math.PI / 2, variant: 'hijau' },
]

/** Fence around Tok Wan's yard, as [x1, z1, x2, z2] axis-aligned segments. */
export const YARD_FENCE = [
  [-23, -11, -5, -11],
  [-23, -11, -23, 9],
  [-23, 9, -5, 9],
  [-5, -11, -5, 4.6],
  [-5, 7.4, -5, 9],
]

export const YARD = { xMin: -23, xMax: -5, zMin: -11, zMax: 9 }

export const FIELD = { center: [16, -6], radius: 12 }

export const WAKAF = { position: [25, 0, -13] }

export const POND = { center: [-15, 18], radius: 4.2 }

export const STREAM = { z: -26, width: 5 }

export const BRIDGE = { x: 0, z: -26, width: 3.4, length: 7.4 }

export const SAWAH = { xMin: -24, xMax: 40, zMin: -74, zMax: -32 }

export const PONDOK_SAWAH = { position: [-29, 0, -37] }

export const SCARECROW = { position: [15, 0, -52] }

export const CLOTHESLINE = { position: [-19, 0, 4] }

const inRect = (x, z, rect, margin) =>
  Math.abs(x - rect.x) < rect.w / 2 + margin && Math.abs(z - rect.z) < rect.d / 2 + margin

export const isOnRoad = (x, z, margin = 0) => ROADS.some((road) => inRect(x, z, road, margin))

const near = (x, z, cx, cz, r) => (x - cx) ** 2 + (z - cz) ** 2 < r * r

/** Areas where scattered trees/props should not be placed. */
export function isReserved(x, z, margin = 1) {
  if (isOnRoad(x, z, margin + 0.5)) return true
  if (Math.abs(z - STREAM.z) < STREAM.width / 2 + margin + 1) return true
  if (near(x, z, FIELD.center[0], FIELD.center[1], FIELD.radius + margin)) return true
  if (near(x, z, POND.center[0], POND.center[1], POND.radius + margin + 1)) return true
  if (near(x, z, WAKAF.position[0], WAKAF.position[2], 4 + margin)) return true
  if (near(x, z, SPAWN[0], SPAWN[2], 5 + margin)) return true
  if (
    x > YARD.xMin - margin &&
    x < YARD.xMax + margin &&
    z > YARD.zMin - margin &&
    z < YARD.zMax + margin
  ) {
    return true
  }
  if (
    x > SAWAH.xMin - margin &&
    x < SAWAH.xMax + margin &&
    z > SAWAH.zMin - margin &&
    z < SAWAH.zMax + margin
  ) {
    return true
  }
  for (const house of NEIGHBOUR_HOUSES) {
    if (near(x, z, house.position[0], house.position[2], 9 + margin)) return true
  }
  if (near(x, z, PONDOK_SAWAH.position[0], PONDOK_SAWAH.position[2], 4 + margin)) return true
  return false
}
