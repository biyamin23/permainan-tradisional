import { useEffect, useRef, useState } from 'react'
import { OBJECTIVE_GAME } from '../../data/games'
import { usePlayerState } from '../../state/playerState'
import { worldRuntime } from '../../state/worldRuntime'
import { SoundToggle } from './SoundToggle'

function ControlsHelp({ isTouch }) {
  if (isTouch) {
    return (
      <ul className="hud__help-list">
        <li>
          <span className="hud__help-icon">🕹️</span> Joystick kiri untuk bergerak
        </li>
        <li>
          <span className="hud__help-icon">👆</span> Seret skrin untuk pusing kamera
        </li>
        <li>
          <span className="hud__help-icon">✋</span> Butang kanan untuk main atau bersembang
        </li>
        <li>
          <span className="hud__help-icon">📍</span> Setiap permainan ada tempatnya sendiri
        </li>
      </ul>
    )
  }
  return (
    <span>
      <kbd className="keycap keycap--sm">W</kbd>
      <kbd className="keycap keycap--sm">A</kbd>
      <kbd className="keycap keycap--sm">S</kbd>
      <kbd className="keycap keycap--sm">D</kbd> bergerak · <kbd className="keycap keycap--sm">Shift</kbd> lari ·{' '}
      <kbd className="keycap keycap--sm">E</kbd> main / sembang · seret tetikus untuk pusing kamera
    </span>
  )
}

/**
 * Subtle in-world HUD. Mobile-first: greeting, objective compass and help sit in
 * one top row that never overlaps, leaving the bottom corners for the joystick
 * and the action button.
 */
export function HUD({ isTouch }) {
  const playerName = usePlayerState((s) => s.playerName)
  const arrowRef = useRef(null)
  const distanceRef = useRef(null)
  const [showHelp, setShowHelp] = useState(true)

  useEffect(() => {
    worldRuntime.hud.arrow = arrowRef.current
    worldRuntime.hud.distance = distanceRef.current
    return () => {
      worldRuntime.hud.arrow = null
      worldRuntime.hud.distance = null
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setShowHelp(false), isTouch ? 9000 : 14000)
    return () => clearTimeout(timer)
  }, [isTouch])

  return (
    <div className={`hud ${isTouch ? 'hud--touch' : ''}`}>
      <div className="hud__top">
        <div className="hud__greeting">
          <p className="hud__title">
            Selamat kembali, <span>{playerName}</span>
          </p>
          <p className="hud__subtitle">Jom tengok apa yang ada di kampung.</p>
        </div>

        <div className="hud__objective" aria-live="polite">
          <span className="hud__compass">
            <span ref={arrowRef} className="hud__arrow" aria-hidden="true">
              ▲
            </span>
          </span>
          <span className="hud__objective-text">
            <span className="hud__objective-label">Jom main {OBJECTIVE_GAME.name}</span>
            <small ref={distanceRef}>…</small>
          </span>
        </div>

        <SoundToggle className="hud__icon-btn" announce />

        {isTouch && (
          <button
            type="button"
            className={`hud__help-toggle ${showHelp ? 'is-open' : ''}`}
            onClick={() => setShowHelp((open) => !open)}
            aria-expanded={showHelp}
            aria-label="Kawalan"
          >
            {showHelp ? '✕' : '?'}
          </button>
        )}
      </div>

      {isTouch ? (
        showHelp && (
          <div className="hud__help-panel">
            <ControlsHelp isTouch />
          </div>
        )
      ) : (
        <button
          type="button"
          className={`hud__help ${showHelp ? 'is-open' : ''}`}
          onClick={() => setShowHelp((open) => !open)}
          aria-expanded={showHelp}
        >
          {showHelp ? <ControlsHelp isTouch={false} /> : <span>? Kawalan</span>}
        </button>
      )}
    </div>
  )
}
