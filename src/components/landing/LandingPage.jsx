import { useEffect, useRef, useState } from 'react'
import { initAudio, sfx, startAmbience } from '../../audio/engine'
import { setSoundMode, useAudioState } from '../../state/audioState'
import { SCREENS, playerActions } from '../../state/playerState'
import { authActions, authStore, explain, screenAfterLogin, useAuth } from '../../cloud/auth'
import './landing.css'

const LEAVE_DURATION = 750
const MOTION_KEY = 'ptm-reduced-motion'

function loadReducedMotion() {
  try {
    return window.localStorage.getItem(MOTION_KEY) === '1'
  } catch {
    return false
  }
}

// a modest phone: fewer motes, no parallax
const lowEnd = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4

/**
 * Parallax: the pointer (or tilting the phone) nudges the layers a few pixels,
 * deeper layers less. Writes --px/--py on the scene, once per frame at most.
 */
function useParallax(ref, enabled) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return undefined
    let raf = 0
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    const step = () => {
      x += (tx - x) * 0.08
      y += (ty - y) * 0.08
      el.style.setProperty('--px', x.toFixed(3))
      el.style.setProperty('--py', y.toFixed(3))
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0
    }
    const aim = (nx, ny) => {
      tx = Math.max(-1, Math.min(1, nx))
      ty = Math.max(-1, Math.min(1, ny))
      if (!raf) raf = requestAnimationFrame(step)
    }
    const onPointer = (e) => aim((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    const onTilt = (e) => {
      if (e.gamma == null) return
      aim(e.gamma / 25, (e.beta - 45) / 30)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('deviceorientation', onTilt, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onTilt)
    }
  }, [ref, enabled])
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        transform="translate(-1 0)"
      />
    </svg>
  )
}

function SoundIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
      {on ? (
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  )
}

/** Settings: sound (all / sound only / off) and calmer motion. */
function Settings({ reduced, setReduced, onClose }) {
  const mode = useAudioState((s) => s.mode)
  const pick = (m) => {
    initAudio()
    setSoundMode(m)
    if (m !== 'off') {
      startAmbience()
      sfx.tap()
    }
  }
  return (
    <div className="ls-sheet" role="dialog" aria-label="Tetapan" onClick={onClose}>
      <div className="ls-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="ls-panel__title">Tetapan</h2>
        <p className="ls-panel__label">Bunyi</p>
        <div className="ls-choice" role="radiogroup" aria-label="Bunyi">
          {[
            ['all', 'Bunyi & muzik'],
            ['sfx', 'Bunyi sahaja'],
            ['off', 'Senyap'],
          ].map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => pick(m)}>
              {label}
            </button>
          ))}
        </div>
        <p className="ls-panel__label">Gerakan</p>
        <div className="ls-choice" role="radiogroup" aria-label="Gerakan">
          {[
            [false, 'Penuh'],
            [true, 'Kurang'],
          ].map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={reduced === v} className={reduced === v ? 'is-on' : ''} onClick={() => setReduced(v)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="ls-wood-btn ls-panel__done" onClick={onClose}>
          Siap
        </button>
      </div>
    </div>
  )
}

/** A few motes of dust drifting in the warm light. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * Logging in, right on the landing: Google (or email, on its own screen).
 * Already logged in with an account: who you are, and a way out.
 */
function AuthPanel({ onSignOut }) {
  const status = useAuth((s) => s.status)
  const kind = useAuth((s) => s.kind)
  const name = useAuth((s) => s.profile?.name ?? s.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (status === 'off') return null
  if (status === 'in' && kind !== 'guest') {
    return (
      <div className="ls-auth ls-auth--in">
        <p className="ls-auth__who">
          <span aria-hidden="true">{kind === 'google' ? '🟢' : '✉️'}</span> Log masuk sebagai <b>{name}</b>
        </p>
        <button type="button" className="ls-auth__link" onClick={onSignOut}>
          Bukan kamu? Log keluar
        </button>
      </div>
    )
  }

  const google = async () => {
    if (busy) return
    initAudio()
    sfx.select()
    setBusy(true)
    setError(null)
    try {
      // a guest keeps their records by adding Google to the same account
      if (kind === 'guest') await authActions.guestToGoogle()
      else await authActions.google()
    } catch (err) {
      setError(explain(err))
      setBusy(false)
    }
  }

  return (
    <div className="ls-auth">
      <button type="button" className="ls-google" onClick={google} disabled={busy || status === 'loading'}>
        <GoogleLogo />
        {busy ? 'Sebentar…' : 'Log masuk dengan Google'}
      </button>
      <button
        type="button"
        className="ls-auth__link"
        onClick={() => {
          sfx.tap()
          authStore.setState({ loginView: 'email' })
          playerActions.goTo(SCREENS.LOGIN)
        }}
      >
        atau guna emel &amp; kata laluan
      </button>
      {error && (
        <p className="ls-auth__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Dust({ count }) {
  return (
    <div className="ls-dust" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ '--i': i }} />
      ))}
    </div>
  )
}

export function LandingPage() {
  const [leaving, setLeaving] = useState(false)
  const [settings, setSettings] = useState(false)
  const [reduced, setReducedState] = useState(loadReducedMotion)
  const [hidden, setHidden] = useState(false)
  const mode = useAudioState((s) => s.mode)
  const scene = useRef(null)
  const timer = useRef(null)
  const osReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const calm = reduced || osReduced

  useParallax(scene, !calm && !lowEnd)
  useEffect(() => () => clearTimeout(timer.current), [])

  // pause every loop while the tab is in the background
  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const setReduced = (v) => {
    setReducedState(v)
    sfx.tap()
    try {
      window.localStorage.setItem(MOTION_KEY, v ? '1' : '0')
    } catch {
      // not remembered, that's fine
    }
  }

  const toggleSound = () => {
    initAudio()
    if (mode === 'off') {
      setSoundMode('all')
      startAmbience()
      sfx.tap()
    } else setSoundMode('off')
  }

  const status = useAuth((s) => s.status)
  const kind = useAuth((s) => s.kind)
  // not logged in yet: MULAKAN plays as a guest
  const asGuest = status === 'out' || status === 'loading'

  const start = async () => {
    if (leaving) return
    initAudio()
    if (mode !== 'off') startAmbience()
    sfx.select()
    setLeaving(true)
    const fade = new Promise((done) => {
      timer.current = setTimeout(done, LEAVE_DURATION)
    })
    let next = screenAfterLogin()
    if (authStore.getState().status !== 'in' && authStore.getState().status !== 'off') {
      try {
        await authActions.guest()
        next = SCREENS.CHARACTER
      } catch (err) {
        // no connection or guests switched off: play anyway, just not saved
        console.warn('[cloud] tetamu', explain(err))
        next = SCREENS.CHARACTER
      }
    }
    await fade
    playerActions.goTo(next)
  }

  const signOut = () => {
    sfx.close()
    authActions.signOut()
  }

  return (
    <section ref={scene} className={`landing ls ${leaving ? 'is-leaving' : ''} ${calm ? 'is-calm' : ''} ${hidden ? 'is-paused' : ''}`}>
      {/* the painting: a kampung petang, drifting very slowly */}
      <div className="ls-wall" aria-hidden="true">
        <div className="ls-wall__img" />
      </div>
      <div className="ls-warmth" aria-hidden="true" />
      {!calm && <Dust count={lowEnd ? 4 : 7} />}

      <div className="ls-top">
        <button type="button" className="ls-badge" onClick={() => (sfx.tap(), setSettings(true))} aria-label="Tetapan">
          <GearIcon />
        </button>
        <button type="button" className="ls-badge" onClick={toggleSound} aria-label={mode === 'off' ? 'Hidupkan bunyi' : 'Senyapkan bunyi'} aria-pressed={mode !== 'off'}>
          <SoundIcon on={mode !== 'off'} />
        </button>
      </div>

      <div className="ls-head">
      <div className="ls-sign-rig">
        <svg className="ls-ropes" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M14 0 V40 M86 0 V40" stroke="#c49a5c" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
          <path d="M14 0 V40 M86 0 V40" stroke="#7a5428" strokeWidth="2.4" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="ls-sign">
          <svg className="ls-sign__board" viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden="true">
            <path d="M14 30 C10 12 30 6 60 8 L340 6 C372 4 392 14 388 34 L392 222 C394 246 372 254 346 252 L56 254 C26 256 8 244 12 222Z" fill="#4a2a15" />
            <path d="M22 34 C20 20 36 16 62 17 L338 15 C364 14 380 22 378 38 L381 218 C382 238 364 244 344 243 L58 245 C34 246 20 236 22 218Z" fill="#8a5129" />
            <path d="M24 92 C140 96 260 88 378 94 M23 160 C150 166 250 156 380 162" stroke="#6e3e1f" strokeWidth="3" fill="none" />
            <path d="M40 60 C90 56 120 64 170 58 M220 120 C270 116 300 124 350 118 M60 200 C110 196 160 204 200 198" stroke="#7a4623" strokeWidth="2" fill="none" />
            <circle cx="56" cy="20" r="7" fill="#3a2010" />
            <circle cx="344" cy="18" r="7" fill="#3a2010" />
          </svg>
          <p className="ls-kicker">Kampung · Petang · Kenangan</p>
          <h1 className="ls-title">
            <span>Permainan</span>
            <span className="is-gold">Tradisional</span>
            <span>Malaysia</span>
          </h1>
          <svg className="ls-hibiscus" viewBox="0 0 40 40" aria-hidden="true">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="20" cy="10" rx="7" ry="10" fill="#d93b32" transform={`rotate(${a} 20 20)`} />
            ))}
            <circle cx="20" cy="20" r="3.5" fill="#f5c542" />
          </svg>
        </div>
      </div>

      <p className="ls-subtitle">Jom kembali ke zaman kanak-kanak.</p>
      <AuthPanel onSignOut={signOut} />
      </div>

      <button type="button" className="ls-cta ls-wood-btn" onClick={start}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="ls-cta__play">
          <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
        </svg>
        <span className="ls-cta__label">
          Mulakan
          {asGuest && <small>sebagai Guest</small>}
          {kind === 'guest' && status === 'in' && <small>sebagai Guest</small>}
        </span>
        <span className="ls-cta__arrow" aria-hidden="true">
          →
        </span>
      </button>

      {settings && <Settings reduced={reduced} setReduced={setReduced} onClose={() => setSettings(false)} />}
    </section>
  )
}
