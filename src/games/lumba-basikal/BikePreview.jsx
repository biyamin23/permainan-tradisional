import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { analyseBike, buildBike } from './bikeRig'

/**
 * The bike on a turntable for the picker: the real model, slowly turning,
 * wheels and pedals ticking round so you can see it's the actual basikal.
 * Drag to turn it yourself.
 */

function Bike({ url, spin, scale }) {
  const { scene } = useGLTF(url)
  const parts = useMemo(() => analyseBike(url, scene), [url, scene])
  const bike = useMemo(() => buildBike(parts), [parts])
  const g = useRef()
  const roll = useRef(0)
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (!spin.current.dragging) spin.current.angle += delta * 0.45
    if (g.current) g.current.rotation.y = spin.current.angle
    roll.current += delta * 1.6
    bike.pose(Math.sin(t * 0.8) * 0.25, roll.current, roll.current / 2.4 / parts.wheelR)
  })
  // big bikes shrink a little so they all fill the stage the same
  const s = 1.45 / Math.max(1.2, parts.length * scale)
  return (
    <group ref={g} scale={s * scale}>
      <primitive object={bike.root} />
    </group>
  )
}

export function BikePreview({ url, scale = 1 }) {
  const spin = useRef({ angle: 0.9, dragging: false, x: 0 })
  return (
    <div
      className="lb-preview"
      onPointerDown={(e) => {
        spin.current.dragging = true
        spin.current.x = e.clientX
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!spin.current.dragging) return
        spin.current.angle += (e.clientX - spin.current.x) * 0.012
        spin.current.x = e.clientX
      }}
      onPointerUp={() => {
        spin.current.dragging = false
      }}
      onPointerCancel={() => {
        spin.current.dragging = false
      }}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 32, position: [0, 0.95, 2.9] }} onCreated={({ camera }) => camera.lookAt(0, 0.42, 0)}>
        <hemisphereLight args={['#fff4dc', '#8a6a3a', 1.1]} />
        <directionalLight position={[2.5, 4, 2]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.1, 40]} />
          <meshStandardMaterial color="#d9c49a" roughness={1} />
        </mesh>
        <Suspense fallback={null}>
          <Bike key={url} url={url} spin={spin} scale={scale} />
        </Suspense>
      </Canvas>
    </div>
  )
}
