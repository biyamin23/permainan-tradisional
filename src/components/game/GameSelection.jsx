import { useCallback, useState } from 'react'
import { games } from '../../data/games'
import { SCREENS, playerActions, usePlayerState } from '../../state/playerState'
import { Modal } from '../ui/Modal'
import { GameCard } from './GameCard'

/** Grid of traditional games, generated from data/games.js. */
export function GameSelection() {
  const mode = usePlayerState((s) => s.selectedGameMode)
  const [notice, setNotice] = useState(null)

  const close = useCallback(() => {
    if (notice) setNotice(null)
    else playerActions.goTo(SCREENS.KAMPUNG)
  }, [notice])

  const handleSelect = (game) => {
    playerActions.selectGame(game.id)
    setNotice(game.comingNote ?? `${game.name} — permainan akan dibina dalam fasa seterusnya.`)
  }

  return (
    <Modal onClose={close} labelledBy="games-title" className="games-panel">
      <div className="games-panel__header">
        <button type="button" className="text-button" onClick={() => playerActions.goTo(SCREENS.GAME_MODE)}>
          ← Kembali
        </button>
        <span className="mode-chip">Mod: {mode === 'solo' ? 'Solo' : 'Multiplayer'}</span>
        <button type="button" className="modal__close modal__close--inline" onClick={() => playerActions.goTo(SCREENS.KAMPUNG)} aria-label="Tutup">
          ✕
        </button>
      </div>

      <h2 id="games-title" className="modal__title">
        Permainan Apa Nak Main?
      </h2>
      <p className="modal__lead">Pilih satu. Lebih banyak permainan akan dibuka tak lama lagi.</p>

      <div className="games-grid">
        {games.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} onSelect={handleSelect} />
        ))}
      </div>

      {notice && (
        <div className="notice" role="alertdialog" aria-live="assertive">
          <div className="notice__card">
            <span className="notice__emoji" aria-hidden="true">
              🛠️
            </span>
            <p>{notice}</p>
            <button type="button" className="btn btn--primary btn--small" onClick={() => setNotice(null)} autoFocus>
              Okey!
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
