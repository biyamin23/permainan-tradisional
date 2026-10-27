import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { HOUSE, NEIGHBOUR_HOUSES, SCHOOL, YARD_FENCE } from '../../data/kampungLayout'
import { attachKeyboardInput } from '../../state/input'
import { resetClock } from '../../state/timeOfDay'
import { resetWorldRuntime } from '../../state/worldRuntime'
import { InteractionTracker } from '../interaction/InteractionSystem'
import { AudioDriver } from './AudioDriver'
import { CameraRig } from './Camera'
import { KampungEnvironment } from './Environment'
import { Fence } from './Fence'
import { Fields } from './Fields'
import { GameSpots } from './GameSpots'
import { House } from './House'
import { Life } from './Life'
import { Lighting } from './Lighting'
import { NightLights } from './NightLights'
import { Animals } from './npc/Animals'
import { NpcColliders } from './npc/NpcColliders'
import { Npcs } from './npc/Npcs'
import { Player } from './Player'
import { Props } from './Props'
import { School } from './School'
import { preloadModels } from './ModelSlot'
import { MODELS } from '../../data/models'

// start fetching the 3D models as soon as this chunk loads (it is prefetched
// while the player is still on the landing page)
preloadModels([
  MODELS.tokwan.url,
  ...MODELS.rumah.urls,
  MODELS.warung.url,
  MODELS.sekolah.url,
  MODELS.jambatan.url,
  MODELS.airTerjun.url,
  MODELS.ragaLama.url,
  MODELS.bangku.url,
  MODELS.lampuPadang.url,
  MODELS.sampan.url,
  MODELS.basikal.url,
  MODELS.kelapa.url,
])
import { Trees } from './Trees'
import { Water } from './Water'

/**
 * The explorable 3D kampung. Everything here is built from primitives —
 * no models, textures or image files.
 */
export function KampungWorld({ gender, controlsEnabled, paused = false }) {
  useEffect(() => {
    resetWorldRuntime()
    resetClock()
    return attachKeyboardInput()
  }, [])

  return (
    <Canvas
      className="kampung-canvas"
      frameloop={paused ? 'never' : 'always'}
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 50, near: 0.1, far: 700, position: [6, 16, 52] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        // ?debug: let scripts read draw calls / frame stats and inspect the scene
        if (window.location.search.includes('debug')) Object.assign(window, { __gl: gl, __scene: scene })
      }}
    >
      <fog attach="fog" args={['#f0c08d', 60, 260]} />
      <Lighting />

      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]} paused={paused}>
          <KampungEnvironment />
          <Water />
          <House position={HOUSE.position} rotationY={HOUSE.rotationY} variant="tokwan" />
          {NEIGHBOUR_HOUSES.map((house, i) => (
            <House key={i} index={i} position={house.position} rotationY={house.rotationY} variant={house.variant} />
          ))}
          <School position={SCHOOL.position} rotationY={SCHOOL.rotationY} />
          <Fence segments={YARD_FENCE} />
          <Trees />
          <Props />
          <Fields />
          <GameSpots />
          <Npcs />
          <Animals />
          <NpcColliders />
          <Life />
          <NightLights />
          <Player gender={gender} enabled={controlsEnabled} />
          {/* inside Physics: the camera casts a ray so walls don't come between it and you */}
          <CameraRig />
        </Physics>
      </Suspense>

      <InteractionTracker />
      <AudioDriver />
    </Canvas>
  )
}
