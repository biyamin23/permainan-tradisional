import { createStore } from './createStore'

export const SCREENS = {
  LANDING: 'landing',
  CHARACTER: 'character',
  KAMPUNG: 'kampung',
  GAME_MODE: 'gameMode',
  GAME_SELECTION: 'gameSelection',
}

export const GENDERS = {
  LELAKI: 'lelaki',
  PEREMPUAN: 'perempuan',
}

export const GAME_MODES = {
  SOLO: 'solo',
  MULTIPLAYER: 'multiplayer',
}

/** Screens that keep the 3D kampung mounted underneath the UI. */
const WORLD_SCREENS = [SCREENS.KAMPUNG, SCREENS.GAME_MODE, SCREENS.GAME_SELECTION]

export const isWorldScreen = (screen) => WORLD_SCREENS.includes(screen)

const initialState = {
  playerName: '',
  playerGender: null,
  selectedGameMode: null,
  selectedGameId: null,
  currentScreen: SCREENS.LANDING,
}

export const playerStore = createStore(initialState)

/** React hook: const name = usePlayerState((s) => s.playerName) */
export const usePlayerState = playerStore.useStore

export const playerActions = {
  goTo(screen) {
    playerStore.setState({ currentScreen: screen })
  },

  setProfile({ name, gender }) {
    playerStore.setState({ playerName: name.trim(), playerGender: gender })
  },

  selectGameMode(mode) {
    playerStore.setState({ selectedGameMode: mode })
  },

  selectGame(gameId) {
    playerStore.setState({ selectedGameId: gameId })
  },

  reset() {
    playerStore.setState(initialState)
  },
}
