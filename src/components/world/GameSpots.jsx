import { Component, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { games, isGameAvailable } from '../../data/games'
import { worldRuntime } from '../../state/worldRuntime'
import { ProximityBubble } from './npc/ProximityBubble'
import { SPOT_SCENES, WORLD_SPACE_SCENES } from './spots/SpotScenes'

const VISIBLE_DISTANCE = 58

/** If one spot's scene fails to draw, hide just that scene, never the whole kampung. */
class SceneBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[kampung] a game spot scene failed to draw:', error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Ring on the ground that marks a game spot. Available games pulse gold. */
function SpotMarker({ game }) {
  const ring = useRef()
  const available = isGameAvailable(game)
  const r = game.spot.radius - 0.5
  useFrame((state) => {
    if (!ring.current) return
    const t = state.clock.elapsedTime
    ring.current.rotation.z = t * (available ? 0.2 : 0.05)
    ring.current.material.opacity = available ? 0.5 + Math.sin(t * 2.2) * 0.2 : 0.22
  })
  return (
    <mesh ref={ring} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r, r + 0.16, 48, 1, 0, Math.PI * 1.88]} />
      <meshBasicMaterial color={available ? '#ffd27a' : '#fff1d6'} transparent depthWrite={false} />
    </mesh>
  )
}

function SpotSign({ game }) {
  const available = isGameAvailable(game)
  return (
    <ProximityBubble position={[0, 3.4, 0]} maxDistance={30} minDistance={game.spot.radius} variant="sign">
      <span className="spot-sign__emoji" aria-hidden="true">
        {game.emoji}
      </span>
      <span className="spot-sign__name">{game.name}</span>
      <span className={`spot-sign__status ${available ? 'is-ready' : ''}`}>{available ? 'Tersedia' : 'Akan datang'}</span>
    </ProximityBubble>
  )
}

/** One game spot: marker, sign and the little scene of kids playing. */
function GameSpot({ game }) {
  const group = useRef()
  const timer = useRef(0)
  const Scene = SPOT_SCENES[game.id]
  const [x, z] = game.spot.position
  const worldSpace = WORLD_SPACE_SCENES.has(game.id)

  // Hide far-away spots to keep phones fast (physics colliders stay active).
  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.3 || !group.current) return
    timer.current = 0
    const p = worldRuntime.playerPosition
    group.current.visible = Math.hypot(p.x - x, p.z - z) < VISIBLE_DISTANCE
  })

  return (
    <group ref={group}>
      <group position={[x, 0, z]} rotation={[0, game.spot.rotationY ?? 0, 0]}>
        <SpotMarker game={game} />
        {Scene && !worldSpace && (
          <SceneBoundary>
            <Scene game={game} />
          </SceneBoundary>
        )}
      </group>
      <group position={[x, 0, z]}>
        <SpotSign game={game} />
      </group>
      {Scene && worldSpace && (
        <SceneBoundary>
          <Scene game={game} />
        </SceneBoundary>
      )}
    </group>
  )
}

/** Every traditional game has its own spot in the kampung (data/games.js). */
export function GameSpots() {
  return games.map((game) => <GameSpot key={game.id} game={game} />)
}
