import { useCallback, useEffect } from 'react'
import { sfx } from '../../audio/engine'
import { getGameById } from '../../data/games'
import { GAME_COMPONENTS } from '../../games/registry'
import { playerActions, usePlayerState } from '../../state/playerState'
import { GamePlaceholder } from './GamePlaceholder'

/** Runs the selected game full-screen on top of the (paused) kampung. */
export function GameScreen() {
  const gameId = usePlayerState((s) => s.selectedGameId)
  const mode = usePlayerState((s) => s.selectedGameMode)
  const game = getGameById(gameId)

  const exit = useCallback(() => {
    sfx.close()
    playerActions.backToKampung()
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exit])

  if (!game) return null
  const Game = GAME_COMPONENTS[game.id] ?? GamePlaceholder

  return (
    <div className="game-screen" role="dialog" aria-modal="true" aria-label={game.name}>
      <Game game={game} mode={mode} onExit={exit} />
    </div>
  )
}
