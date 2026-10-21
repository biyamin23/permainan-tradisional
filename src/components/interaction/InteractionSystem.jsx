import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { sfx } from '../../audio/engine'
import { getGameById, isGameAvailable } from '../../data/games'
import { INTERACTION_ACTIONS, interactables } from '../../data/interactables'
import { getNpcById } from '../../data/npcs'
import { SCREENS, playerActions, playerStore } from '../../state/playerState'
import { interactionStore, showToast } from '../../state/uiState'
import { worldRuntime } from '../../state/worldRuntime'

/**
 * Reusable interaction system.
 *
 * - Zones are plain data (data/interactables.js).
 * - <InteractionTracker/> runs inside the Canvas and finds the zone the player is in.
 * - useInteractionKey() listens for E and runs the zone's action handler.
 * - New behaviour is added with registerInteractionHandler(action, handler).
 */

const handlers = new Map()

export function registerInteractionHandler(action, handler) {
  handlers.set(action, handler)
  return () => handlers.delete(action)
}

// Each game spot opens its own game: Solo/Multiplayer, then straight into play.
registerInteractionHandler(INTERACTION_ACTIONS.OPEN_GAME, (zone) => {
  const game = getGameById(zone.gameId)
  if (!game) return
  if (isGameAvailable(game)) {
    sfx.select()
    playerActions.openGame(game.id)
  } else {
    sfx.locked()
    showToast(`${game.name} akan datang tak lama lagi! 🔒`)
  }
})

const talkProgress = new Map()
registerInteractionHandler(INTERACTION_ACTIONS.TALK, (zone) => {
  const npc = getNpcById(zone.npcId)
  if (!npc) return
  const index = talkProgress.get(npc.id) ?? 0
  talkProgress.set(npc.id, index + 1)
  sfx.talk()
  showToast(`${npc.name}: “${npc.lines[index % npc.lines.length]}”`)
})

registerInteractionHandler(INTERACTION_ACTIONS.MESSAGE, (zone) => {
  if (zone.message) showToast(zone.message)
})

export const getZoneById = (id) => interactables.find((zone) => zone.id === id) ?? null

/** Run the action of the zone the player is currently standing in. */
export function interactWithActiveZone() {
  const { activeZoneId } = interactionStore.getState()
  if (!activeZoneId) return false
  if (playerStore.getState().currentScreen !== SCREENS.KAMPUNG) return false
  const zone = getZoneById(activeZoneId)
  const handler = zone && handlers.get(zone.action)
  if (!handler) return false
  handler(zone)
  return true
}

/** Inside <Canvas>: picks the closest zone (relative to its radius) each frame. */
export function InteractionTracker() {
  useFrame(() => {
    const p = worldRuntime.playerPosition
    let best = null
    let bestScore = Infinity
    for (const zone of interactables) {
      const dx = p.x - zone.position[0]
      const dz = p.z - zone.position[1]
      const score = Math.hypot(dx, dz) / zone.radius
      if (score < 1 && score < bestScore) {
        best = zone
        bestScore = score
      }
    }
    const id = best ? best.id : null
    if (interactionStore.getState().activeZoneId !== id) {
      interactionStore.setState({ activeZoneId: id })
    }
  })

  useEffect(() => () => interactionStore.setState({ activeZoneId: null }), [])

  return null
}

/** DOM side: press E to interact. */
export function useInteractionKey() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'KeyE' || event.repeat) return
      const target = event.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      interactWithActiveZone()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
