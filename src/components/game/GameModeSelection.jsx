import { useCallback, useState } from 'react'
import { sfx } from '../../audio/engine'
import { getGameById } from '../../data/games'
import { GAME_MODES, playerActions, usePlayerState } from '../../state/playerState'
import { Modal } from '../ui/Modal'
import { GameIcon } from './GameIcon'
import { MasteryStatus } from '../progress/Progress'
import { GAME_IDS } from '../../progression/config'
import { ONLINE_GAMES } from '../../cloud/match'

/** Opened from a game spot: Solo or Multiplayer, then straight into that game. */
export function GameModeSelection() {
  const gameId = usePlayerState((s) => s.selectedGameId)
  const game = getGameById(gameId)
  const [comingSoonPulse, setComingSoonPulse] = useState(0)

  const close = useCallback(() => {
    sfx.close()
    playerActions.backToKampung()
  }, [])

  if (!game) return null

  const soloAvailable = game.modes.includes(GAME_MODES.SOLO)
  const onlineAvailable = ONLINE_GAMES.includes(game.id)

  const chooseSolo = () => {
    if (!soloAvailable) {
      sfx.locked()
      return
    }
    sfx.select()
    playerActions.startGame(GAME_MODES.SOLO)
  }

  const chooseMultiplayer = () => {
    if (!onlineAvailable) {
      sfx.locked()
      setComingSoonPulse((n) => n + 1)
      return
    }
    sfx.select()
    playerActions.startGame(GAME_MODES.MULTIPLAYER)
  }

  return (
    <Modal onClose={close} labelledBy="mode-title" className="mode-panel" style={{ '--accent': game.accent }}>
      <button type="button" className="modal__close" onClick={close} aria-label="Tutup">
        ✕
      </button>
      <div className="mode-panel__game">
        <span className="mode-panel__icon">
          <GameIcon id={game.id} size={52} />
        </span>
        <span>
          <p className="modal__kicker">{game.name}</p>
          <h2 id="mode-title" className="modal__title">
            Petang ni nak main macam mana?
          </h2>
        </span>
      </div>
      {GAME_IDS.includes(game.id) && (
        <div className="mode-panel__mastery">
          <MasteryStatus gameId={game.id} note={null} />
        </div>
      )}

      <div className="mode-grid">
        <button type="button" className="mode-card mode-card--solo" onClick={chooseSolo}>
          <span className="mode-card__emoji" aria-hidden="true">
            👤
          </span>
          <span className="mode-card__name">SOLO</span>
          <span className="mode-card__desc">Main seorang diri dan cuba pecahkan rekod.</span>
          <span className="mode-card__cta">Jom main →</span>
        </button>

        <button
          type="button"
          className={`mode-card mode-card--multi ${onlineAvailable ? 'is-open' : ''}`}
          onClick={chooseMultiplayer}
          aria-disabled={onlineAvailable ? undefined : 'true'}
        >
          {!onlineAvailable && (
            <span className="mode-card__soon" key={comingSoonPulse} data-pulse={comingSoonPulse > 0 ? 'true' : undefined}>
              Coming Soon
            </span>
          )}
          <span className="mode-card__emoji" aria-hidden="true">
            👥
          </span>
          <span className="mode-card__name">MULTIPLAYER</span>
          <span className="mode-card__desc">Jemput kawan dan bermain bersama.</span>
          <span className="mode-card__cta">{onlineAvailable ? 'Jemput kawan →' : 'Tak lama lagi'}</span>
        </button>
      </div>
    </Modal>
  )
}
