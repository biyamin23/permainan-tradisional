import { games } from './games'
import { MAP_SIZE, px, toMap } from './mapCoords'

/**
 * Where everything is in the kampung, laid out after the illustrated map (see
 * mapCoords.js): written in map pixels, converted to metres with px().
 */
export { MAP_SIZE, px, toMap }

const rectPx = (u0, v0, u1, v1) => {
  const [xMin, zMin] = px(u0, v0)
  const [xMax, zMax] = px(u1, v1)
  return { xMin, xMax, zMin, zMax }
}
const line = (points) => points.map(([u, v]) => px(u, v))

const [spawnX, spawnZ] = px(650, 492)
export const SPAWN = [spawnX, 1, spawnZ]

export const BOUNDS = rectPx(8, 8, 1528, 1016)

// ---------------------------------------------------------------- roads
/** Dirt roads as polylines (width in metres). */
export const ROADS = [
  {
    id: 'jalan-kampung',
    width: 3.8,
    points: line([
      [20, 590], [110, 525], [165, 470], [255, 420], [370, 402], [470, 440], [600, 470], [720, 515],
      [830, 556], [1000, 565], [1120, 545], [1260, 522], [1420, 518], [1530, 510],
    ]),
  },
  { id: 'ke-sekolah', width: 3, points: line([[720, 515], [758, 430], [815, 345], [900, 300]]) },
  { id: 'lorong', width: 2.6, points: line([[1000, 565], [1058, 470], [1098, 392], [1070, 322], [962, 288], [900, 300]]) },
  { id: 'ke-selatan', width: 3, points: line([[720, 515], [702, 610], [662, 702], [632, 800], [598, 900], [570, 1010]]) },
  { id: 'lorong-timur', width: 2.4, points: line([[1000, 565], [985, 660], [990, 760], [1040, 805]]) },
  { id: 'denai-air-terjun', width: 2, points: line([[470, 440], [478, 340], [470, 262]]) },
]

// ---------------------------------------------------------------- water
/** Rivers as polylines (width in metres), flowing from the first point. */
export const RIVERS = [
  {
    id: 'anak-sungai',
    width: 4.2,
    points: line([[486, 214], [446, 262], [366, 298], [246, 308], [126, 298], [-30, 290]]),
  },
  {
    id: 'sungai',
    width: 7,
    points: line([
      [-30, 466], [110, 486], [250, 512], [400, 538], [530, 568], [572, 640], [622, 700], [730, 760],
      [860, 815], [1000, 868], [1150, 893], [1290, 860], [1370, 772], [1396, 662], [1452, 580], [1560, 540],
    ]),
  },
]
export const WATERFALL = { at: px(486, 196), width: 5, height: 5 }

// ---------------------------------------------------------------- geometry helpers
function closestOnSegment(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2))
  return { x: ax + dx * t, z: az + dz * t, t }
}

/** Distance from (x, z) to a polyline, plus the segment index. */
export function distanceToLine(x, z, points) {
  let best = Infinity
  let index = 0
  for (let i = 0; i < points.length - 1; i++) {
    const c = closestOnSegment(x, z, points[i], points[i + 1])
    const d = Math.hypot(x - c.x, z - c.z)
    if (d < best) {
      best = d
      index = i
    }
  }
  return { distance: best, index }
}

export const isOnRoad = (x, z, margin = 0) => ROADS.some((r) => distanceToLine(x, z, r.points).distance < r.width / 2 + margin)

/** Distance from (x, z) to the nearest river bank (negative inside the water). */
export function distanceToRiver(x, z) {
  let best = Infinity
  for (const r of RIVERS) best = Math.min(best, distanceToLine(x, z, r.points).distance - r.width / 2)
  return best
}

function segmentIntersection([ax, az], [bx, bz], [cx, cz], [dx, dz]) {
  const r = [bx - ax, bz - az]
  const s = [dx - cx, dz - cz]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return null
  const t = ((cx - ax) * s[1] - (cz - az) * s[0]) / den
  const u = ((cx - ax) * r[1] - (cz - az) * r[0]) / den
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: ax + r[0] * t, z: az + r[1] * t, road: r }
}

/** A bridge wherever a road crosses a river, plus footbridges drawn on the map. */
function findBridges() {
  const bridges = []
  for (const road of ROADS) {
    for (const river of RIVERS) {
      for (let i = 0; i < road.points.length - 1; i++) {
        for (let j = 0; j < river.points.length - 1; j++) {
          const hit = segmentIntersection(road.points[i], road.points[i + 1], river.points[j], river.points[j + 1])
          if (!hit) continue
          bridges.push({
            x: hit.x,
            z: hit.z,
            rotationY: Math.atan2(hit.road[0], hit.road[1]),
            length: river.width + 3.2,
            width: Math.max(3.2, road.width + 0.4),
          })
        }
      }
    }
  }
  // the little footbridge near Konda Kondi
  const sungai = RIVERS[1].points
  const [fx, fz] = px(1372, 768)
  const { index } = distanceToLine(fx, fz, sungai)
  const [ax, az] = sungai[index]
  const [bx, bz] = sungai[index + 1]
  bridges.push({ x: fx, z: fz, rotationY: Math.atan2(bx - ax, bz - az) + Math.PI / 2, length: RIVERS[1].width + 3, width: 2.4 })
  return bridges
}
export const BRIDGES = findBridges()

/** True on a bridge deck. */
export function isOnBridge(x, z) {
  return BRIDGES.some((b) => {
    const dx = x - b.x
    const dz = z - b.z
    const along = dx * Math.sin(b.rotationY) + dz * Math.cos(b.rotationY)
    const across = dx * Math.cos(b.rotationY) - dz * Math.sin(b.rotationY)
    return Math.abs(along) < b.length / 2 && Math.abs(across) < b.width / 2
  })
}

// ---------------------------------------------------------------- areas
export const SAWAH = rectPx(24, 322, 320, 404)
export const KEBUN_KELAPA = rectPx(560, 58, 832, 214)
export const HUTAN = rectPx(330, 16, 560, 186)
export const PADANG_LAPANG = rectPx(980, 70, 1340, 236)
export const PADANG_SEPAK = rectPx(1120, 246, 1330, 330)
export const PADANG_GALAH = rectPx(110, 600, 420, 760)
export const PASIR_GULI = rectPx(240, 790, 460, 905)
export const TAMAN = rectPx(780, 360, 960, 470)
export const LAMAN_GASING = { center: px(760, 642), radius: 6.5 }

/** Open grass areas drawn lighter on the ground. */
export const OPEN_AREAS = [PADANG_LAPANG, PADANG_SEPAK, PADANG_GALAH, TAMAN]

// ---------------------------------------------------------------- buildings
const at = (u, v, rotationY = 0) => {
  const [x, z] = px(u, v)
  return { position: [x, 0, z], rotationY }
}

/** Tok Wan's house; Congkak is played on its serambi. Front faces +z (south). */
export const HOUSE = at(500, 352)
export const SCHOOL = at(900, 222)
export const WARUNG = at(1176, 500)

export const NEIGHBOUR_HOUSES = [
  { ...at(600, 250, 0.15), variant: 'biru' },
  { ...at(262, 236, -0.1), variant: 'kelabu' },
  { ...at(668, 566, 0.3), variant: 'hijau' },
  { ...at(1000, 408, -Math.PI / 2), variant: 'biru' },
  { ...at(1248, 396, Math.PI), variant: 'kelabu' },
  { ...at(1290, 650, -Math.PI / 2), variant: 'hijau' },
  { ...at(96, 600, Math.PI / 2), variant: 'kelabu' },
  { ...at(830, 700, Math.PI), variant: 'biru' },
  { ...at(520, 868, Math.PI / 2), variant: 'hijau' },
]

/** Fence around Tok Wan's yard, as [x1, z1, x2, z2] segments (world metres). */
const [hx, hz] = [HOUSE.position[0], HOUSE.position[2]]
export const YARD_FENCE = [
  [hx - 9, hz - 6, hx - 9, hz + 9],
  [hx + 9, hz - 6, hx + 9, hz + 5],
  [hx - 9, hz - 6, hx + 9, hz - 6],
]
export const YARD = { xMin: hx - 9, xMax: hx + 9, zMin: hz - 6, zMax: hz + 9 }

// ---------------------------------------------------------------- small places
const [pondX, pondZ] = px(300, 525)
/** Where the ducks paddle: a slow bend of the river. */
export const POND = { center: [pondX, pondZ], radius: 3 }
export const PONDOK_SAWAH = at(300, 362)
export const SCARECROW = at(120, 362)
export const CLOTHESLINE = at(420, 400)
/** For the grass scatter: the main padang. */
export const FIELD = { center: px(265, 680), radius: 14 }

// ---------------------------------------------------------------- reservations
const near = (x, z, cx, cz, r) => (x - cx) ** 2 + (z - cz) ** 2 < r * r
const inRect = (x, z, r, m = 0) => x > r.xMin - m && x < r.xMax + m && z > r.zMin - m && z < r.zMax + m

/** True when (x, z) is on or next to one of the game spots. */
export const isNearGameSpot = (x, z, margin = 1) =>
  games.some(({ spot }) => near(x, z, spot.position[0], spot.position[1], spot.radius + margin))

const BUILDINGS = [
  { ...HOUSE, r: 9 },
  { ...SCHOOL, r: 13 },
  { ...WARUNG, r: 6 },
  ...NEIGHBOUR_HOUSES.map((h) => ({ ...h, r: 7.5 })),
]

/** Areas where scattered trees/props should not be placed. */
export function isReserved(x, z, margin = 1) {
  if (isOnRoad(x, z, margin + 0.5)) return true
  if (distanceToRiver(x, z) < margin + 1.2) return true
  if (near(x, z, WATERFALL.at[0], WATERFALL.at[1], 5 + margin)) return true
  if (isNearGameSpot(x, z, margin + 0.5)) return true
  if (near(x, z, SPAWN[0], SPAWN[2], 5 + margin)) return true
  if (inRect(x, z, YARD, margin)) return true
  if (inRect(x, z, SAWAH, margin)) return true
  for (const area of OPEN_AREAS) if (inRect(x, z, area, margin)) return true
  if (inRect(x, z, PASIR_GULI, margin)) return true
  if (near(x, z, LAMAN_GASING.center[0], LAMAN_GASING.center[1], LAMAN_GASING.radius + margin)) return true
  for (const b of BUILDINGS) if (near(x, z, b.position[0], b.position[2], b.r + margin)) return true
  if (near(x, z, PONDOK_SAWAH.position[0], PONDOK_SAWAH.position[2], 4 + margin)) return true
  return false
}

/**
 * Where to put the player when travelling to a game from the Peta: a spot on
 * the ring around the game that is dry and clear of buildings, preferring
 * the south side. `yaw` puts the camera behind you, looking at the game.
 */
export function arrivalFor(game) {
  const [sx, sz] = game.spot.position
  for (const dist of [game.spot.radius + 2.5, game.spot.radius + 4.5, game.spot.radius + 7]) {
    for (let k = 0; k < 16; k++) {
      const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8)
      const x = sx + Math.sin(a) * dist
      const z = sz + Math.cos(a) * dist
      if (x < BOUNDS.xMin + 2 || x > BOUNDS.xMax - 2 || z < BOUNDS.zMin + 2 || z > BOUNDS.zMax - 2) continue
      if (distanceToRiver(x, z) < 2) continue
      if (BUILDINGS.some((b) => near(x, z, b.position[0], b.position[2], b.r - 1.5))) continue
      // the camera sits ~9 m further back: keep it out of houses too
      const cx = sx + Math.sin(a) * (dist + 9)
      const cz = sz + Math.cos(a) * (dist + 9)
      if (BUILDINGS.some((b) => near(cx, cz, b.position[0], b.position[2], b.r + 1))) continue
      return { x, z, yaw: a }
    }
  }
  return { x: sx, z: sz + game.spot.radius + 2.5, yaw: 0 }
}
