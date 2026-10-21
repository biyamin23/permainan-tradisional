import { BRIDGE, FIELD, HOUSE, POND, SAWAH, SCARECROW } from './kampungLayout'

/**
 * Interaction zones in the kampung. The interaction system picks the closest
 * zone the player is inside and shows its prompt; pressing E runs `action`.
 *
 * To add a future game spot: add a zone here with a new action type and
 * register a handler for it (see components/interaction/InteractionSystem.jsx).
 *
 * position: [x, z] centre on the ground, radius in metres.
 */
export const INTERACTION_ACTIONS = {
  OPEN_GAME_MODE: 'openGameMode',
  MESSAGE: 'message',
}

export const interactables = [
  {
    id: 'padang',
    label: 'Tempat bermain',
    prompt: 'Tekan E untuk melihat permainan',
    position: FIELD.center,
    radius: 8.5,
    action: INTERACTION_ACTIONS.OPEN_GAME_MODE,
    isObjective: true,
  },
  {
    id: 'rumah-tok-wan',
    label: 'Rumah Tok Wan',
    prompt: 'Tekan E untuk berinteraksi',
    position: [HOUSE.position[0], HOUSE.position[2] + 10.3],
    radius: 3.4,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Tok Wan tengah goreng cucur udang. Lepas main nanti, singgah makan ya!',
  },
  {
    id: 'kolam',
    label: 'Kolam',
    prompt: 'Tekan E untuk berinteraksi',
    position: POND.center,
    radius: POND.radius + 2.6,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Airnya tenang. Nampak anak ikan puyu berenang di celah teratai.',
  },
  {
    id: 'jambatan',
    label: 'Jambatan Kayu',
    prompt: 'Tekan E untuk berinteraksi',
    position: [BRIDGE.x, BRIDGE.z],
    radius: 4,
    action: INTERACTION_ACTIONS.MESSAGE,
    message: 'Dulu-dulu, dari sinilah budak-budak kampung terjun ke sungai.',
  },
  {
    id: 'sawah',
    label: 'Sawah Padi',
    prompt: 'Tekan E untuk berinteraksi',
    position: [1.8, SAWAH.zMax - 4],
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
