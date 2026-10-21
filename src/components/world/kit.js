import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  IcosahedronGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Vector3,
} from 'three'

/**
 * The "kit of parts" every kampung object is built from: a handful of shared
 * unit geometries and materials. Objects are described as lists of parts
 * ({ matrix, color }) and drawn with one InstancedMesh per geometry, which keeps
 * draw calls very low even with hundreds of planks, posts and leaves.
 */

function createPrismGeometry() {
  // Triangle with base width 1 on y = 0 and apex at y = 1, extruded 1 along z.
  const shape = new Shape()
  shape.moveTo(-0.5, 0)
  shape.lineTo(0.5, 0)
  shape.lineTo(0, 1)
  shape.lineTo(-0.5, 0)
  const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
  geometry.translate(0, 0, -0.5)
  return geometry
}

function createPyramidGeometry() {
  const geometry = new ConeGeometry(0.5, 1, 4, 1)
  geometry.rotateY(Math.PI / 4)
  geometry.translate(0, 0.5, 0)
  return geometry
}

export const GEO = {
  box: new BoxGeometry(1, 1, 1),
  cylinder: new CylinderGeometry(0.5, 0.5, 1, 8),
  taperedCylinder: new CylinderGeometry(0.38, 0.5, 1, 7),
  blade: new ConeGeometry(0.5, 1, 3).translate(0, 0.5, 0),
  pyramid: createPyramidGeometry(),
  prism: createPrismGeometry(),
  blob: new IcosahedronGeometry(0.5, 0),
  ball: new IcosahedronGeometry(0.5, 1),
}

const flat = (params) =>
  new MeshStandardMaterial({ roughness: 0.88, metalness: 0, flatShading: true, ...params })

export const MAT = {
  /** White base so per-instance colours show true. */
  kit: flat({ color: '#ffffff' }),
  foliage: flat({ color: '#ffffff', roughness: 0.95 }),
  ground: flat({ color: '#ffffff', vertexColors: true, roughness: 1 }),
  water: new MeshStandardMaterial({
    color: '#4c94a6',
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  }),
  glass: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0.15 }),
}

const _position = new Vector3()
const _scale = new Vector3()
const _quaternion = new Quaternion()
const _euler = new Euler()
const _up = new Vector3(0, 1, 0)

/** Compose a transform matrix from arrays. */
export function makeMatrix(position, rotation = [0, 0, 0], scale = [1, 1, 1], order = 'XYZ') {
  _position.set(position[0], position[1], position[2])
  _euler.set(rotation[0], rotation[1], rotation[2], order)
  _quaternion.setFromEuler(_euler)
  _scale.set(scale[0], scale[1], scale[2])
  return new Matrix4().compose(_position, _quaternion, _scale)
}

/** Matrix whose local +Y axis points along `direction` (used for leaning trunks). */
export function makeAlignedMatrix(position, direction, scale) {
  _position.set(position[0], position[1], position[2])
  _quaternion.setFromUnitVectors(_up, new Vector3(...direction).normalize())
  _scale.set(scale[0], scale[1], scale[2])
  return new Matrix4().compose(_position, _quaternion, _scale)
}

/** One renderable part. */
export const part = (position, scale, rotation = [0, 0, 0], color = '#ffffff', order = 'XYZ') => ({
  matrix: makeMatrix(position, rotation, scale, order),
  color,
})

/** Merge several { geometryKey: parts[] } bundles into one. */
export function mergeBundles(...bundles) {
  const merged = {}
  for (const bundle of bundles) {
    for (const [key, parts] of Object.entries(bundle)) {
      merged[key] = (merged[key] ?? []).concat(parts)
    }
  }
  return merged
}

/** Small deterministic random generator so the kampung looks the same every visit. */
export function createRandom(seed = 1) {
  let t = seed >>> 0
  return function random() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const randomBetween = (random, min, max) => min + random() * (max - min)

export const pick = (random, list) => list[Math.floor(random() * list.length)]
