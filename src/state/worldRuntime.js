import { Vector3 } from 'three'
import { SPAWN } from '../data/kampungLayout'

/**
 * Mutable per-frame values shared between the physics player, the camera, the
 * interaction tracker and a few HUD elements. These change every frame, so they
 * deliberately live outside React state to avoid re-rendering.
 */
export const worldRuntime = {
  playerPosition: new Vector3(SPAWN[0], 0, SPAWN[2]),
  playerVelocity: new Vector3(),
  playerAirborne: false,
  /** The player's Rapier body (the camera's occlusion ray ignores it). */
  playerBody: null,
  /** 0..1 landing impact; the camera dips a touch and clears it. */
  cameraKick: 0,
  /** Last time (performance.now) the player dragged the camera; auto-follow waits after it. */
  cameraDraggedAt: 0,
  cameraYaw: 0,
  cameraDistance: 9,
  /** Set { x, z, yaw } to move the player there on the next frame (map travel). */
  teleport: null,
  /** Jump the camera straight to its spot on the next frame (after a teleport). */
  cameraSnap: false,
  /** Debug only: { position: [x,y,z], target: [x,y,z] } overrides the follow camera. */
  debugCamera: null,
  /** DOM nodes the HUD registers so the Canvas can update them without re-renders. */
  hud: {
    arrow: null,
    distance: null,
  },
  /** Positions of moving NPCs/animals, read by the audio driver. */
  npc: {
    bike: new Vector3(0, 0, 999),
    bikeMoving: false,
    chickens: [],
  },
}

export function resetWorldRuntime() {
  worldRuntime.playerPosition.set(SPAWN[0], 0, SPAWN[2])
  worldRuntime.playerVelocity.set(0, 0, 0)
  worldRuntime.playerAirborne = false
  worldRuntime.playerBody = null
  worldRuntime.cameraKick = 0
  worldRuntime.cameraYaw = 0
  // Portrait phones see less to the sides, so pull the camera back a little.
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  worldRuntime.cameraDistance = portrait ? 10.5 : 9
}
