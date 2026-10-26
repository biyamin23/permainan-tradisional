import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { authActions, explain, screenAfterLogin, useAuth } from '../../cloud/auth'
import { SCREENS, playerActions } from '../../state/playerState'
import { LandingScenery } from '../landing/LandingScenery'
import '../character/character.css'
import './login.css'

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

function EmailForm({ busy, run, onBack }) {
  const [mode, setMode] = useState('masuk') // masuk | daftar | lupa
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [note, setNote] = useState(null)
  const emailRef = useRef(null)

  useEffect(() => emailRef.current?.focus({ preventScroll: true }), [mode])

  const submit = (e) => {
    e.preventDefault()
    if (!email.includes('@')) return setNote({ bad: true, text: 'Isi emel yang betul.' })
    if (mode !== 'lupa' && password.length < 6) return setNote({ bad: true, text: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' })
    setNote(null)
    run(async () => {
      if (mode === 'masuk') await authActions.emailSignIn(email, password)
      if (mode === 'daftar') {
        const { confirm } = await authActions.emailSignUp(email, password)
        if (confirm) setNote({ text: `Hampir siap! Kami hantar emel pengesahan ke ${email.trim()}. Tekan pautan dalam emel itu, kemudian kembali ke sini.` })
      }
      if (mode === 'lupa') {
        await authActions.resetPassword(email)
        setNote({ text: `Pautan untuk tukar kata laluan sudah dihantar ke ${email.trim()}.` })
      }
    }, (msg) => setNote({ bad: true, text: msg }))
  }

  const tab = (id, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === id}
      className={`lg-tab ${mode === id ? 'is-on' : ''}`}
      onClick={() => {
        sfx.tap()
        setMode(id)
        setNote(null)
      }}
    >
      {label}
    </button>
  )

  return (
    <form className="lg-email" onSubmit={submit} noValidate>
      {mode !== 'lupa' ? (
        <div className="lg-tabs" role="tablist">
          {tab('masuk', 'Log masuk')}
          {tab('daftar', 'Daftar baru')}
        </div>
      ) : (
        <p className="lg-lead">Lupa kata laluan? Isi emel kamu, kami hantar pautan untuk tukar.</p>
      )}

      <label className="lg-label" htmlFor="lg-email">
        Emel
      </label>
      <div className="cc-field lg-field">
        <span className="cc-field__icon" aria-hidden="true">
          ✉️
        </span>
        <input
          ref={emailRef}
          id="lg-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@contoh.com"
        />
      </div>

      {mode !== 'lupa' && (
        <>
          <label className="lg-label" htmlFor="lg-pass">
            Kata laluan
          </label>
          <div className="cc-field lg-field">
            <span className="cc-field__icon" aria-hidden="true">
              🔒
            </span>
            <input
              id="lg-pass"
              type={show ? 'text' : 'password'}
              autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'daftar' ? 'Sekurang-kurangnya 6 aksara' : 'Kata laluan'}
            />
            <button type="button" className="lg-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Sembunyi kata laluan' : 'Tunjuk kata laluan'}>
              {show ? '🙈' : '👁️'}
            </button>
          </div>
        </>
      )}

      {note && (
        <p className={`lg-note ${note.bad ? 'is-bad' : ''}`} role={note.bad ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}

      <button type="submit" className="cc-go is-ready lg-submit" disabled={busy}>
        {busy ? 'Sebentar…' : mode === 'masuk' ? 'Log masuk' : mode === 'daftar' ? 'Daftar' : 'Hantar pautan'}
      </button>

      <div className="lg-links">
        {mode === 'masuk' && (
          <button type="button" className="lg-link" onClick={() => (setMode('lupa'), setNote(null))}>
            Lupa kata laluan?
          </button>
        )}
        {mode === 'lupa' && (
          <button type="button" className="lg-link" onClick={() => (setMode('masuk'), setNote(null))}>
            ‹ Kembali ke log masuk
          </button>
        )}
        <button type="button" className="lg-link" onClick={onBack}>
          Cara lain untuk masuk
        </button>
      </div>
    </form>
  )
}

/** After the reset link in the email: choose a new password. */
function NewPassword({ busy, run }) {
  const [password, setPassword] = useState('')
  const [note, setNote] = useState(null)
  const submit = (e) => {
    e.preventDefault()
    if (password.length < 6) return setNote('Kata laluan mesti sekurang-kurangnya 6 aksara.')
    run(async () => {
      await authActions.setNewPassword(password)
      playerActions.goTo(screenAfterLogin())
    }, setNote)
  }
  return (
    <form className="lg-email" onSubmit={submit} noValidate>
      <p className="lg-lead">Pilih kata laluan baru.</p>
      <div className="cc-field lg-field">
        <span className="cc-field__icon" aria-hidden="true">
          🔒
        </span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata laluan baru" autoFocus />
      </div>
      {note && (
        <p className="lg-note is-bad" role="alert">
          {note}
        </p>
      )}
      <button type="submit" className="cc-go is-ready lg-submit" disabled={busy}>
        {busy ? 'Sebentar…' : 'Simpan kata laluan'}
      </button>
    </form>
  )
}

export function LoginScreen() {
  const status = useAuth((s) => s.status)
  const recovery = useAuth((s) => s.recovery)
  const [view, setView] = useState('pick') // pick | email
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // logged in (also after coming back from Google): carry on
  useEffect(() => {
    if (status === 'in' && !recovery) playerActions.goTo(screenAfterLogin())
  }, [status, recovery])

  const run = async (job, onError = setError) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch (err) {
      sfx.locked()
      onError(explain(err))
    } finally {
      setBusy(false)
    }
  }

  const loading = status === 'loading'

  return (
    <section className="character login screen-fade-in">
      <LandingScenery dimmed />

      <div className="cc-card lg-card">
        <button
          type="button"
          className="cc-back"
          onClick={() => {
            sfx.close()
            if (view === 'email') setView('pick')
            else playerActions.goTo(SCREENS.LANDING)
          }}
        >
          <span aria-hidden="true">←</span> Kembali
        </button>

        <h2 className="cc-title">{recovery ? 'Kata laluan baru' : view === 'email' ? 'Masuk dengan emel' : 'Jom masuk kampung!'}</h2>
        {!recovery && view === 'pick' && <p className="lg-lead">Log masuk supaya rekod dan watak kamu disimpan, di telefon mana pun.</p>}

        {loading ? (
          <p className="lg-lead lg-wait">Sebentar…</p>
        ) : recovery ? (
          <NewPassword busy={busy} run={run} />
        ) : view === 'email' ? (
          <EmailForm busy={busy} run={run} onBack={() => setView('pick')} />
        ) : (
          <div className="lg-options">
            <button type="button" className="lg-btn lg-btn--google" disabled={busy} onClick={() => (sfx.select(), run(authActions.google))}>
              <GoogleLogo />
              Teruskan dengan Google
            </button>
            <button
              type="button"
              className="lg-btn lg-btn--email"
              disabled={busy}
              onClick={() => {
                sfx.tap()
                setError(null)
                setView('email')
              }}
            >
              <span aria-hidden="true">✉️</span>
              Emel &amp; kata laluan
            </button>
            <div className="lg-or" aria-hidden="true">
              <span>atau</span>
            </div>
            <button type="button" className="lg-btn lg-btn--guest" disabled={busy} onClick={() => (sfx.select(), run(authActions.guest))}>
              <span aria-hidden="true">🎒</span>
              Main sebagai tetamu
            </button>
            <p className="lg-small">Tetamu boleh simpan akaun kemudian dengan Google atau emel, rekod tak hilang.</p>
            {error && (
              <>
                <p className="lg-note is-bad" role="alert">
                  {error}
                </p>
                <button type="button" className="lg-link lg-offline" onClick={() => playerActions.goTo(SCREENS.CHARACTER)}>
                  Teruskan tanpa akaun (rekod tak disimpan)
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
