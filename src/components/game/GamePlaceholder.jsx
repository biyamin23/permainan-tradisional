import { GameIcon } from './GameIcon'

/** Shown for a game whose gameplay hasn't been built yet. */
export function GamePlaceholder({ game, mode, onExit, rules = [] }) {
  return (
    <div className="game-screen__card">
      <div className="game-screen__hero" style={{ '--accent': game.accent }}>
        <GameIcon id={game.id} size={96} />
      </div>
      <p className="modal__kicker">Mod {mode === 'solo' ? 'Solo' : 'Multiplayer'}</p>
      <h2 className="game-screen__title">{game.name}</h2>
      <p className="game-screen__note">{game.name} — permainan akan dibina dalam fasa seterusnya.</p>

      {rules.length > 0 && (
        <div className="game-screen__rules">
          <p className="game-screen__rules-title">Cara bermain</p>
          <ol>
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </div>
      )}

      <button type="button" className="btn btn--primary btn--wide" onClick={onExit}>
        <span className="btn__shine" aria-hidden="true" />← BALIK KE KAMPUNG
      </button>
    </div>
  )
}
