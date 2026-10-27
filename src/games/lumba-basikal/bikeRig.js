import { BufferAttribute, BufferGeometry, Group, Mesh, Quaternion, Vector3 } from 'three'

/**
 * The basikal GLBs are one merged mesh each (no separate wheel, pedal or
 * handlebar nodes), but every part is its own connected piece of the mesh.
 * So we split it once per model, by shape:
 *
 *   wheels  discs standing on the ground (tyre) + everything inside them
 *           (rim, spokes, hub); the extra small ones are the roda sisi
 *   crank   the chainring disc at the bottom bracket + the cranks/pedals around it
 *   steer   fork, handlebar, front basket/mudguard: everything at the front
 *           that isn't a long frame tube; turns about the head-tube axis
 *   frame   the rest
 *
 * The split geometries are cached per model; each bike on screen is a new
 * set of groups sharing them.
 */

const cache = new Map()
// ?debug: inspect how each model was split
if (typeof window !== 'undefined' && window.location.search.includes('debug')) window.__bikeParts = cache

function components(position, index) {
  const parent = new Int32Array(position.count).map((_, i) => i)
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }
  for (let t = 0; t < index.count; t += 3) {
    const a = find(index.getX(t))
    parent[find(index.getX(t + 1))] = a
    parent[find(index.getX(t + 2))] = a
  }
  const byRoot = new Map()
  for (let t = 0; t < index.count; t += 3) {
    const r = find(index.getX(t))
    let c = byRoot.get(r)
    if (!c) {
      c = { tris: [], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }
      byRoot.set(r, c)
    }
    c.tris.push(t)
    for (let k = 0; k < 3; k++) {
      const v = index.getX(t + k)
      const p = [position.getX(v), position.getY(v), position.getZ(v)]
      for (let i = 0; i < 3; i++) {
        if (p[i] < c.lo[i]) c.lo[i] = p[i]
        if (p[i] > c.hi[i]) c.hi[i] = p[i]
      }
    }
  }
  return [...byRoot.values()].map((c) => ({
    ...c,
    c: c.lo.map((v, i) => (v + c.hi[i]) / 2),
    s: c.lo.map((v, i) => c.hi[i] - v),
  }))
}

/** New geometry from some triangles of `src`, moved so `pivot` is the origin. */
function extract(src, parts, pivot) {
  const index = src.index
  const remap = new Map()
  const out = []
  for (const part of parts) {
    for (const t of part.tris) {
      for (let k = 0; k < 3; k++) {
        const v = index.getX(t + k)
        if (!remap.has(v)) remap.set(v, remap.size)
        out.push(remap.get(v))
      }
    }
  }
  const g = new BufferGeometry()
  for (const [name, attr] of Object.entries(src.attributes)) {
    const size = attr.itemSize
    const arr = new Float32Array(remap.size * size)
    for (const [from, to] of remap) {
      for (let i = 0; i < size; i++) arr[to * size + i] = attr.getComponent(from, i)
    }
    if (name === 'position') {
      for (let i = 0; i < remap.size; i++) {
        arr[i * 3] -= pivot.x
        arr[i * 3 + 1] -= pivot.y
        arr[i * 3 + 2] -= pivot.z
      }
    }
    g.setAttribute(name, new BufferAttribute(arr, size))
  }
  g.setIndex(out)
  g.computeBoundingSphere()
  return g
}

/** Split one bike model. Returns shared geometries + where the rider goes. */
export function analyseBike(url, scene) {
  if (cache.has(url)) return cache.get(url)
  let mesh = null
  scene.traverse((o) => {
    if (!mesh && o.isMesh) mesh = o
  })
  const geo = mesh.geometry
  const pos = geo.attributes.position
  const comps = components(pos, geo.index)
  const top = Math.max(...comps.map((c) => c.hi[1]))
  const isDisc = (c) => c.s[0] < 0.16 && Math.abs(c.s[1] - c.s[2]) < 0.06 * Math.max(c.s[1], c.s[2]) + 0.01 && c.s[1] > 0.08

  // tyres stand on the ground; the two biggest are the real wheels
  const tyres = comps.filter((c) => isDisc(c) && c.lo[1] < 0.03 && c.s[1] > 0.1).sort((a, b) => b.s[1] - a.s[1])
  const wheels = []
  for (const t of tyres) {
    const hub = new Vector3(t.c[0], t.c[1], t.c[2])
    if (wheels.some((w) => w.hub.distanceTo(hub) < 0.05)) continue // inner/outer tyre faces
    wheels.push({ hub, r: t.s[1] / 2, parts: [] })
  }
  const main = wheels.slice(0, 2).sort((a, b) => b.hub.z - a.hub.z) // [front, rear]
  const [front, rear] = main
  const used = new Set()
  // a piece belongs to a wheel if it sits entirely inside the wheel's disc
  const inside = (c, w, slack = 1.07) => {
    if (Math.abs(c.c[0] - w.hub.x) > 0.14 || c.s[1] > w.r * 2.04 || c.s[2] > w.r * 2.04) return false
    for (const y of [c.lo[1], c.hi[1]]) for (const z of [c.lo[2], c.hi[2]]) if (Math.hypot(y - w.hub.y, z - w.hub.z) > w.r * slack) return false
    return true
  }
  for (const w of [...wheels].sort((a, b) => a.r - b.r)) {
    for (const c of comps) {
      if (used.has(c) || !inside(c, w)) continue
      w.parts.push(c)
      used.add(c)
    }
  }

  // the chainring: a disc off the ground between the wheels, low down
  const ring = comps
    .filter(
      (c) =>
        !used.has(c) &&
        isDisc(c) &&
        c.lo[1] > 0.03 &&
        c.s[1] < 0.32 &&
        c.c[1] < top * 0.5 &&
        c.c[2] < front.hub.z - front.r * 0.8 &&
        c.c[2] > rear.hub.z + rear.r * 0.5,
    )
    .sort((a, b) => b.s[1] - a.s[1])[0]
  const crankCentre = ring ? new Vector3(0, ring.c[1], ring.c[2]) : new Vector3(0, rear.r * 1.05, (front.hub.z + rear.hub.z) * 0.45)
  const crank = { pivot: crankCentre, parts: [], pedals: [] }
  for (const c of comps) {
    if (used.has(c)) continue
    let far = 0
    for (const y of [c.lo[1], c.hi[1]]) for (const z of [c.lo[2], c.hi[2]]) far = Math.max(far, Math.hypot(y - crankCentre.y, z - crankCentre.z))
    if (far > 0.22 || c.hi[1] < 0.02) continue
    crank.parts.push(c)
    used.add(c)
    // pedals: the pieces out to the sides
    if (Math.abs(c.c[0]) > 0.07 && c.s[0] < 0.16) crank.pedals.push(c)
  }
  // where each foot rests on the crank circle (left = +x)
  const pedalOf = (side) => {
    const ps = crank.pedals.filter((p) => Math.sign(p.c[0]) === side)
    if (!ps.length) return null
    const p = ps.sort((a, b) => Math.abs(b.c[0]) - Math.abs(a.c[0]))[0]
    const dy = p.c[1] - crankCentre.y
    const dz = p.c[2] - crankCentre.z
    return { r: Math.max(0.06, Math.hypot(dy, dz)), a: Math.atan2(dz, -dy), x: p.c[0] }
  }
  // a pedal we couldn't find goes opposite the other one
  const foundL = pedalOf(1)
  const foundR = pedalOf(-1)
  const pedalL = foundL ?? (foundR ? { ...foundR, a: foundR.a + Math.PI, x: -foundR.x } : { r: 0.085, a: 0, x: 0.1 })
  const pedalR = foundR ?? { ...pedalL, a: pedalL.a + Math.PI, x: -pedalL.x }

  // steering: front pieces (fork, bars, basket, mudguard), not the long frame tubes
  const steerParts = comps.filter(
    (c) => !used.has(c) && c.s[2] < 0.5 && (c.lo[2] > front.hub.z - front.r * 0.6 || (c.c[1] > top * 0.7 && c.c[2] > front.hub.z * 0.15)),
  )
  steerParts.forEach((c) => used.add(c))
  const bars = steerParts.filter((c) => c.c[1] > top * 0.7)
  const barTop = bars.length ? Math.max(...bars.map((c) => c.hi[1])) : top
  const gripX = bars.length ? Math.max(...bars.map((c) => Math.max(Math.abs(c.lo[0]), Math.abs(c.hi[0])))) * 0.9 : 0.25
  const barZ = bars.length ? bars.reduce((a, c) => a + c.c[2], 0) / bars.length : front.hub.z - 0.1
  const barY = bars.length ? bars.reduce((a, c) => a + c.c[1], 0) / bars.length : top
  const axisOrigin = new Vector3(0, front.hub.y, front.hub.z)
  const axis = new Vector3(0, barY - front.hub.y, barZ - front.hub.z).normalize()

  // the saddle: the widest piece up high behind the cranks
  const seat = comps
    .filter((c) => !used.has(c) && c.c[2] < crankCentre.z + 0.05 && c.c[1] > top * 0.55 && c.s[0] > 0.07 && c.s[2] < 0.4)
    .sort((a, b) => b.hi[1] - a.hi[1])[0]

  const frameParts = comps.filter((c) => !used.has(c))
  const material = mesh.material
  material.side = 2 // the models are thin shells in places
  const zero = new Vector3()
  const result = {
    material,
    frame: extract(geo, frameParts, zero),
    wheels: wheels.map((w, i) => ({ geometry: extract(geo, w.parts, w.hub), hub: w.hub, r: w.r, front: w === front, main: i < 2 })),
    crank: { geometry: crank.parts.length ? extract(geo, crank.parts, crankCentre) : null, pivot: crankCentre },
    steer: { geometry: extract(geo, steerParts, axisOrigin), origin: axisOrigin, axis },
    rider: {
      seatY: seat ? seat.hi[1] : top * 0.75,
      seatZ: seat ? seat.c[2] : rear.hub.z * 0.45,
      grip: { x: gripX, y: barTop - 0.02, z: barZ },
      crank: { y: crankCentre.y, z: crankCentre.z },
      pedalL,
      pedalR,
    },
    wheelR: rear.r,
    length: front.hub.z - rear.hub.z + front.r + rear.r,
  }
  cache.set(url, result)
  return result
}

/**
 * One bike's scene graph from a split model. Returns the root group and a
 * pose(steer, wheelTurn, crankTurn) function.
 */
export function buildBike(parts, { castShadow = true } = {}) {
  const root = new Group()
  const mk = (geometry, parent) => {
    const m = new Mesh(geometry, parts.material)
    m.castShadow = castShadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  mk(parts.frame, root)
  const steer = new Group()
  steer.position.copy(parts.steer.origin)
  root.add(steer)
  mk(parts.steer.geometry, steer)
  const spinners = []
  for (const w of parts.wheels) {
    const g = new Group()
    if (w.front) g.position.copy(w.hub).sub(parts.steer.origin)
    else g.position.copy(w.hub)
    ;(w.front ? steer : root).add(g)
    mk(w.geometry, g)
    spinners.push({ g, r: w.r })
  }
  let crank = null
  if (parts.crank.geometry) {
    crank = new Group()
    crank.position.copy(parts.crank.pivot)
    root.add(crank)
    mk(parts.crank.geometry, crank)
  }
  const q = new Quaternion()
  const pose = (steerAngle, distance, crankAngle) => {
    steer.quaternion.copy(q.setFromAxisAngle(parts.steer.axis, steerAngle))
    for (const s of spinners) s.g.rotation.x = distance / s.r
    if (crank) crank.rotation.x = crankAngle
  }
  return { root, pose }
}

/** Foot positions (bike space) on the pedals for a crank angle. */
export function pedalPositions(rider, crankAngle, out) {
  const { crank, pedalL, pedalR } = rider
  // rotation.x by c turns a point at angle a (from straight down, towards +z) to a - c
  const a = pedalL.a - crankAngle
  const b = pedalR.a - crankAngle
  out.L[0] = crank.z + Math.sin(a) * pedalL.r
  out.L[1] = crank.y - Math.cos(a) * pedalL.r
  out.R[0] = crank.z + Math.sin(b) * pedalR.r
  out.R[1] = crank.y - Math.cos(b) * pedalR.r
  return out
}
