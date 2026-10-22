import { games, isGameAvailable } from './games'
import { BRIDGES, POND, SAWAH, SCARECROW } from './kampungLayout'
import { NPCS } from './npcs'

/**
 * Interaction zones in the kampung. The interaction system picks the closest
 * zone the player is inside and shows its prompt; pressing E (or the action
 * button on touch screens) runs `action`.
 *
 * Game zones and NPC zones are generated from data/games.js and data/npcs.js.
 * To add a new kind of behaviour, add an action type here and register a
 * handler for it (see components/interaction/InteractionSystem.jsx).
 *
 * position: [x, z] centre on the ground, radius in metres.
 * actionLabel / actionIcon: text and emoji on the touch action button.
 */
export const INTERACTION_ACTIONS = {
  OPEN_GAME: 'openGame',
  TALK: 'talk',
  MESSAGE: 'message',
}

const gameZones = games.map((game) => {
  const available = isGameAvailable(game)
  return {
    id: `game-${game.id}`,
    gameId: game.id,
    label: game.name,
    prompt: available ? `Tekan E untuk main ${game.name}` : `Tekan E — ${game.name} akan datang`,
    position: game.spot.position,
    radius: game.spot.radius,
    action: INTERACTION_ACTIONS.OPEN_GAME,
    actionLabel: available ? 'Main' : 'Lihat',
    actionIcon: available ? game.emoji : '🔒',
    isObjective: available,
  }
})

const npcZones = NPCS.map((npc) => ({
  id: `npc-${npc.id}`,
  npcId: npc.id,
  label: npc.name,
  prompt: 'Tekan E untuk bersembang',
  position: npc.zone.position,
  radius: npc.zone.radius,
  action: INTERACTION_ACTIONS.TALK,
  actionLabel: 'Sembang',
  actionIcon: '💬',
}))

const placeZones = [
  {
    id: 'sungai',
    label: 'Tepi Sungai',
    prompt: 'Tekan E untuk berinteraksi',
    position: POND.center,
    radius: POND.radius + 2.6,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Air sungai mengalir tenang. Itik berenang di selekoh sungai.',
  },
  {
    id: 'jambatan',
    label: 'Jambatan Kayu',
    prompt: 'Tekan E untuk berinteraksi',
    position: [BRIDGES[0].x, BRIDGES[0].z],
    radius: 4,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Dulu-dulu, dari sinilah budak-budak kampung terjun ke sungai.',
  },
  {
    id: 'sawah',
    label: 'Sawah Padi',
    prompt: 'Tekan E untuk berinteraksi',
    position: [SAWAH.xMax - 4, SAWAH.zMax + 1],
    radius: 3.5,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Padi dah menguning. Angin petang bawa bau sawah yang wangi.',
  },
  {
    id: 'orang-orang',
    label: 'Orang-Orang',
    prompt: 'Tekan E untuk berinteraksi',
    position: [SCARECROW.position[0], SCARECROW.position[2] + 1.2],
    radius: 3,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Pak Mat dah lama berdiri di sini. Burung pipit pun dah tak takut.',
  },
]

export const interactables = [...gameZones, ...npcZones, ...placeZones]
