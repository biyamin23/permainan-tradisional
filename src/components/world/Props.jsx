import { Component, Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { HOUSE, RIVERS, SCHOOL, WARUNG, distanceToLine, px } from '../../data/kampungLayout'
import { MODELS } from '../../data/models'
import { ModelSlot } from './ModelSlot'
import { KEBUN_PALMS } from './Trees'
import { windMaterial } from './life/wind'

/**
 * Model props from the map: the coconut grove (one instanced GLB palm drawn
 * many times), sampan on the river and old bicycles parked about the kampung.
 */

class Quiet extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _up = new Vector3(0, 1, 0)

/** Every palm in the kebun kelapa: one draw call per material of the GLB palm. */
function Grove({ url }) {
  const { scene } = useGLTF(url)
  const meshes = useMemo(() => {
    const list = []
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      if (o.isMesh) list.push({ geometry: o.geometry, material: o.material, base: o.matrixWorld.clone() })
    })
    return list
  }, [scene])
  const refs = useRef([])

  useLayoutEffect(() => {
    meshes.forEach((m, k) => {
      const inst = refs.current[k]
      if (!inst) return
      KEBUN_PALMS.forEach((palm, i) => {
        _q.setFromAxisAngle(_up, palm.yaw)
        _p.set(palm.x, 0, palm.z)
        _s.setScalar(palm.scale)
        _m.compose(_p, _q, _s).multiply(m.base)
        inst.setMatrixAt(i, _m)
      })
      inst.instanceMatrix.needsUpdate = true
      inst.computeBoundingSphere()
    })
  }, [meshes])

  return meshes.map((m, k) => (
    <instancedMesh
      key={k}
      ref={(el) => (refs.current[k] = el)}
      args={[m.geometry, windMaterial(m.material, 'palm'), KEBUN_PALMS.length]}
      castShadow
      receiveShadow
    />
  ))
}

// sampan resting in the river, along the current
function riverPose(u, v, side) {
  const [x, z] = px(u, v)
  const river = RIVERS[1]
  const { index } = distanceToLine(x, z, river.points)
  const [ax, az] = river.points[index]
  const [bx, bz] = river.points[index + 1]
  return { position: [x, 0.04, z], rotationY: Math.atan2(bx - ax, bz - az) + side * 0.15 }
}
export const SAMPAN = [riverPose(1310, 872, 1), riverPose(1392, 700, -1), riverPose(330, 524, 1)]

// old bicycles leaning about: by the warung, Tok Wan's stairs and the school
const at = (base, dx, dz, yaw) => ({ position: [base.position[0] + dx, 0, base.position[2] + dz], rotationY: yaw })
const BASIKAL = [at(WARUNG, -5.6, 2.4, 0.3), at(HOUSE, 5.6, 6.4, -0.2), at(SCHOOL, 9, 8.2, Math.PI / 2), at(SCHOOL, 10.2, 8.2, Math.PI / 2)]

export function Props() {
  return (
    <>
      {MODELS.kelapa.url && (
        <Quiet>
          <Suspense fallback={null}>
            <Grove url={MODELS.kelapa.url} />
          </Suspense>
        </Quiet>
      )}
      {SAMPAN.map((b, i) => (
        <group key={`s${i}`} position={b.position} rotation={[0, b.rotationY, 0]}>
          <ModelSlot model={MODELS.sampan} fallback={null} />
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        {BASIKAL.map((b, i) => (
          <group key={`b${i}`} position={b.position} rotation={[0, b.rotationY, 0]}>
            <ModelSlot model={MODELS.basikal} fallback={null} />
            <CuboidCollider args={[0.25, 0.5, 0.9]} position={[0, 0.5, 0]} />
          </group>
        ))}
      </RigidBody>
    </>
  )
}
