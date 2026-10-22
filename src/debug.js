import { clock, setClockHour } from './state/timeOfDay'
import { GENDERS, SCREENS, playerActions } from './state/playerState'
import { worldRuntime } from './state/worldRuntime'

/**
 * Debug helpers (only loaded with ?debug in the URL): skip to the kampung and
 * let a script move the player, set the time and fly the camera, so the 3D
 * world can be screenshotted automatically.
 */
export function installDebug() {
  playerActions.setProfile({ name: 'Uji', gender: GENDERS.LELAKI })
  playerActions.goTo(SCREENS.KAMPUNG)
  window.__kampung = {
    teleport(x, z, yaw = 0) {
      worldRuntime.debugCamera = null
      worldRuntime.teleport = { x, z, yaw }
    },
    hour(h) {
      setClockHour(h)
      return clock.hour
    },
    camera(position, target) {
      worldRuntime.debugCamera = position ? { position, target } : null
    },
    player() {
      const p = worldRuntime.playerPosition
      return [p.x, p.y, p.z]
    },
  }
}
