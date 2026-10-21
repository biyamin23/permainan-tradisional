import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, MeshStandardMaterial } from 'three'
import { GENDERS } from '../../state/playerState'

/**
 * Stylised kampung kid made from primitives. Faces +z, feet at y = 0,
 * about 1.7 units tall. Shared by the character preview and the player.
 *
 * motionRef.current.speed (0..1) drives the walk cycle.
 * pose: 'idle' | 'wave' | 'cheer'
 */

const SKIN = '#c98c5f'

const LOOKS = {
  [GENDERS.LELAKI]: {
    shirt: '#2b9aa0',
    bottom: '#4b3a2c',
    hair: '#21140d',
    slipper: '#2f6fd1',
    accent: '#f2c14e',
  },
  [GENDERS.PEREMPUAN]: {
    shirt: '#e9779a',
    bottom: '#c2527a',
    hair: '#26160f',
    slipper: '#d9473b',
    accent: '#ffd54f',
  },
}

const materialCache = new Map()
function getMaterial(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new MeshStandardMaterial({ color, roughness: 0.75, flatShading: true }))
  }
  return materialCache.get(color)
}

function Part({ color, children, ...props }) {
  return (
    <mesh castShadow receiveShadow material={getMaterial(color)} {...props}>
      {children}
    </mesh>
  )
}

export function ChildModel({ gender = GENDERS.LELAKI, motionRef, pose = 'idle' }) {
  const look = LOOKS[gender] ?? LOOKS[GENDERS.LELAKI]
  const isGirl = gender === GENDERS.PEREMPUAN

  const root = useRef()
  const upper = useRef()
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const phase = useRef(Math.random() * 10)

  const hairCap = useMemo(() => [0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56], [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime
    const speed = motionRef?.current?.speed ?? 0
    phase.current += dt * (4 + speed * 9)
    const t = phase.current
    const swing = Math.sin(t) * 0.75 * speed
    const breathe = Math.sin(time * 2.2) * 0.015

    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing
    if (upper.current) upper.current.position.y = Math.abs(Math.sin(t)) * 0.06 * speed + breathe
    if (head.current) head.current.rotation.z = Math.sin(time * 1.3) * 0.04 * (1 - speed)

    let armLz = 0.12
    let armRz = -0.12
    let armLx = -swing * 0.9
    let armRx = swing * 0.9
    let hop = 0

    if (pose === 'wave') {
      armRz = -2.5 + Math.sin(time * 9) * 0.3
      armRx = 0
    } else if (pose === 'cheer') {
      armLz = 2.6 + Math.sin(time * 10) * 0.15
      armRz = -2.6 - Math.sin(time * 10) * 0.15
      armLx = 0
      armRx = 0
      hop = Math.abs(Math.sin(time * 5)) * 0.22
    }

    const k = 1 - Math.exp(-12 * dt)
    if (armL.current) {
      armL.current.rotation.z = MathUtils.lerp(armL.current.rotation.z, armLz, k)
      armL.current.rotation.x = MathUtils.lerp(armL.current.rotation.x, armLx, k)
    }
    if (armR.current) {
      armR.current.rotation.z = MathUtils.lerp(armR.current.rotation.z, armRz, k)
      armR.current.rotation.x = MathUtils.lerp(armR.current.rotation.x, armRx, k)
    }
    if (root.current) root.current.position.y = MathUtils.lerp(root.current.position.y, hop, k)
  })

  return (
    <group ref={root}>
      {/* Legs (pivot at the hip) */}
      {[
        [legL, 0.11],
        [legR, -0.11],
      ].map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 0.56, 0]}>
          <Part color={SKIN} position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.075, 0.32, 4, 8]} />
          </Part>
          <Part color={look.slipper} position={[0, -0.53, 0.04]}>
            <boxGeometry args={[0.14, 0.05, 0.24]} />
          </Part>
        </group>
      ))}

      <group ref={upper}>
        {/* Bottoms: shorts for the boy, kain for the girl */}
        {isGirl ? (
          <Part color={look.bottom} position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.2, 0.31, 0.5, 10]} />
          </Part>
        ) : (
          <Part color={look.bottom} position={[0, 0.54, 0]}>
            <cylinderGeometry args={[0.215, 0.23, 0.2, 10]} />
          </Part>
        )}

        {/* Torso */}
        <Part color={look.shirt} position={[0, 0.84, 0]}>
          <capsuleGeometry args={[0.21, 0.3, 4, 10]} />
        </Part>
        {isGirl ? (
          // baju kurung hem
          <Part color={look.shirt} position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.22, 0.27, 0.22, 10]} />
          </Part>
        ) : (
          // little collar
          <Part color={look.accent} position={[0, 1.1, 0.05]} rotation={[0.3, 0, 0]}>
            <torusGeometry args={[0.1, 0.025, 6, 12]} />
          </Part>
        )}

        {/* Arms (pivot at the shoulder) */}
        {[
          [armL, 0.27],
          [armR, -0.27],
        ].map(([ref, x]) => (
          <group key={x} ref={ref} position={[x, 1.06, 0]}>
            <Part color={look.shirt} position={[0, -0.17, 0]}>
              <capsuleGeometry args={[0.068, 0.24, 4, 8]} />
            </Part>
            <Part color={SKIN} position={[0, -0.36, 0]}>
              <sphereGeometry args={[0.07, 10, 8]} />
            </Part>
          </group>
        ))}

        {/* Head */}
        <group ref={head} position={[0, 1.42, 0]}>
          <Part color={SKIN}>
            <sphereGeometry args={[0.28, 18, 14]} />
          </Part>
          <Part color={look.hair} position={[0, 0.02, -0.02]} rotation={[-0.35, 0, 0]}>
            <sphereGeometry args={hairCap} />
          </Part>
          {isGirl && (
            <>
              {[-1, 1].map((side) => (
                <group key={side}>
                  <Part color={look.hair} position={[side * 0.27, -0.02, -0.08]}>
                    <sphereGeometry args={[0.11, 10, 8]} />
                  </Part>
                  <Part color={look.accent} position={[side * 0.24, 0.07, -0.06]} rotation={[0, 0, side * 0.4]}>
                    <boxGeometry args={[0.12, 0.06, 0.06]} />
                  </Part>
                </group>
              ))}
            </>
          )}
          {/* Face */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <Part color="#1b1210" position={[side * 0.095, 0.02, 0.255]}>
                <sphereGeometry args={[0.036, 8, 6]} />
              </Part>
              <Part color="#e98a7a" position={[side * 0.16, -0.06, 0.225]}>
                <sphereGeometry args={[0.045, 8, 6]} />
              </Part>
            </group>
          ))}
          <Part color="#7a2f24" position={[0, -0.1, 0.262]}>
            <boxGeometry args={[0.07, 0.018, 0.02]} />
          </Part>
        </group>
      </group>
    </group>
  )
}
