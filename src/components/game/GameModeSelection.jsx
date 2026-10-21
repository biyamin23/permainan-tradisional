import { useCallback, useState } from 'react'
import { GAME_MODES, SCREENS, playerActions } from '../../state/playerState'
import { Modal } from '../ui/Modal'

/** "Petang ni nak main apa?" — choose Solo or Multiplayer. */
export function GameModeSelection() {
  const [comingSoonPulse, setComingSoonPulse] = useState(0)

  const close = useCallback(() => playerActions.goTo(SCREENS.KAMPUNG), [])

  const chooseSolo = () => {
    playerActions.selectGameMode(GAME_MODES.SOLO)
    playerActions.goTo(SCREENS.GAME_SELECTION)
  }

  return (
    <Modal onClose={close} labelledBy="mode-title" className="mode-panel">
      <button type="button" className="modal__close" onClick={close} aria-label="Tutup">
        ✕
      </button>
      <p className="modal__kicker">Padang Kampung</p>
      <h2 id="mode-title" className="modal__title">
        Petang ni nak main apa?
      </h2>

      <div className="mode-grid">
        <button type="button" className="mode-card mode-card--solo" onClick={chooseSolo}>
          <span className="mode-card__emoji" aria-hidden="true">
            👤
          </span>
          <span className="mode-card__name">SOLO</span>
          <span className="mode-card__desc">Main seorang diri dan cuba pecahkan rekod.</span>
          <span className="mode-card__cta">Pilih →</span>
        </button>

        <button
          type="button"
          className="mode-card mode-card--multi"
          onClick={() => setComingSoonPulse((n) => n + 1)}
          aria-disabled="true"
        >
          <span className="mode-card__soon" key={comingSoonPulse} data-pulse={comingSoonPulse > 0 ? 'true' : undefined}>
            Coming Soon
          </span>
          <span className="mode-card__emoji" aria-hidden="true">
            👥
          </span>
          <span className="mode-card__name">MULTIPLAYER</span>
          <span className="mode-card__desc">Jemput kawan dan bermain bersama.</span>
          <span className="mode-card__cta">Tak lama lagi</span>
        </button>
      </div>
    </Modal>
  )
}
