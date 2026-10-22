import { useCallback, useEffect, useRef, useState } from 'react'
import { OBJECTIVE_GAME } from '../../data/games'
import { usePlayerState } from '../../state/playerState'
import { describeTime, skipClock, timeStore, useTimeState } from '../../state/timeOfDay'
import { showToast } from '../../state/uiState'
import { worldRuntime } from '../../state/worldRuntime'
import { PetaMap } from './PetaMap'
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
          <span className="hud__help-icon">🗺️</span> Ketik kompas untuk buka peta dan terus ke permainan
        </li>
        <li>
          <span className="hud__help-icon">⏩</span> Ketik jam untuk cepatkan masa
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
      <kbd className="keycap keycap--sm">E</kbd> main / sembang · <kbd className="keycap keycap--sm">M</kbd> peta · seret tetikus untuk pusing kamera · klik jam untuk
      cepatkan masa
    </span>
  )
}

/** Kampung clock, e.g. "🌇 Petang · 5:42". Re-renders once per in-game minute. */
function ClockLabel() {
  const minute = useTimeState((s) => s.minute)
  const time = describeTime(minute)
  return (
    <p className="hud__subtitle hud__clock">
      <span aria-hidden="true">{time.icon}</span> {time.name} · {time.label}
      <span className="hud__clock-skip" aria-hidden="true">
        ⏩
      </span>
    </p>
  )
}

/** Tap the clock to jump three hours ahead. */
function fastForward() {
  skipClock(3)
  const time = describeTime(timeStore.getState().minute)
  showToast(`⏩ ${time.icon} ${time.name} · ${time.label}`)
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
  const labelRef = useRef(null)
  const [showHelp, setShowHelp] = useState(true)
  const [showMap, setShowMap] = useState(false)
  const closeMap = useCallback(() => setShowMap(false), [])

  // M opens the map
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'm' || e.key === 'M') && !e.repeat && !showMap) setShowMap(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMap])

  useEffect(() => {
    worldRuntime.hud.arrow = arrowRef.current
    worldRuntime.hud.distance = distanceRef.current
    worldRuntime.hud.label = labelRef.current
    return () => {
      worldRuntime.hud.arrow = null
      worldRuntime.hud.distance = null
      worldRuntime.hud.label = null
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setShowHelp(false), isTouch ? 9000 : 14000)
    return () => clearTimeout(timer)
  }, [isTouch])

  return (
    <div className={`hud ${isTouch ? 'hud--touch' : ''}`}>
      <div className="hud__top">
        <button type="button" className="hud__greeting" onClick={fastForward} title="Ketik untuk cepatkan masa">
          <p className="hud__title">
            Selamat kembali, <span>{playerName}</span>
          </p>
          <ClockLabel />
        </button>

        <button type="button" className="hud__objective" aria-live="polite" onClick={() => setShowMap(true)} title="Buka peta (M)">
          <span className="hud__compass">
            <span ref={arrowRef} className="hud__arrow" aria-hidden="true">
              ▲
            </span>
          </span>
          <span className="hud__objective-text">
            <span ref={labelRef} className="hud__objective-label">
              Jom main {OBJECTIVE_GAME.name}
            </span>
            <small ref={distanceRef}>…</small>
          </span>
          <span className="hud__map-badge" aria-hidden="true">
            🗺️
          </span>
        </button>

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
      {showMap && <PetaMap onClose={closeMap} />}
    </div>
  )
}
