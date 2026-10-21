import { useLayoutEffect, useRef } from 'react'
import { Color } from 'three'
import { GEO, MAT } from './kit'

const _color = new Color()

/** Draws a list of parts ({ matrix, color }) with a single InstancedMesh. */
export function InstancedParts({
  geometry,
  material = MAT.kit,
  parts,
  castShadow = true,
  receiveShadow = true,
}) {
  const ref = useRef()

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    parts.forEach((p, i) => {
      mesh.setMatrixAt(i, p.matrix)
      mesh.setColorAt(i, _color.set(p.color ?? '#ffffff'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [parts])

  if (!parts || parts.length === 0) return null

  return (
    <instancedMesh
      key={parts.length}
      ref={ref}
      args={[geometry, material, parts.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

/**
 * Renders a bundle like { box: [...], cylinder: [...], prism: [...] } where each
 * key is a geometry from the kit.
 */
export function PartsBundle({ bundle, material = MAT.kit, castShadow = true, receiveShadow = true }) {
  return Object.entries(bundle).map(([geometryKey, parts]) => (
    <InstancedParts
      key={geometryKey}
      geometry={GEO[geometryKey]}
      material={material}
      parts={parts}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  ))
}
