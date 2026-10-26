import { createStore } from './createStore'

export const SCREENS = {
  LANDING: 'landing',
  LOGIN: 'login',
  CHARACTER: 'character',
  KAMPUNG: 'kampung',
  GAME_MODE: 'gameMode',
  GAME: 'game',
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
const WORLD_SCREENS = [SCREENS.KAMPUNG, SCREENS.GAME_MODE, SCREENS.GAME]

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

  /** Walked up to a game spot: ask Solo or Multiplayer for that game. */
  openGame(gameId) {
    playerStore.setState({ selectedGameId: gameId, selectedGameMode: null, currentScreen: SCREENS.GAME_MODE })
  },

  /** Mode chosen: go straight into the selected game. */
  startGame(mode) {
    playerStore.setState({ selectedGameMode: mode, currentScreen: SCREENS.GAME })
  },

  backToKampung() {
    playerStore.setState({ currentScreen: SCREENS.KAMPUNG })
  },

  reset() {
    playerStore.setState(initialState)
  },
}
