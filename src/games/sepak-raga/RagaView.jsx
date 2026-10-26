import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, MathUtils, SRGBColorSpace } from 'three'
import { PersonModel } from '../../components/character/PersonModel'
import { ModelSlot } from '../../components/world/ModelSlot'
import { MODELS } from '../../data/models'
import { TEAM_YOU } from './engine'
import { R, ballAt, now, spotOf } from './useRagaMatch'
import { RagaBall } from './RagaBall'

/**
 * The 3D padang for a match: the 6 m circle with the 2 m circle inside, the
 * team in play round it, the other team on the bench, the ball and (when the
 * ball comes to you) the timing ring.
 */

const BALL_R = 0.12
const BENCH_Z = -R - 2.6

function ClockBridge({ g }) {
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    g.current.clockNow = () => clock.elapsedTime
  }, [clock, g])
  return null
}

/** Fit the circle across the screen whatever its shape. */
function CameraFit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1)
    const hFov = MathUtils.degToRad(64)
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect)
    camera.fov = MathUtils.clamp(MathUtils.radToDeg(vFov), 38, 78)
    const tall = aspect < 0.8
    camera.position.set(0, tall ? 4.6 : 5.2, R + (tall ? 6.3 : 7))
    camera.lookAt(0, tall ? 0.5 : 0.6, -0.8)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function Court() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color="#86ad4c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[R + 1.1, 48]} />
        <meshStandardMaterial color="#c9a46c" roughness={1} />
      </mesh>
      {[R, 1].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[r - 0.04, r + 0.04, 64]} />
          <meshBasicMaterial color="#f6f1e2" />
        </mesh>
      ))}
    </group>
  )
}

const TREE_SPOTS = (() => {
  const out = []
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.sin(i * 7.1) * 0.08
    const d = 12 + ((i * 37) % 7)
    out.push({ x: Math.sin(a) * d, z: -Math.cos(a) * d, s: 0.9 + ((i * 13) % 5) * 0.12, palm: i % 3 === 0 })
  }
  // keep the view behind the camera clear
  return out.filter((t) => t.z < 6)
})()

function Scenery() {
  return (
    <group>
      {TREE_SPOTS.map((t, i) =>
        t.palm ? (
          <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
            <mesh position={[0, 3, 0]} rotation={[0, 0, 0.08]}>
              <cylinderGeometry args={[0.16, 0.24, 6, 6]} />
              <meshStandardMaterial color="#8a7154" flatShading />
            </mesh>
            {Array.from({ length: 7 }, (_, k) => (
              <mesh key={k} position={[Math.sin((k / 7) * 6.28) * 0.9, 5.9, Math.cos((k / 7) * 6.28) * 0.9]} rotation={[Math.cos((k / 7) * 6.28) * 0.6, 0, -Math.sin((k / 7) * 6.28) * 0.6]}>
                <boxGeometry args={[0.4, 0.05, 1.9]} />
                <meshStandardMaterial color={k % 2 ? '#5f9a3c' : '#6aa443'} flatShading />
              </mesh>
            ))}
          </group>
        ) : (
          <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.2, 0.3, 2.4, 6]} />
              <meshStandardMaterial color="#6b4a2e" flatShading />
            </mesh>
            <mesh position={[0, 3.2, 0]}>
              <icosahedronGeometry args={[1.9, 0]} />
              <meshStandardMaterial color={i % 2 ? '#4f8a3a' : '#5a9440'} flatShading />
            </mesh>
          </group>
        ),
      )}
      {[-6.2, 6.2].map((x) => (
        // lamp heads lean in over the circle
        <group key={x} position={[x, 0, -R - 3.6]} rotation={[0, Math.atan2(x, -(R + 3.6)), 0]}>
          <ModelSlot
            model={MODELS.lampuPadang}
            fallback={
              <>
                <mesh position={[0, 2.4, 0]}>
                  <cylinderGeometry args={[0.07, 0.09, 4.8, 6]} />
                  <meshStandardMaterial color="#5a5a5a" />
                </mesh>
                <mesh position={[0, 4.85, 0.25]}>
                  <boxGeometry args={[0.5, 0.18, 0.5]} />
                  <meshStandardMaterial color="#e8e4d4" />
                </mesh>
              </>
            }
          />
        </group>
      ))}
    </group>
  )
}

function Bench({ x }) {
  return (
    <group position={[x, 0, BENCH_Z - 0.35]}>
      <ModelSlot
        model={MODELS.bangku}
        fallback={
          <>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[2.5, 0.07, 0.42]} />
              <meshStandardMaterial color="#9a6a3c" flatShading />
            </mesh>
            {[-1.05, 1.05].map((lx) => (
              <mesh key={lx} position={[lx, 0.2, 0]}>
                <boxGeometry args={[0.08, 0.4, 0.36]} />
                <meshStandardMaterial color="#6b4628" />
              </mesh>
            ))}
          </>
        }
      />
    </group>
  )
}

/** Papan mata: the two teams' points, chalked on a board. */
const FACE = MODELS.papanMata.url ? MODELS.papanMata.face : null
function Scoreboard({ mine, theirs, round }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => {
    const c = tex.image
    const x = c.getContext('2d')
    x.fillStyle = '#24402f'
    x.fillRect(0, 0, 256, 160)
    x.fillStyle = '#f2efe4'
    x.textAlign = 'center'
    x.font = 'bold 22px sans-serif'
    x.fillText(`PUSINGAN ${round}`, 128, 30)
    x.font = 'bold 18px sans-serif'
    x.fillText('KAMU', 66, 62)
    x.fillText('PAK-PAK', 190, 62)
    x.font = 'bold 64px sans-serif'
    x.fillText(String(mine), 66, 130)
    x.fillText(String(theirs), 190, 130)
    x.fillRect(127, 46, 2, 100)
    tex.needsUpdate = true
  }, [tex, mine, theirs, round])
  return (
    <group position={[-5, 0, -R - 1.4]} rotation={[0, 0.5, 0]} scale={FACE ? 1.3 : 1}>
      <ModelSlot
        model={MODELS.papanMata}
        fallback={
          <>
            {[-0.75, 0.75].map((lx) => (
              <mesh key={lx} position={[lx, 0.8, -0.05]}>
                <boxGeometry args={[0.08, 1.6, 0.08]} />
                <meshStandardMaterial color="#6b4628" />
              </mesh>
            ))}
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[1.8, 1.15, 0.06]} />
              <meshStandardMaterial color="#7d5130" />
            </mesh>
          </>
        }
      />
      {FACE ? (
        <mesh position={FACE.position} rotation={[FACE.tilt, 0, 0]}>
          <planeGeometry args={FACE.size} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ) : (
        <mesh position={[0, 1.5, 0.04]}>
          <planeGeometry args={[1.6, 1.0]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** The team in the circle. */
function Circle({ team, members, acts }) {
  return members.map((m, i) => {
    const [x, , z] = spotOf(i)
    return (
      <group key={m.id} position={[x, 0, z]} rotation={[0, Math.atan2(-x, -z), 0]}>
        <PersonModel build={m.build} look={m.look} pose="raga" actionRef={{ current: acts[team][i] }} phase={i * 0.7} />
      </group>
    )
  })
}

/** The team waiting their turn, on the bench behind the circle. */
function Watchers({ members, cheering }) {
  return members.map((m, i) => {
    const x = (i - (members.length - 1) / 2) * 0.95
    const adult = m.build === 'adult'
    const seatY = adult ? 0.33 : 0.34
    return (
      <group key={m.id} position={[x, seatY, BENCH_Z]}>
        <PersonModel build={m.build} look={m.look} pose={cheering ? 'clap' : 'sitDangle'} phase={i * 0.9} detail={false} />
      </group>
    )
  })
}

function Ball({ g }) {
  const ref = useRef()
  const shadow = useRef()
  useFrame((_, delta) => {
    const f = g.current.flight
    const p = ballAt(f, now())
    if (!ref.current) return
    ref.current.visible = Boolean(p)
    if (shadow.current) shadow.current.visible = Boolean(p)
    if (!p) return
    ref.current.position.set(p[0], Math.max(BALL_R, p[1]), p[2])
    if (f.kind !== 'hold') {
      ref.current.rotation.x += delta * 7
      ref.current.rotation.z += delta * 3
    }
    if (shadow.current) {
      shadow.current.position.set(p[0], 0.03, p[2])
      const s = MathUtils.clamp(1.2 - p[1] * 0.18, 0.4, 1.2)
      shadow.current.scale.set(s, s, s)
    }
  })
  return (
    <>
      <group ref={ref}>
        <RagaBall radius={BALL_R} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.12, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </>
  )
}

/** The ring that closes on the ball as it reaches you: tap when it meets the white ring. */
function TimingRing({ g }) {
  const group = useRef()
  const closing = useRef()
  const mat = useRef()
  useFrame(({ camera }) => {
    const s = g.current
    const win = s.window
    if (!group.current) return
    group.current.visible = Boolean(win)
    if (!win) return
    const f = s.flight
    const target = f?.to ?? [0, 0.85, R * 0.84]
    group.current.position.set(target[0], target[1], target[2])
    group.current.quaternion.copy(camera.quaternion)
    const left = win.tc - now()
    const u = MathUtils.clamp(left / 1.0, 0, 1)
    if (closing.current) closing.current.scale.setScalar(1 + u * 2.4)
    if (mat.current) mat.current.color.set(Math.abs(left) <= win.w ? '#3fd16a' : '#ffd45e')
  })
  return (
    <group ref={group} visible={false} renderOrder={10}>
      <mesh renderOrder={10}>
        <ringGeometry args={[0.2, 0.25, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} />
      </mesh>
      <mesh ref={closing} renderOrder={11}>
        <ringGeometry args={[0.19, 0.24, 40]} />
        <meshBasicMaterial ref={mat} color="#ffd45e" transparent opacity={0.95} depthTest={false} />
      </mesh>
    </group>
  )
}

export function RagaView({ g, teams, team, scores, round, cheering }) {
  const benched = team === TEAM_YOU ? 1 : 0
  return (
    <Canvas className="sr-canvas" shadows dpr={[1, 1.75]} camera={{ fov: 50, near: 0.1, far: 120, position: [0, 4, 9] }}>
      <color attach="background" args={['#bfe3ee']} />
      <fog attach="fog" args={['#cfe6e0', 18, 48]} />
      <hemisphereLight args={['#fff4dc', '#6f8a4a', 0.9]} />
      <directionalLight
        position={[6, 10, 5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <ClockBridge g={g} />
      <CameraFit />
      <Court />
      <Scenery />
      <Bench x={-1.5} />
      <Bench x={1.5} />
      <group position={[5.6, 0, -1.4]} rotation={[0, -0.5, 0]}>
        <ModelSlot model={MODELS.meja} fallback={null} />
      </group>
      <Scoreboard mine={scores[0]} theirs={scores[1]} round={round} />
      <Circle team={team} members={teams[team]} acts={g.current.acts} />
      <Watchers members={teams[benched]} cheering={cheering} />
      <Ball g={g} />
      <TimingRing g={g} />
    </Canvas>
  )
}

