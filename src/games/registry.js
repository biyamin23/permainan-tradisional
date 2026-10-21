import { CongkakGame } from './congkak/CongkakGame'

/**
 * Game id → component that runs the game. When a game's gameplay is built,
 * register it here; games without an entry show a friendly placeholder.
 * Every game component receives { game, mode, onExit }.
 */
export const GAME_COMPONENTS = {
  congkak: CongkakGame,
}
