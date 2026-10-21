import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Object3D } from 'three'
import { CLOTHESLINE } from '../../data/kampungLayout'
import { GEO } from './kit'

const CLOTHS = [
  { x: -1.5, color: '#d9473b', w: 0.7, h: 0.9 },
  { x: -0.6, color: '#f2c14e', w: 0.6, h: 0.7 },
  { x: 0.3, color: '#3b7dbf', w: 0.9, h: 1.1 },
  { x: 1.3, color: '#f5efe2', w: 0.7, h: 0.8 },
]

/** Ampaian: a clothesline with kain and baju swaying in the evening breeze. */
function Clothesline() {
  const cloths = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    cloths.current.forEach((cloth, i) => {
      if (cloth) cloth.rotation.x = Math.sin(t * 1.8 + i * 1.3) * 0.18 + 0.05
    })
  })
  const [x, , z] = CLOTHESLINE.position
  return (
    <group position={[x, 0, z]}>
      {[-2.2, 2.2].map((px) => (
        <mesh key={px} position={[px, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 2, 6]} />
          <meshStandardMaterial color="#7a5232" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 1.92, 0]}>
        <boxGeometry args={[4.4, 0.015, 0.015]} />
        <meshStandardMaterial color="#e8e0d0" />
      </mesh>
      {CLOTHS.map((cloth, i) => (
        <group key={cloth.x} ref={(el) => (cloths.current[i] = el)} position={[cloth.x, 1.92, 0]}>
          <mesh position={[0, -cloth.h / 2, 0]} castShadow>
            <planeGeometry args={[cloth.w, cloth.h]} />
            <meshStandardMaterial color={cloth.color} side={DoubleSide} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const BIRD_COUNT = 7
const _dummy = new Object3D()

/** A small flock of burung circling high over the kampung. */
function Birds() {
  const ref = useRef()
  const birds = useMemo(
    () =>
      Array.from({ length: BIRD_COUNT }, (_, i) => ({
        offset: (i / BIRD_COUNT) * 0.9,
        radius: 34 + (i % 3) * 4,
        height: 24 + (i % 4) * 1.5,
        flap: 6 + (i % 3),
      })),
    [],
  )

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    birds.forEach((b, i) => {
      const a = t * 0.12 + b.offset
      const bx = Math.cos(a) * b.radius + 5
      const bz = Math.sin(a) * b.radius - 10
      const heading = -a
      const wing = Math.sin(t * b.flap + i) * 0.6
      for (let side = 0; side < 2; side++) {
        const s = side === 0 ? 1 : -1
        _dummy.position.set(bx, b.height + Math.sin(t + i) * 0.6, bz)
        _dummy.rotation.set(0, heading, s * wing)
        _dummy.translateX(s * 0.32)
        _dummy.scale.set(0.65, 0.04, 0.22)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i * 2 + side, _dummy.matrix)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[GEO.box, undefined, BIRD_COUNT * 2]} frustumCulled={false}>
      <meshBasicMaterial color="#3a2a2a" />
    </instancedMesh>
  )
}

export function Life() {
  return (
    <>
      <Clothesline />
      <Birds />
    </>
  )
}
