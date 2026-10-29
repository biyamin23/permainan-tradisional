import { Bone, Float32BufferAttribute, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three'

/**
 * Gives a static, standing person mesh (no skeleton, no animations; like
 * npc_amru.glb / npc_sameer.glb) a tiny skeleton so it can walk and run:
 * two legs, two arms and the head on a root. The model is untouched.
 *
 * Models like these are assembled from separate pieces (torso, sleeves,
 * hands, legs, shoes, head…), so each piece is found (connected triangles,
 * welded by position) and bound whole to the bone it belongs to by where
 * it sits: one-sided pieces low down are legs, one-sided pieces at the
 * sides above the hips are arms, pieces above the neck are the head.
 * Pieces turn rigidly about their joint: nothing stretches. The joints
 * (hips, shoulders, neck) are placed from the pieces themselves.
 */

export const BONES = { root: 0, legL: 1, legR: 2, armL: 3, armR: 4, head: 5 }

/** Connected pieces of an indexed geometry: { verts: number[], min, max }. */
function pieces(geometry) {
  const pos = geometry.attributes.position
  const n = pos.count
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]]
    return i
  }
  const join = (a, b) => {
    a = find(a)
    b = find(b)
    if (a !== b) parent[a] = b
  }
  // vertices split for UV/normal seams are the same point: weld them
  const seen = new Map()
  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`
    if (seen.has(key)) join(i, seen.get(key))
    else seen.set(key, i)
  }
  const idx = geometry.index
  if (idx) for (let t = 0; t < idx.count; t += 3) join(idx.getX(t), idx.getX(t + 1)), join(idx.getX(t), idx.getX(t + 2))
  else for (let t = 0; t < n; t += 3) join(t, t + 1), join(t, t + 2)
  const out = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    let p = out.get(r)
    if (!p) out.set(r, (p = { verts: [], min: [Infinity, Infinity], max: [-Infinity, -Infinity] }))
    p.verts.push(i)
    const x = pos.getX(i)
    const y = pos.getY(i)
    p.min[0] = Math.min(p.min[0], x)
    p.min[1] = Math.min(p.min[1], y)
    p.max[0] = Math.max(p.max[0], x)
    p.max[1] = Math.max(p.max[1], y)
  }
  return [...out.values()]
}

export function autoRig(source, material) {
  const geometry = source.clone()
  const pos = geometry.attributes.position
  geometry.computeBoundingBox()
  const height = geometry.boundingBox.max.y
  const hipY = height * 0.42 // legs end, shirt begins (≈ 0.72 m of 1.72)
  const neckY = height * 0.79 // ≈ 1.36 m
  const bone = new Uint16Array(pos.count)
  const joints = { legL: [], legR: [], armL: [], armR: [], head: [] }

  for (const p of pieces(geometry)) {
    const side = p.min[0] > -0.02 ? 'L' : p.max[0] < 0.02 ? 'R' : null // +x is the model's left
    let kind = 'root'
    if (p.min[1] >= neckY - 0.02) kind = 'head'
    else if (side && p.max[1] <= hipY + 0.02 && p.min[1] < hipY * 0.5) kind = `leg${side}` // (fingers hang this low too, but don't reach the ground)
    else if (side && p.min[1] > hipY - 0.1 && p.max[1] < neckY + 0.06) kind = `arm${side}`
    if (kind !== 'root') joints[kind].push(p)
    for (const v of p.verts) bone[v] = BONES[kind]
  }

  const index = new Uint16Array(pos.count * 4)
  const weight = new Float32Array(pos.count * 4)
  for (let i = 0; i < pos.count; i++) {
    index[i * 4] = bone[i]
    weight[i * 4] = 1
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4))

  // joints: the top of each limb, in the middle of it
  const top = (list, fallbackX, fallbackY) => {
    if (!list.length) return [fallbackX, fallbackY]
    const maxY = Math.max(...list.map((p) => p.max[1]))
    const upper = list.filter((p) => p.max[1] > maxY - 0.15)
    const x = upper.reduce((s, p) => s + (p.min[0] + p.max[0]) / 2, 0) / upper.length
    return [x, maxY]
  }
  const root = new Bone()
  const at = ([x, y]) => {
    const b = new Bone()
    b.position.set(x, y, 0)
    root.add(b)
    return b
  }
  const [lx, ly] = top(joints.legL, 0.08, hipY)
  const [rx, ry] = top(joints.legR, -0.08, hipY)
  const [ax, ay] = top(joints.armL, 0.25, neckY - 0.08)
  const [bx, by] = top(joints.armR, -0.25, neckY - 0.08)
  const bones = [root, at([lx, ly]), at([rx, ry]), at([ax, ay - 0.06]), at([bx, by - 0.06]), at([0, neckY])]
  const mesh = new SkinnedMesh(geometry, material)
  mesh.add(root)
  mesh.bind(new Skeleton(bones))
  mesh.castShadow = true
  mesh.frustumCulled = false
  return { mesh, bones, height }
}
