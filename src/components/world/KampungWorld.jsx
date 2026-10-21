import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { HOUSE, NEIGHBOUR_HOUSES, YARD_FENCE } from '../../data/kampungLayout'
import { attachKeyboardInput } from '../../state/input'
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
import { Animals } from './npc/Animals'
import { Npcs } from './npc/Npcs'
import { Player } from './Player'
import { Trees } from './Trees'
import { Water } from './Water'

/**
 * The explorable 3D kampung. Everything here is built from primitives —
 * no models, textures or image files.
 */
export function KampungWorld({ gender, controlsEnabled }) {
  useEffect(() => {
    resetWorldRuntime()
    return attachKeyboardInput()
  }, [])

  return (
    <Canvas
      className="kampung-canvas"
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 50, near: 0.1, far: 600, position: [6, 16, 52] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <fog attach="fog" args={['#f0c08d', 55, 230]} />
      <Lighting />

      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]}>
          <KampungEnvironment />
          <Water />
          <House position={HOUSE.position} rotationY={HOUSE.rotationY} variant="tokwan" />
          {NEIGHBOUR_HOUSES.map((house) => (
            <House key={house.variant} position={house.position} rotationY={house.rotationY} variant={house.variant} />
          ))}
          <Fence segments={YARD_FENCE} />
          <Trees />
          <Fields />
          <GameSpots />
          <Npcs />
          <Animals />
          <Life />
          <Player gender={gender} enabled={controlsEnabled} />
        </Physics>
      </Suspense>

      <CameraRig />
      <InteractionTracker />
      <AudioDriver />
    </Canvas>
  )
}
