import { useState } from 'react'
import { isGameAvailable } from '../../data/games'
import { GameIcon } from './GameIcon'

/** One card in the game selection grid. Driven entirely by the game's data. */
export function GameCard({ game, index, onSelect }) {
  const available = isGameAvailable(game)
  const [nudge, setNudge] = useState(0)

  const handleClick = () => {
    if (available) onSelect(game)
    else setNudge((n) => n + 1)
  }

  return (
    <button
      type="button"
      className={`game-card ${available ? 'is-available' : 'is-locked'}`}
      style={{ '--accent': game.accent, '--i': index }}
      onClick={handleClick}
      aria-disabled={!available}
      aria-label={`${game.name} — ${available ? 'Tersedia' : 'Akan datang'}`}
    >
      <span className={`game-card__badge ${available ? 'is-ready' : ''}`}>{available ? 'TERSEDIA' : 'AKAN DATANG'}</span>
      <span className="game-card__icon" key={nudge} data-nudge={nudge > 0 ? 'true' : undefined}>
        <GameIcon id={game.id} />
      </span>
      <span className="game-card__name">{game.name}</span>
      <span className="game-card__tagline">{game.tagline}</span>
      <span className="game-card__meta">
        {game.players}
        {!available && <span className="game-card__lock" aria-hidden="true">🔒</span>}
      </span>
    </button>
  )
}
