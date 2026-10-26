import { Suspense, useCallback, useEffect, useState } from 'react'
import { sfx } from '../../audio/engine'
import { getGameById } from '../../data/games'
import { GAME_COMPONENTS } from '../../games/registry'
import { Tutorial, TutorialGame, hasTutorial } from '../../games/shared/Tutorial'
import { markTutorialSeen, tutorialSeen } from '../../games/shared/tutorials'
import { logEvent } from '../../cloud/events'
import { playerActions, usePlayerState } from '../../state/playerState'
import { GamePlaceholder } from './GamePlaceholder'

/** Runs the selected game full-screen on top of the (paused) kampung. */
export function GameScreen() {
  const gameId = usePlayerState((s) => s.selectedGameId)
  const mode = usePlayerState((s) => s.selectedGameMode)
  const game = getGameById(gameId)
  // the first time a game opens, its tutorial pops up before anything else
  const [tutorial, setTutorial] = useState(() => hasTutorial(gameId) && !tutorialSeen(gameId))
  const closeTutorial = useCallback(() => {
    markTutorialSeen(gameId)
    setTutorial(false)
  }, [gameId])

  const exit = useCallback(() => {
    sfx.close()
    playerActions.backToKampung()
  }, [])

  useEffect(() => {
    if (gameId) logEvent('open', gameId)
  }, [gameId])

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
      <TutorialGame.Provider value={game.id}>
        <Suspense fallback={<p className="game-screen__loading">Memuatkan {game.name}…</p>}>
          <Game game={game} mode={mode} onExit={exit} />
        </Suspense>
        {tutorial && <Tutorial gameId={game.id} onClose={closeTutorial} />}
      </TutorialGame.Provider>
    </div>
  )
}
