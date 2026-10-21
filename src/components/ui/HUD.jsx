import { useEffect, useRef, useState } from 'react'
import { usePlayerState } from '../../state/playerState'
import { worldRuntime } from '../../state/worldRuntime'

/** Subtle in-world HUD: greeting, objective pointer and a fading controls hint. */
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
    const timer = setTimeout(() => setShowHelp(false), 14000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="hud">
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
          Pergi ke padang
          <small ref={distanceRef}>…</small>
        </span>
      </div>

      <button
        type="button"
        className={`hud__help ${showHelp ? 'is-open' : ''}`}
        onClick={() => setShowHelp((open) => !open)}
        aria-expanded={showHelp}
      >
        {showHelp ? (
          isTouch ? (
            <span>Guna joystick untuk bergerak · Seret skrin untuk pusing kamera · Ketik butang untuk berinteraksi</span>
          ) : (
            <span>
              <kbd className="keycap keycap--sm">W</kbd>
              <kbd className="keycap keycap--sm">A</kbd>
              <kbd className="keycap keycap--sm">S</kbd>
              <kbd className="keycap keycap--sm">D</kbd> bergerak · <kbd className="keycap keycap--sm">Shift</kbd> lari ·{' '}
              <kbd className="keycap keycap--sm">E</kbd> berinteraksi · seret tetikus untuk pusing kamera
            </span>
          )
        ) : (
          <span>? Kawalan</span>
        )}
      </button>
    </div>
  )
}
