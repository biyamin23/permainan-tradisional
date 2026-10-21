import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { DoubleSide, LatheGeometry, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { part } from '../kit'

/** Small props shared by the game spots. All primitives, no assets. */

// ---------------------------------------------------------------- Congkak
/** Congkak board resting on a mengkuang mat (wakaf-local coordinates). */
export function buildCongkakOnMat() {
  const box = []
  const cylinder = []
  const ball = []
  const matY = 0.64
  box.push(part([0, matY, 0.1], [2.7, 0.02, 2.6], [0, 0, 0], '#d9b86a'))
  for (const z of [-1, -0.5, 0, 0.5, 1]) {
    box.push(part([0, matY + 0.012, z + 0.1], [2.7, 0.006, 0.1], [0, 0, 0], z % 1 === 0 ? '#b3472f' : '#3f7a4a'))
  }
  for (const x of [-1, -0.5, 0.5, 1]) {
    box.push(part([x, matY + 0.013, 0.1], [0.08, 0.006, 2.6], [0, 0, 0], '#c79a4c'))
  }
  const boardY = matY + 0.09
  box.push(part([0, boardY, 0.2], [1.7, 0.16, 0.44], [0, 0, 0], '#8a4e26'))
  for (const x of [-0.92, 0.92]) {
    cylinder.push(part([x, boardY, 0.2], [0.46, 0.16, 0.46], [0, 0, 0], '#8a4e26'))
    cylinder.push(part([x, boardY + 0.075, 0.2], [0.32, 0.02, 0.32], [0, 0, 0], '#3a2414'))
  }
  for (let i = 0; i < 7; i++) {
    const x = -0.6 + i * 0.2
    for (const dz of [-0.1, 0.1]) {
      cylinder.push(part([x, boardY + 0.075, 0.2 + dz], [0.13, 0.02, 0.13], [0, 0, 0], '#3a2414'))
      ball.push(part([x - 0.02, boardY + 0.095, 0.2 + dz], [0.05, 0.035, 0.05], [0, 0, 0], '#efe6d2'))
      ball.push(part([x + 0.025, boardY + 0.095, 0.2 + dz + 0.02], [0.05, 0.035, 0.05], [0, 0, 0], '#e6dcc4'))
    }
  }
  return { box, cylinder, ball }
}

// ---------------------------------------------------------------- Ground
export function DirtPatch({ radius = 2.5, color = '#c39461', scaleZ = 1, position = [0, 0, 0] }) {
  return (
    <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, scaleZ, 1]} receiveShadow>
      <circleGeometry args={[radius, 28]} />
      <meshStandardMaterial color={color} roughness={1} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

export function DirtRect({ width, depth, color = '#c39461', position = [0, 0, 0] }) {
  return (
    <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} roughness={1} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

/** Chalk/scratched line on the ground. */
export function GroundLine({ from, to, width = 0.08, color = '#efe3c8' }) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const length = Math.hypot(dx, dz)
  return (
    <mesh position={[(from[0] + to[0]) / 2, 0.035, (from[1] + to[1]) / 2]} rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]}>
      <planeGeometry args={[length, width]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} polygonOffset polygonOffsetFactor={-3} />
    </mesh>
  )
}

export function MengkuangMat({ size = 2.2, position = [0, 0, 0] }) {
  const stripes = [-0.6, -0.2, 0.2, 0.6]
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[size, 0.02, size]} />
        <meshStandardMaterial color="#d9b86a" roughness={1} />
      </mesh>
      {stripes.map((s, i) => (
        <mesh key={s} position={[0, 0.042, s * (size / 2)]}>
          <boxGeometry args={[size, 0.005, 0.08]} />
          <meshStandardMaterial color={i % 2 ? '#3f7a4a' : '#b3472f'} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- Gasing
const gasingGeometry = new LatheGeometry(
  [
    new Vector2(0, 0),
    new Vector2(0.05, 0.02),
    new Vector2(0.16, 0.08),
    new Vector2(0.2, 0.13),
    new Vector2(0.17, 0.18),
    new Vector2(0.06, 0.22),
    new Vector2(0.035, 0.29),
    new Vector2(0, 0.3),
  ],
  14,
)

export function SpinningGasing({ position, color = '#a8552c', speed = 22, wobble = 0.05 }) {
  const tilt = useRef()
  const spin = useRef()
  useFrame((state, delta) => {
    if (spin.current) spin.current.rotation.y += delta * speed
    if (tilt.current) {
      const t = state.clock.elapsedTime * 3 + position[0]
      tilt.current.rotation.x = Math.sin(t) * wobble
      tilt.current.rotation.z = Math.cos(t) * wobble
    }
  })
  return (
    <group ref={tilt} position={position}>
      <mesh ref={spin} geometry={gasingGeometry} castShadow>
        <meshStandardMaterial color={color} roughness={0.6} flatShading />
      </mesh>
    </group>
  )
}

export function RestingGasing({ position, rotation = [0, 0.6, 1.2], color = '#c9742f' }) {
  return (
    <mesh geometry={gasingGeometry} position={position} rotation={rotation} castShadow>
      <meshStandardMaterial color={color} roughness={0.6} flatShading />
    </mesh>
  )
}

// ---------------------------------------------------------------- Sepak raga
export function RattanBall({ ballRef, position = [0, 0.22, 0] }) {
  return (
    <group ref={ballRef} position={position}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#c9a15d" wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial color="#8a6a3a" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- Wau
function createWauShape(scale = 1) {
  const right = [
    [0, 1.15], [0.16, 1.02], [0.5, 0.8], [0.95, 0.6], [1.18, 0.44], [1.02, 0.32],
    [0.62, 0.2], [0.26, 0.06], [0.2, -0.24], [0.55, -0.4], [0.92, -0.36], [1.02, -0.26],
    [0.98, -0.52], [0.72, -0.74], [0.36, -0.86], [0, -0.9],
  ]
  const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y])
  const shape = new Shape()
  ;[...right, ...left].forEach(([x, y], i) => (i === 0 ? shape.moveTo(x * scale, y * scale) : shape.lineTo(x * scale, y * scale)))
  shape.closePath()
  return shape
}

const WAU_GEOMETRY = {
  outer: new ShapeGeometry(createWauShape(1)),
  inner: new ShapeGeometry(createWauShape(0.74)),
  core: new ShapeGeometry(createWauShape(0.36)),
}

export function WauKite({ colors = ['#c9342c', '#f2c14e', '#1f7a7a'], scale = 1 }) {
  return (
    <group scale={scale}>
      <mesh geometry={WAU_GEOMETRY.outer} castShadow>
        <meshStandardMaterial color={colors[0]} side={DoubleSide} roughness={0.7} />
      </mesh>
      <mesh geometry={WAU_GEOMETRY.inner} position={[0, 0.03, 0.01]}>
        <meshStandardMaterial color={colors[1]} side={DoubleSide} roughness={0.7} />
      </mesh>
      <mesh geometry={WAU_GEOMETRY.core} position={[0, 0.06, 0.02]}>
        <meshStandardMaterial color={colors[2]} side={DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.03]}>
        <boxGeometry args={[0.04, 2.1, 0.03]} />
        <meshStandardMaterial color="#5b3a22" />
      </mesh>
      <mesh position={[0, 0.5, 0.03]}>
        <boxGeometry args={[2.3, 0.035, 0.03]} />
        <meshStandardMaterial color="#5b3a22" />
      </mesh>
      {[-1.16, 1.16].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]}>
          <boxGeometry args={[0.05, 0.6, 0.01]} />
          <meshStandardMaterial color={colors[1]} />
        </mesh>
      ))}
    </group>
  )
}

/** A wau flying on a string that starts at `anchor` (local coordinates). */
export function FlyingWau({ anchor, position }) {
  const group = useRef()
  const base = useMemo(() => new Vector3(...position), [position])
  const points = useMemo(() => {
    const a = new Vector3(...anchor)
    const list = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const p = new Vector3().lerpVectors(a, base, t)
      p.y -= Math.sin(t * Math.PI) * 1.2
      list.push(p)
    }
    return list
  }, [anchor, base])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.rotation.z = Math.sin(t * 0.9) * 0.12
    g.rotation.x = -0.35 + Math.sin(t * 0.7) * 0.05
    g.position.y = base.y + Math.sin(t * 0.8) * 0.25
  })

  return (
    <>
      <Line points={points} color="#f5ead6" lineWidth={1} transparent opacity={0.7} />
      <group ref={group} position={base} rotation={[0, -0.4, 0]}>
        <group position={[0, 1.4, 0]} scale={1.5}>
          <WauKite />
        </group>
      </group>
    </>
  )
}

// ---------------------------------------------------------------- Hand items
export function Broom() {
  return (
    <group rotation={[0.5, 0, 0]}>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1.0, 5]} />
        <meshStandardMaterial color="#8a6a3c" />
      </mesh>
      {[-0.08, -0.04, 0, 0.04, 0.08].map((x) => (
        <mesh key={x} position={[x * 1.6, -1.05, 0]} rotation={[0, 0, x * 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.42, 3]} />
          <meshStandardMaterial color="#c9a35a" />
        </mesh>
      ))}
    </group>
  )
}

export function FishingRod() {
  return (
    <group rotation={[-0.9, 0, 0]}>
      <mesh position={[0, -1.3, 0]}>
        <cylinderGeometry args={[0.012, 0.022, 2.6, 5]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      {/* line hanging straight down from the tip into the water */}
      <group position={[0, -2.6, 0]} rotation={[1.95, 0, 0]}>
        <mesh position={[0, -0.8, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 1.6, 3]} />
          <meshBasicMaterial color="#f5ead6" />
        </mesh>
      </group>
    </group>
  )
}

export function KondaStick() {
  return (
    <group rotation={[-0.4, 0, 0]}>
      <mesh position={[0, -0.42, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.85, 6]} />
        <meshStandardMaterial color="#7a5232" />
      </mesh>
    </group>
  )
}
