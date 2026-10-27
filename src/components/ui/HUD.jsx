import { useCallback, useEffect, useRef, useState } from 'react'
import { OBJECTIVE_GAME } from '../../data/games'
import { usePlayerState } from '../../state/playerState'
import { worldRuntime } from '../../state/worldRuntime'
import { PetaMap } from './PetaMap'
import { SoundToggle } from './SoundToggle'
import { AccountSheet } from './AccountSheet'
import { overallOf, useProgress } from '../../progression/engine'
import { useAuth } from '../../cloud/auth'
import { logEvent } from '../../cloud/events'
import { useKampungLive } from '../../cloud/presence'

// one "visit" per page load, counted when the kampung first appears
let visited = false

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
          <span className="hud__help-icon">🗺️</span> Tekan kompas untuk buka peta dan terus ke permainan
        </li>
      </ul>
    )
  }
  return (
    <span>
      <kbd className="keycap keycap--sm">W</kbd>
      <kbd className="keycap keycap--sm">A</kbd>
      <kbd className="keycap keycap--sm">S</kbd>
      <kbd className="keycap keycap--sm">D</kbd> bergerak · <kbd className="keycap keycap--sm">Shift</kbd> lari · <kbd className="keycap keycap--sm">Spasi</kbd> lompat ·{' '}
      <kbd className="keycap keycap--sm">E</kbd> main / sembang · <kbd className="keycap keycap--sm">M</kbd> peta · seret tetikus untuk pusing kamera
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
  const overallLevel = useProgress((s) => overallOf(s.profile).level)
  const arrowRef = useRef(null)
  const distanceRef = useRef(null)
  const labelRef = useRef(null)
  const [showHelp, setShowHelp] = useState(true)
  const [showMap, setShowMap] = useState(false)
  const closeMap = useCallback(() => setShowMap(false), [])
  // the map button glows until the map has been opened once
  const [mapSeen, setMapSeen] = useState(() => {
    try {
      return localStorage.getItem('ptm-map-seen') === '1'
    } catch {
      return false
    }
  })
  const openMap = useCallback(() => {
    setShowMap(true)
    setMapSeen(true)
    try {
      localStorage.setItem('ptm-map-seen', '1')
    } catch {
      /* fine */
    }
  }, [])
  const [sheet, setSheet] = useState(null) // null | 'profil' | 'board' | 'me'
  const closeSheet = useCallback(() => setSheet(null), [])
  const signedIn = useAuth((s) => s.status === 'in')
  const live = useKampungLive()

  useEffect(() => {
    if (signedIn && !visited) {
      visited = true
      logEvent('visit')
    }
  }, [signedIn])

  // M opens the map
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'm' || e.key === 'M') && !e.repeat && !showMap) openMap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMap, openMap])

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
        <button type="button" className="hud__greeting hud__greeting--btn" onClick={() => setSheet('profil')} aria-label="Profil kamu">
          <span className="hud__title">
            Selamat kembali, <span>{playerName}</span>
            <span className="hud__lvl" title="Level keseluruhan">Lv {overallLevel}</span>
          </span>
          <span className="hud__subtitle hud__clock">
            {live ? (
              <>
                <span className="hud__live" aria-hidden="true" /> {live} orang di kampung
              </>
            ) : (
              <>
                <span aria-hidden="true">🌇</span> Petang di kampung
              </>
            )}
          </span>
        </button>

        <button type="button" className="hud__objective" aria-live="polite" onClick={openMap} title="Arah ke permainan seterusnya">
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
        </button>

        {signedIn && (
          <button type="button" className="sound-toggle hud__icon-btn" onClick={() => setSheet('board')} aria-label="Papan pendahulu" title="Papan pendahulu">
            <span aria-hidden="true">🏆</span>
          </button>
        )}
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
      <button
        type="button"
        className={`hud__map-btn ${mapSeen ? '' : 'is-new'}`}
        onClick={openMap}
        aria-label="Buka peta kampung"
        title="Peta (M)"
      >
        <span className="hud__map-btn__icon" aria-hidden="true">
          🗺️
        </span>
        <span className="hud__map-btn__text">
          Peta
          {!isTouch && <kbd className="keycap keycap--sm">M</kbd>}
        </span>
      </button>
      {showMap && <PetaMap onClose={closeMap} />}
      {sheet && <AccountSheet live={live} startTab={sheet} onClose={closeSheet} />}
    </div>
  )
}
