import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { MathUtils, Vector3 } from 'three'
import { createBikeSound } from '../../audio/engine'
import { PersonModel } from '../../components/character/PersonModel'
import { FOOT_H } from '../../components/character/characterAnimation'
import { analyseBike, buildBike, pedalPositions } from './bikeRig'
import { FALL_TIME } from './raceSim'
import { TrackScene } from './TrackScene'

/**
 * The race in 3D: the litar, both riders on their basikal, the things in the
 * road, the chase camera, and the loop that steps the race every frame.
 */

const KID = { hip: 0.56, shoulderY: 1.06, armLen: 0.24, armR: 0.068 }

/**
 * Where a kid sits on a given bike: hips low enough that the feet reach the
 * pedals at the bottom of the stroke, leaning just enough to hold the grips.
 */
export function riderFit(rider) {
  // lean no further than a kid would; if the bars are far, the arms stretch for them
  const T = (KID.hip - FOOT_H) / 2
  const dz = rider.crank.z - rider.seatZ
  const lowest = rider.crank.y - Math.max(rider.pedalL.r, rider.pedalR.r) + FOOT_H + 0.02
  const hipY = Math.min(rider.seatY + 0.07, lowest + Math.sqrt(Math.max(0.01, (2 * T * 0.97) ** 2 - dz * dz)))
  const y = hipY - KID.hip
  const z = rider.seatZ - 0.02
  const U = (KID.armLen + KID.armR * 2) / 2
  const sy = KID.shoulderY - KID.hip
  const gy = rider.grip.y - y
  const gz = rider.grip.z - z
  let lean = 0.3
  let best = Infinity
  for (let l = 0.1; l <= 0.72; l += 0.02) {
    const d = Math.hypot(gy - (KID.hip + sy * Math.cos(l)), gz - sy * Math.sin(l))
    const err = Math.abs(d - U * 2 * 0.93)
    if (err < best) {
      best = err
      lean = l
    }
  }
  return { y, z, lean, grip: { x: rider.grip.x, y: gy, z: gz } }
}

const _feet = { L: [0, 0], R: [0, 0] }

/** 0 riding → 1 lying on the ground, through a fall (see FALL_TIME). */
function fallAmount(r) {
  if (r.fallT <= 0) return 0
  const t = FALL_TIME - r.fallT
  if (t < 0.35) return Math.sin((t / 0.35) * (Math.PI / 2))
  if (t < FALL_TIME - 0.75) return 1
  const u = (t - (FALL_TIME - 0.75)) / 0.75
  return 1 - u * u * (3 - 2 * u)
}

/** The rider measurements of a bike drawn `s` times bigger. */
function scaledRider(rider, s) {
  if (s === 1) return rider
  const p = (q) => ({ ...q, r: q.r * s, x: q.x * s })
  return {
    seatY: rider.seatY * s,
    seatZ: rider.seatZ * s,
    grip: { x: rider.grip.x * s, y: rider.grip.y * s, z: rider.grip.z * s },
    crank: { y: rider.crank.y * s, z: rider.crank.z * s },
    pedalL: p(rider.pedalL),
    pedalR: p(rider.pedalR),
  }
}

function BikeRider({ racer, race, look, url, scale = 1, sound }) {
  const { scene } = useGLTF(url)
  const parts = useMemo(() => analyseBike(url, scene), [url, scene])
  const bike = useMemo(() => buildBike(parts), [parts])
  const rider = useMemo(() => scaledRider(parts.rider, scale), [parts, scale])
  const fit = useMemo(() => riderFit(rider), [rider])
  const root = useRef()
  const pitch = useRef()
  const lean = useRef()
  const seat = useRef()
  const motion = useRef({ cycle: { L: [0, 0], R: [0, 0], grip: fit.grip, lean: fit.lean, cheer: 0, look: 0 } })
  const bikeSound = useRef(null)

  useEffect(() => {
    racer.bike = { ...racer.bike, wheelR: parts.wheelR * scale }
  }, [racer, parts, scale])
  useEffect(() => {
    if (!sound) return undefined
    bikeSound.current = createBikeSound()
    return () => bikeSound.current?.stop()
  }, [sound])

  useFrame((_, delta) => {
    const r = racer
    if (!root.current) return
    root.current.position.set(r.x, r.y, r.z)
    root.current.rotation.y = r.heading
    pitch.current.rotation.x = MathUtils.damp(pitch.current.rotation.x, -r.pitch, 10, delta)
    // a stun knocks the bike over a little before it rights itself
    const knock = r.stun > 0 ? Math.sin(Math.min(1, r.stun / 1.1) * Math.PI) * 0.45 : 0
    // off the bike: down onto its side in a blink, slide, then lifted back up
    const down = fallAmount(r)
    lean.current.rotation.z = (r.lean + knock * (r.lean >= 0 ? 1 : -1)) * (1 - down) + down * 1.42 * r.fallDir
    seat.current.position.x = -r.fallDir * down * 0.35
    seat.current.position.y = fit.y - down * 0.12
    const wob = r.wobble * Math.sin(r.wobblePhase)
    bike.pose(r.steer * 0.42 + wob * 0.5, r.distance, r.crank)

    const c = motion.current.cycle
    pedalPositions(rider, r.crank, _feet)
    c.L[0] = _feet.L[0] - fit.z
    c.L[1] = _feet.L[1] - fit.y + 0.015
    c.R[0] = _feet.R[0] - fit.z
    c.R[1] = _feet.R[1] - fit.y + 0.015
    c.lean = fit.lean + (r.boosting ? 0.12 : 0) - (r.finished ? 0.15 : 0)
    const won = r.finished && race.winner === r.name
    c.cheer = MathUtils.damp(c.cheer, won && race.phaseT > 0.3 ? 1 : 0, 4, delta)
    // a look over the shoulder now and then (Kamarul checking on you)
    const looking = r.name === 'kamarul' && race.ai.lookBack && race.ai.mistakeT > 0
    c.look = MathUtils.damp(c.look, looking ? 1 : 0, 6, delta)
    bikeSound.current?.update(r.speed, { pedalling: r.lastThrottle > 0, boosting: r.boosting, dt: delta })
  })

  return (
    <group ref={root}>
      <group ref={pitch}>
        <group ref={lean}>
          <primitive object={bike.root} scale={scale} />
          <group ref={seat} position={[0, fit.y, fit.z]}>
            <PersonModel build="kid" look={look} pose="cycle" motionRef={motion} />
          </group>
        </group>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ obstacles */

function Ayam({ o }) {
  const g = useRef()
  useFrame((state) => {
    if (!g.current) return
    const t = state.clock.elapsedTime
    const hop = o.flap > 0 ? Math.abs(Math.sin(t * 18)) * 0.25 * o.flap : Math.abs(Math.sin(t * 6 + o.k)) * 0.02
    g.current.position.set(o.x, hop, o.z)
    g.current.rotation.y = o.angle + Math.sin(t * 0.7 + o.k) * 1.2 + (o.flap > 0 ? Math.PI / 2 : 0)
  })
  return (
    <group ref={g}>
      <mesh position={[0, 0.22, 0]} scale={[0.22, 0.2, 0.3]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={o.k % 2 ? '#f3ede0' : '#9a6a3c'} />
      </mesh>
      <mesh position={[0, 0.36, 0.17]} castShadow>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={o.k % 2 ? '#f3ede0' : '#9a6a3c'} />
      </mesh>
      <mesh position={[0, 0.46, 0.17]}>
        <boxGeometry args={[0.03, 0.08, 0.1]} />
        <meshStandardMaterial color="#d8283a" />
      </mesh>
      <mesh position={[0, 0.35, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.07, 4]} />
        <meshStandardMaterial color="#f2b134" />
      </mesh>
      <mesh position={[0, 0.3, -0.26]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[0.04, 0.18, 0.1]} />
        <meshStandardMaterial color="#3a2a20" />
      </mesh>
    </group>
  )
}

function Motosikal({ o }) {
  const g = useRef()
  const motion = useRef({ speed: 0.6 })
  const look = useMemo(() => ({ skin: '#a8714a', shirt: '#d9483b', bottom: '#2d3a4f', bottomType: 'seluar', headwear: 'cap', headwearColor: '#f2f2f2', slipper: '#222' }), [])
  useFrame(() => {
    if (!g.current) return
    g.current.position.set(o.x, 0, o.z)
    g.current.rotation.y = o.angle + (o.dir > 0 ? -Math.PI / 2 : Math.PI / 2)
  })
  return (
    <group ref={g}>
      {[0.55, -0.55].map((z) => (
        <mesh key={z} position={[0, 0.3, z]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.26, 0.07, 6, 16]} />
          <meshStandardMaterial color="#1e1a1a" />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.32, 0.32, 1.0]} />
        <meshStandardMaterial color="#c0412f" />
      </mesh>
      <mesh position={[0, 0.75, -0.15]}>
        <boxGeometry args={[0.3, 0.08, 0.55]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 0.95, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
        <meshStandardMaterial color="#c9c4b8" />
      </mesh>
      <mesh position={[0, 0.82, 0.62]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={0.4} />
      </mesh>
      <group position={[0, -0.12, -0.2]}>
        <PersonModel build="adult" look={look} pose="ride" motionRef={motion} detail={false} />
      </group>
    </group>
  )
}

function Orang({ o }) {
  const g = useRef()
  const motion = useRef({ speed: 0 })
  const look = useMemo(() => ({ skin: '#c48a5c', shirt: '#5f8fb3', bottom: '#7a4a2f', bottomType: 'pelikat', headwear: 'kopiah', hair: '#cfcac0', slipper: '#3b2a20' }), [])
  useFrame(() => {
    if (!g.current) return
    g.current.position.set(o.x, 0, o.z)
    g.current.rotation.y = o.angle + (o.dir > 0 ? -Math.PI / 2 : Math.PI / 2)
    motion.current.speed = o.moving ? 0.25 : 0
  })
  return (
    <group ref={g}>
      <PersonModel build="adult" elder look={look} motionRef={motion} detail={false} />
    </group>
  )
}

function StaticObstacle({ o, track }) {
  const y = track.height[o.i]
  if (o.type === 'lopak')
    return (
      <group position={[o.x, y + 0.045, o.z]} rotation={[-Math.PI / 2, 0, o.k]}>
        <mesh scale={[1.25, 0.95, 1]} receiveShadow>
          <circleGeometry args={[o.radius, 20]} />
          <meshStandardMaterial color="#4f5d63" roughness={0.15} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, -0.005]} scale={[1.4, 1.1, 1]}>
          <circleGeometry args={[o.radius, 20]} />
          <meshStandardMaterial color="#6d4b2c" roughness={1} />
        </mesh>
      </group>
    )
  if (o.type === 'lubang')
    return (
      <group position={[o.x, y + 0.042, o.z]} rotation={[-Math.PI / 2, 0, o.k * 1.3]}>
        <mesh scale={[1.15, 0.85, 1]}>
          <circleGeometry args={[o.radius + 0.12, 9]} />
          <meshStandardMaterial color="#7a6a58" roughness={1} />
        </mesh>
        <mesh position={[0, 0, 0.004]} scale={[1.05, 0.78, 1]}>
          <circleGeometry args={[o.radius, 9]} />
          <meshStandardMaterial color="#2c241d" roughness={1} />
        </mesh>
      </group>
    )
  if (o.type === 'batu')
    return (
      <mesh position={[o.x, y + 0.14, o.z]} rotation={[o.k, o.k * 2, 0]} scale={[1, 0.6, 0.9]} castShadow>
        <dodecahedronGeometry args={[o.radius, 0]} />
        <meshStandardMaterial color="#8d8a84" flatShading />
      </mesh>
    )
  if (o.type === 'ranting')
    return (
      <group position={[o.x, y + 0.06, o.z]} rotation={[0, o.angle + 1.1, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.045, 0.06, 1.1, 5]} />
          <meshStandardMaterial color="#5e3f24" flatShading />
        </mesh>
        <mesh position={[0.2, 0.03, 0.15]} rotation={[0, 0.8, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.035, 0.5, 4]} />
          <meshStandardMaterial color="#6b4a2e" flatShading />
        </mesh>
      </group>
    )
  return null
}

function Obstacles({ race }) {
  return race.obstacles.map((o) => {
    if (o.type === 'ayam') return <Ayam key={o.k} o={o} />
    if (o.type === 'motosikal') return <Motosikal key={o.k} o={o} />
    if (o.type === 'orang') return <Orang key={o.k} o={o} />
    return <StaticObstacle key={o.k} o={o} track={race.track} />
  })
}

/* ------------------------------------------------------------------ camera */

const _pos = new Vector3()
const _look = new Vector3()
const _a = { x: 0, z: 0 }

function RaceCamera({ race }) {
  const { camera, size } = useThree()
  const state = useRef({ yaw: null, look: new Vector3(), mode: null, shake: 0 })
  useEffect(() => {
    camera.fov = size.height > size.width ? 66 : 56
    camera.near = 0.1
    camera.far = 420
    camera.updateProjectionMatrix()
  }, [camera, size])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state.current
    const you = race.you
    const k = race.kamarul
    const track = race.track
    let mode = 'chase'
    if (race.phase === 'pre') mode = 'orbit'
    else if ((race.phase === 'finish' || race.phase === 'done') && you.finished) mode = 'finish'
    const cut = s.mode !== mode && (mode === 'finish' || s.mode === null)
    s.mode = mode
    if (s.yaw === null) s.yaw = you.heading

    if (mode === 'orbit') {
      // both riders on the line; the camera drifts round them
      const mx = (you.x + k.x) / 2
      const mz = (you.z + k.z) / 2
      const a = you.heading + Math.PI * 0.75 - race.phaseT * 0.16
      _pos.set(mx + Math.sin(a) * 6, 2.1, mz + Math.cos(a) * 6)
      _look.set(mx, 0.9, mz)
    } else if (mode === 'finish') {
      // beside the line, looking back down the road at whoever is still coming
      track.point(9, -(track.width[0] / 2 + 6.5), _a)
      _pos.set(_a.x, 3, _a.z)
      const other = k.finished && race.phaseT > 1.5 ? you : k
      _look.set((other.x + track.px[0]) / 2, 1, (other.z + track.pz[0]) / 2)
    } else {
      // behind and a little above; turns with you, but a beat late
      let d = you.heading - s.yaw
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      s.yaw += d * (1 - Math.exp(-3.2 * dt))
      const back = race.phase === 'count' ? 5.4 : 4.6
      const up = race.phase === 'count' ? 2.5 : 2.05
      _pos.set(you.x - Math.sin(s.yaw) * back, you.y + up, you.z - Math.cos(s.yaw) * back)
      _look.set(you.x + Math.sin(s.yaw) * 3.2, you.y + 0.95, you.z + Math.cos(s.yaw) * 3.2)
      if (race.phase === 'count') _look.x += (k.x - you.x) * 0.3
    }

    // a knock shakes the view a touch
    if (you.events.includes('stun') || you.events.includes('fall')) s.shake = 0.22
    if (you.events.includes('shoved')) s.shake = Math.max(s.shake, 0.1)
    if (you.events.includes('hit')) s.shake = Math.max(s.shake, 0.07)
    s.shake *= Math.exp(-6 * dt)

    if (cut) {
      camera.position.copy(_pos)
      s.look.copy(_look)
    } else {
      const kp = mode === 'orbit' ? 3 : mode === 'finish' ? 2.5 : 6
      camera.position.lerp(_pos, 1 - Math.exp(-kp * dt))
      s.look.lerp(_look, 1 - Math.exp(-9 * dt))
    }
    camera.position.x += (Math.random() - 0.5) * s.shake
    camera.position.y += (Math.random() - 0.5) * s.shake
    camera.lookAt(s.look)
    // a little wider when you pecut
    const base = size.height > size.width ? 66 : 56
    const fov = MathUtils.damp(camera.fov, base + (you.boosting ? 6 : 0) + Math.min(4, you.speed * 0.35), 4, dt)
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })
  return null
}

/* ------------------------------------------------------------------ loop & light */

function Driver({ race, readInput }) {
  useFrame((_, delta) => {
    if (!race.ready) return // still loading: wait on the line
    const dt = Math.min(delta, 0.1)
    // two half steps when frames are slow, so the bikes never tunnel through things
    const steps = dt > 1 / 40 ? 2 : 1
    const input = readInput()
    race.you.lastThrottle = input.throttle
    for (let i = 0; i < steps; i++) race.step(dt / steps, input)
    race.youPos.set(race.you.x, race.you.y, race.you.z)
  })
  return null
}

function Sun({ race }) {
  const sun = useRef()
  useFrame(() => {
    const l = sun.current
    if (!l) return
    const you = race.you
    l.position.set(you.x - 18, 34, you.z + 14)
    l.target.position.set(you.x, 0, you.z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={sun}
      intensity={2.3}
      color="#ffd9a8"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-camera-near={1}
      shadow-camera-far={90}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
    />
  )
}

function Ready({ onReady }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}

export function RaceView({ race, looks, urls, readInput, onReady }) {
  return (
    <Canvas
      className="lb-canvas"
      shadows
      dpr={[1, 1.6]}
      camera={{ fov: 56, near: 0.1, far: 420, position: [0, 3, -8] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        if (window.location.search.includes('debug')) Object.assign(window, { __lbgl: gl, __lbscene: scene })
      }}
    >
      <color attach="background" args={['#cfe6ee']} />
      <fog attach="fog" args={['#e8dcbf', 55, 230]} />
      <hemisphereLight args={['#fff1d6', '#6f7a3a', 1.0]} />
      <Sun race={race} />
      <Suspense fallback={null}>
        <TrackScene track={race.track} watch={race.youPos} />
        <BikeRider racer={race.you} race={race} look={looks.you} url={urls.you.url} scale={urls.you.scale} sound />
        <BikeRider racer={race.kamarul} race={race} look={looks.kamarul} url={urls.kamarul.url} scale={urls.kamarul.scale} />
        <Obstacles race={race} />
        <Ready onReady={onReady} />
      </Suspense>
      <Driver race={race} readInput={readInput} />
      <RaceCamera race={race} />
    </Canvas>
  )
}
