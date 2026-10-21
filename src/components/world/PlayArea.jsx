import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { DoubleSide, LatheGeometry, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { FIELD, WAKAF } from '../../data/kampungLayout'
import { PartsBundle } from './InstancedParts'
import { MAT, createRandom, part, randomBetween } from './kit'
import { Wakaf } from './Wakaf'

const [FX, FZ] = FIELD.center

/** Congkak board resting on a mengkuang mat inside the wakaf (wakaf-local coords). */
function buildCongkakOnMat() {
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

function buildFieldProps() {
  const random = createRandom(77)
  const box = []
  const cylinder = []

  // worn dirt patches where children play
  const patches = [
    [FX - 1, FZ + 1, 4.4],
    [FX + 2.5, FZ - 1.5, 3.2],
    [FX - 7.5, FZ + 5.2, 2.4],
    [FX + 4, FZ + 6.5, 2.2],
  ]
  patches.forEach(([x, z, r], i) =>
    cylinder.push(part([x, 0.022 + i * 0.002, z], [r * 2, 0.01, r * 1.7], [0, random() * 3, 0], i % 2 ? '#b98a55' : '#c39461')),
  )

  // teng-teng (hopscotch) grid scratched into the dirt
  const rows = [1, 1, 2, 1, 2, 1, 1]
  const tx = FX - 7.5
  const tz0 = FZ + 7.4
  rows.forEach((count, r) => {
    const z = tz0 - r * 0.84
    const xs = count === 1 ? [tx] : [tx - 0.42, tx + 0.42]
    xs.forEach((x) => {
      box.push(part([x, 0.03, z], [0.84, 0.012, 0.84], [0, 0, 0], '#8f5f38'))
      box.push(part([x, 0.035, z], [0.72, 0.012, 0.72], [0, 0, 0], '#dcc196'))
    })
  })
  box.push(part([tx + 0.25, 0.045, tz0 - 1.68], [0.12, 0.05, 0.1], [0, 0.4, 0], '#8d877c')) // gundu stone

  // guli ring
  const gx = FX + 4
  const gz = FZ + 6
  const ringR = 0.95
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2
    box.push(part([gx + Math.cos(a) * ringR, 0.04, gz + Math.sin(a) * ringR], [0.3, 0.012, 0.06], [0, -a + Math.PI / 2, 0], '#7d5432'))
  }
  return { box, cylinder }
}

const MARBLE_COLORS = ['#2f8fd8', '#e0453a', '#3cb371', '#f2c14e', '#9b59d0', '#20b2aa', '#ff8c42']

function buildMarbles() {
  const gx = FX + 4
  const gz = FZ + 6
  const random = createRandom(5)
  return MARBLE_COLORS.map((color, i) => {
    const inside = i < 4
    const a = random() * Math.PI * 2
    const r = inside ? randomBetween(random, 0, 0.6) : randomBetween(random, 1.4, 2.2)
    return part([gx + Math.cos(a) * r, 0.08, gz + Math.sin(a) * r], [0.14, 0.14, 0.14], [0, 0, 0], color)
  })
}

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

function Gasing() {
  const spinning = useRef()
  useFrame((state, delta) => {
    const g = spinning.current
    if (!g) return
    g.rotation.y += delta * 22
    const t = state.clock.elapsedTime
    g.parent.rotation.x = Math.sin(t * 3) * 0.05
    g.parent.rotation.z = Math.cos(t * 3) * 0.05
  })
  return (
    <group>
      <group position={[FX - 3, 0.02, FZ - 4]}>
        <mesh ref={spinning} geometry={gasingGeometry} castShadow>
          <meshStandardMaterial color="#a8552c" roughness={0.6} flatShading />
        </mesh>
      </group>
      <mesh geometry={gasingGeometry} position={[FX - 2.2, 0.17, FZ - 3.4]} rotation={[0, 0.6, 1.2]} castShadow>
        <meshStandardMaterial color="#c9742f" roughness={0.6} flatShading />
      </mesh>
    </group>
  )
}

function SepakRagaBall() {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.position.y = 0.22 + Math.abs(Math.sin(t * 1.6)) * 0.12
    ref.current.rotation.y = t * 0.6
  })
  return (
    <mesh ref={ref} position={[FX + 2, 0.22, FZ - 2]} castShadow>
      <icosahedronGeometry args={[0.22, 1]} />
      <meshStandardMaterial color="#c9a15d" wireframe />
    </mesh>
  )
}

/** Wau bulan (moon kite) outline, unit size. */
function createWauShape(scale = 1) {
  const right = [
    [0, 1.15], [0.16, 1.02], [0.5, 0.8], [0.95, 0.6], [1.18, 0.44], [1.02, 0.32],
    [0.62, 0.2], [0.26, 0.06], [0.2, -0.24], [0.55, -0.4], [0.92, -0.36], [1.02, -0.26],
    [0.98, -0.52], [0.72, -0.74], [0.36, -0.86], [0, -0.9],
  ]
  const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y])
  const points = [...right, ...left]
  const shape = new Shape()
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x * scale, y * scale) : shape.lineTo(x * scale, y * scale)))
  shape.closePath()
  return shape
}

const WAU_ANCHOR = new Vector3(FX + 1, 0.6, FZ - 3.5)
const WAU_POSITION = new Vector3(FX + 3, 9.5, FZ - 11)

function Wau() {
  const group = useRef()
  const { outer, inner, core } = useMemo(
    () => ({
      outer: new ShapeGeometry(createWauShape(1)),
      inner: new ShapeGeometry(createWauShape(0.74)),
      core: new ShapeGeometry(createWauShape(0.36)),
    }),
    [],
  )
  const stringPoints = useMemo(() => {
    const points = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const p = new Vector3().lerpVectors(WAU_ANCHOR, WAU_POSITION, t)
      p.y -= Math.sin(t * Math.PI) * 1.6 // gentle sag
      points.push(p)
    }
    return points
  }, [])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.rotation.z = Math.sin(t * 0.9) * 0.12
    g.rotation.x = -0.35 + Math.sin(t * 0.7) * 0.05
    g.position.y = WAU_POSITION.y + Math.sin(t * 0.8) * 0.25
  })

  return (
    <>
      <Line points={stringPoints} color="#f5ead6" lineWidth={1} transparent opacity={0.7} />
      <group ref={group} position={WAU_POSITION} rotation={[0, -0.4, 0]}>
        <group position={[0, 1.4, 0]} scale={1.6}>
          <mesh geometry={outer} castShadow>
            <meshStandardMaterial color="#c9342c" side={DoubleSide} roughness={0.7} />
          </mesh>
          <mesh geometry={inner} position={[0, 0.03, 0.01]}>
            <meshStandardMaterial color="#f2c14e" side={DoubleSide} roughness={0.7} />
          </mesh>
          <mesh geometry={core} position={[0, 0.06, 0.02]}>
            <meshStandardMaterial color="#1f7a7a" side={DoubleSide} roughness={0.7} />
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
              <meshStandardMaterial color="#f2c14e" />
            </mesh>
          ))}
        </group>
      </group>
    </>
  )
}

/** Pulsing ring that marks the main interaction spot on the padang. */
function PlayMarker() {
  const ring = useRef()
  const glow = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ring.current) {
      ring.current.rotation.z = t * 0.25
      ring.current.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.2
    }
    if (glow.current) {
      const s = 1 + ((t * 0.5) % 1) * 0.35
      glow.current.scale.set(s, s, s)
      glow.current.material.opacity = 0.35 * (1 - ((t * 0.5) % 1))
    }
  })
  return (
    <group position={[FX, 0.05, FZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={ring}>
        <ringGeometry args={[2.6, 2.85, 40, 1, 0, Math.PI * 1.85]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh ref={glow}>
        <ringGeometry args={[2.95, 3.1, 40]} />
        <meshBasicMaterial color="#fff1c9" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}

const CONGKAK_EXTRAS = buildCongkakOnMat()

export function PlayArea() {
  const fieldProps = useMemo(buildFieldProps, [])
  const marbles = useMemo(buildMarbles, [])

  return (
    <group>
      <mesh position={[FX, 0.005, FZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[FIELD.radius, 40]} />
        <meshStandardMaterial color="#9fc463" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <PartsBundle bundle={fieldProps} castShadow={false} />
      <PartsBundle bundle={{ ball: marbles }} material={MAT.glass} />
      <Wakaf position={WAKAF.position} rotationY={-0.91} extras={CONGKAK_EXTRAS} />
      <Gasing />
      <SepakRagaBall />
      <Wau />
      <PlayMarker />
    </group>
  )
}
