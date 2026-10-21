import { Vector3 } from 'three'
import { SPAWN } from '../data/kampungLayout'

/**
 * Mutable per-frame values shared between the physics player, the camera, the
 * interaction tracker and a few HUD elements. These change every frame, so they
 * deliberately live outside React state to avoid re-rendering.
 */
export const worldRuntime = {
  playerPosition: new Vector3(SPAWN[0], 0, SPAWN[2]),
  cameraYaw: 0,
  cameraDistance: 9,
  /** DOM nodes the HUD registers so the Canvas can update them without re-renders. */
  hud: {
    arrow: null,
    distance: null,
  },
}

export function resetWorldRuntime() {
  worldRuntime.playerPosition.set(SPAWN[0], 0, SPAWN[2])
  worldRuntime.cameraYaw = 0
  // Portrait phones see less to the sides, so pull the camera back a little.
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  worldRuntime.cameraDistance = portrait ? 10.5 : 9
}
