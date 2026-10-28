import { ROADS } from '../../../data/kampungLayout'

/**
 * Where villagers can walk: the dirt roads (and their bridges) as a graph.
 * A walk goes from where you stand, straight onto the nearest road, along the
 * roads to the one nearest the destination, and straight off it again, so
 * places are chosen with a clear line to their road (see data/villagers.js).
 * Built once; a route is a handful of points, worked out only when a
 * villager decides to go somewhere (every few seconds at most).
 */

const nodes = [] // { x, z, edges: [{ to, len }] }
const segments = [] // { a, b, road }
const index = new Map()

function nodeAt(x, z) {
  const key = `${x.toFixed(2)},${z.toFixed(2)}`
  let i = index.get(key)
  if (i === undefined) {
    i = nodes.length
    nodes.push({ x, z, edges: [] })
    index.set(key, i)
  }
  return i
}

for (const road of ROADS) {
  for (let k = 0; k < road.points.length - 1; k++) {
    const a = nodeAt(...road.points[k])
    const b = nodeAt(...road.points[k + 1])
    const len = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].z - nodes[a].z)
    nodes[a].edges.push({ to: b, len })
    nodes[b].edges.push({ to: a, len })
    segments.push({ a, b, road })
  }
}

/** The nearest point on any road: { x, z, seg, t }. */
export function nearestRoadPoint(x, z) {
  let best = null
  for (let s = 0; s < segments.length; s++) {
    const A = nodes[segments[s].a]
    const B = nodes[segments[s].b]
    const dx = B.x - A.x
    const dz = B.z - A.z
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / len2))
    const px = A.x + dx * t
    const pz = A.z + dz * t
    const d = Math.hypot(x - px, z - pz)
    if (!best || d < best.d) best = { x: px, z: pz, seg: s, t, d }
  }
  return best
}

/** Dijkstra from a point on one segment to a point on another (graph is ~40 nodes). */
function roadPath(from, to) {
  if (from.seg === to.seg) return [[from.x, from.z], [to.x, to.z]]
  const n = nodes.length
  const START = n
  const END = n + 1
  const dist = new Array(n + 2).fill(Infinity)
  const prev = new Array(n + 2).fill(-1)
  const done = new Array(n + 2).fill(false)
  const fs = segments[from.seg]
  const ts = segments[to.seg]
  const edgesOf = (i) => {
    if (i === START) {
      const A = nodes[fs.a]
      const B = nodes[fs.b]
      return [
        { to: fs.a, len: Math.hypot(A.x - from.x, A.z - from.z) },
        { to: fs.b, len: Math.hypot(B.x - from.x, B.z - from.z) },
      ]
    }
    const out = i < n ? [...nodes[i].edges] : []
    if (i === ts.a || i === ts.b) out.push({ to: END, len: Math.hypot(nodes[i].x - to.x, nodes[i].z - to.z) })
    return out
  }
  dist[START] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < n + 2; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i
    if (u < 0 || u === END) break
    done[u] = true
    for (const e of edgesOf(u)) {
      const d = dist[u] + e.len
      if (d < dist[e.to]) {
        dist[e.to] = d
        prev[e.to] = u
      }
    }
  }
  const chain = []
  for (let i = END; i !== -1; i = prev[i]) chain.push(i)
  chain.reverse()
  return chain.map((i) => (i === START ? [from.x, from.z] : i === END ? [to.x, to.z] : [nodes[i].x, nodes[i].z]))
}

/**
 * A walk from (fx, fz) to (tx, tz): off-road legs straight, road legs kept to
 * the left-hand edge of the road (where people walk in the kampung, clear of
 * Pak Mat's bicycle), so two villagers passing each other don't collide.
 * Returns [[x, z], …].
 */
export function planWalk(fx, fz, tx, tz, { edge = 0.55 } = {}) {
  if (Math.hypot(tx - fx, tz - fz) < 7) return [[tx, tz]]
  const a = nearestRoadPoint(fx, fz)
  const b = nearestRoadPoint(tx, tz)
  const road = roadPath(a, b)
  const out = []
  for (let k = 0; k < road.length - 1; k++) {
    const [ax, az] = road[k]
    const [bx, bz] = road[k + 1]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 0.01) continue
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    const width = segments[k === 0 ? a.seg : k === road.length - 2 ? b.seg : nearestRoadPoint((ax + bx) / 2, (az + bz) / 2).seg].road.width
    const off = Math.max(0.6, width / 2 - edge)
    out.push([ax - dz * off, az + dx * off], [bx - dz * off, bz + dx * off])
  }
  out.push([tx, tz])
  return out
}
