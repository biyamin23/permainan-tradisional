import { CatmullRomCurve3, Vector3 } from 'three'

/**
 * A litar from tracks.js, made ready to race on: the loop sampled every
 * metre (position, direction, curve, width, height), checkpoints, start grid,
 * shortcuts, bridges and obstacles placed in the world, and a cheap
 * "where am I on the road" lookup that only searches near your last spot
 * (so cutting across the grass never counts as progress).
 */

const STEP = 1 // metres between samples
export const BRIDGE_HALF = 4 // the jambatan model is 8 m long
const BRIDGE_RAMP = 1.6
export const BRIDGE_WIDTH = 2.9

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function buildTrack(def) {
  const curve = new CatmullRomCurve3(
    def.points.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'centripetal',
  )
  const L = curve.getLength()
  const n = Math.round(L / STEP)
  const px = new Float32Array(n)
  const pz = new Float32Array(n)
  const tx = new Float32Array(n)
  const tz = new Float32Array(n)
  const p = new Vector3()
  for (let i = 0; i < n; i++) {
    curve.getPointAt(i / n, p)
    px[i] = p.x
    pz[i] = p.z
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n
    const b = (i + 1) % n
    const dx = px[b] - px[a]
    const dz = pz[b] - pz[a]
    const l = Math.hypot(dx, dz) || 1
    tx[i] = dx / l
    tz[i] = dz / l
  }
  const ds = L / n
  const wrap = (i) => ((i % n) + n) % n
  const idxAt = (s) => wrap(Math.round(s / ds))

  // signed curvature (+ = bending right), lightly smoothed
  const curv = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = wrap(i - 3)
    const b = wrap(i + 3)
    const cross = tx[a] * tz[b] - tz[a] * tx[b]
    curv[i] = cross / (6 * ds) // going +z, a turn towards -x (right) gives + cross
  }

  // width along the loop
  const width = new Float32Array(n).fill(def.width)
  const setWidth = (from, to, w, blend = 4) => {
    const i0 = Math.round(from * n)
    const i1 = Math.round(to * n)
    for (let k = i0 - blend; k <= i1 + blend; k++) {
      const edge = k < i0 ? (k - (i0 - blend)) / blend : k > i1 ? (i1 + blend - k) / blend : 1
      const i = wrap(k)
      width[i] = Math.min(width[i], def.width + (w - def.width) * smooth(edge))
    }
  }
  for (const nr of def.narrow) setWidth(nr.from, nr.to, nr.width)

  // height: humped bridges and bukit
  const height = new Float32Array(n)
  const bridges = def.bridges.map((b) => {
    const i = Math.round(b.at * n)
    const span = Math.ceil((BRIDGE_HALF + BRIDGE_RAMP) / ds)
    for (let k = -span; k <= span; k++) {
      const d = Math.abs(k * ds)
      const j = wrap(i + k)
      height[j] = d <= BRIDGE_HALF ? 0.25 + 0.52 * (1 - (d / BRIDGE_HALF) ** 2) : 0.25 * (1 - (d - BRIDGE_HALF) / BRIDGE_RAMP)
    }
    setWidth((i - span) / n, (i + span) / n, BRIDGE_WIDTH, 3)
    return { i, x: px[i], z: pz[i], angle: Math.atan2(tx[i], tz[i]) }
  })
  for (const h of def.hills) {
    const i0 = Math.round((h.at - h.len / 2) * n)
    const i1 = Math.round((h.at + h.len / 2) * n)
    for (let k = i0; k <= i1; k++) {
      const u = (k - i0) / (i1 - i0)
      const j = wrap(k)
      height[j] = Math.max(height[j], h.h * Math.sin(u * Math.PI) ** 2)
    }
  }

  // where the bridges' streams cross (for the water and the banks)
  const bridgeAt = new Int16Array(n).fill(-1)
  bridges.forEach((b, bi) => {
    const span = Math.ceil(BRIDGE_HALF / ds)
    for (let k = -span; k <= span; k++) bridgeAt[wrap(b.i + k)] = bi
  })

  // shortcuts: a straight dirt path across the inside of a bend
  const shortcuts = def.shortcuts.map((sc) => {
    const i0 = Math.round(sc.from * n)
    const i1 = Math.round(sc.to * n)
    let turn = 0
    for (let k = i0; k <= i1; k++) turn += curv[wrap(k)]
    const inner = turn > 0 ? 1 : -1 // right-hand bend: the inside is on the right
    const at = (i) => {
      const h = width[wrap(i)] / 2 - 0.6
      return [px[wrap(i)] + -tz[wrap(i)] * h * inner, pz[wrap(i)] + tx[wrap(i)] * h * inner]
    }
    const [ax, az] = at(i0)
    const [bx, bz] = at(i1)
    const len = Math.hypot(bx - ax, bz - az)
    return { i0, i1, s0: i0 * ds, s1: i1 * ds, ax, az, bx, bz, dx: (bx - ax) / len, dz: (bz - az) / len, len, half: sc.width / 2, mud: Boolean(sc.mud), saves: (i1 - i0) * ds - len }
  })

  const mud = def.mud.map((m) => {
    const i = Math.round(m.at * n)
    return { i, x: px[i] + -tz[i] * m.lat, z: pz[i] + tx[i] * m.lat, len: m.len, w: m.w, angle: Math.atan2(tx[i], tz[i]) }
  })

  const track = {
    def,
    L,
    n,
    ds,
    px,
    pz,
    tx,
    tz,
    curv,
    width,
    height,
    bridges,
    bridgeAt,
    shortcuts,
    mud,
    wrap,
    idxAt,
    checkpoints: def.checkpoints.map((f) => f * L),
    finalStretch: def.finalStretch * L,
    /** World point at sample i, `lat` metres right of the middle. */
    point(i, lat, out) {
      i = wrap(i)
      out.x = px[i] - tz[i] * lat
      out.z = pz[i] + tx[i] * lat
      return out
    },
    /**
     * Nearest sample to (x, z), searching `range` samples around `hint`.
     * Returns { i, lat } in `out` (lat + = right of the middle).
     */
    project(x, z, hint, range, out) {
      let best = hint
      let bd = Infinity
      for (let k = -range; k <= range; k++) {
        const i = wrap(hint + k)
        const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2
        if (d < bd) {
          bd = d
          best = i
        }
      }
      out.i = best
      out.lat = (x - px[best]) * -tz[best] + (z - pz[best]) * tx[best]
      return out
    },
    /** Height of the ground under (sample i, lat): the road, or the bank down from it. */
    heightAt(i, lat) {
      i = wrap(i)
      const h = height[i]
      if (!h) return 0
      const half = width[i] / 2
      const off = Math.abs(lat) - half
      if (off <= 0) return h
      if (bridgeAt[i] >= 0) return off < 0.6 ? h : 0 // off the bridge: in the stream
      return h * Math.max(0, 1 - off / (h * 1.6))
    },
  }
  return track
}
