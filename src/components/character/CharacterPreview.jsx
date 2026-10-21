import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { GENDERS } from '../../state/playerState'
import { ChildModel } from './ChildModel'

const STILL = { current: { speed: 0 } }

function Kid({ gender, x, selected, dimmed, onSelect }) {
  const group = useRef()
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05))
    const targetScale = selected ? 1.12 : dimmed ? 0.88 : 1
    const s = MathUtils.lerp(g.scale.x, targetScale, k)
    g.scale.setScalar(s)
    g.rotation.y = MathUtils.lerp(g.rotation.y, selected ? 0 : Math.sin(t * 0.6 + x) * 0.35, k)
    g.position.z = MathUtils.lerp(g.position.z, selected ? 0.35 : 0, k)
  })

  return (
    <group
      ref={group}
      position={[x, 0, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(gender)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ChildModel gender={gender} motionRef={STILL} pose={selected ? 'cheer' : hovered ? 'wave' : 'idle'} />
    </group>
  )
}

/** Live 3D preview of both kids; the chosen one cheers and steps forward. */
export function CharacterPreview({ gender, onSelect }) {
  return (
    <Canvas
      className="character-preview__canvas"
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 4.6], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
    >
      <hemisphereLight args={['#ffe2bd', '#6b4a3a', 1.1]} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={2.4}
        color="#ffc58a"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#9fb6ff" />

      <Kid gender={GENDERS.LELAKI} x={-0.72} selected={gender === GENDERS.LELAKI} dimmed={gender === GENDERS.PEREMPUAN} onSelect={onSelect} />
      <Kid gender={GENDERS.PEREMPUAN} x={0.72} selected={gender === GENDERS.PEREMPUAN} dimmed={gender === GENDERS.LELAKI} onSelect={onSelect} />

      {/* little patch of kampung ground */}
      <mesh position={[0, -0.06, 0.1]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.25, 0.12, 40]} />
        <meshStandardMaterial color="#8db05a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -0.005, 0.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.25, 32]} />
        <meshStandardMaterial color="#c4925d" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </Canvas>
  )
}
