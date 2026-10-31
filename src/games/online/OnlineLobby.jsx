import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { useAuth } from '../../cloud/auth'
import { cloudEnabled } from '../../cloud/client'
import { createMatch, explainMatchError, inviteLink, joinMatch, tidyCode, useNetMatch } from '../../cloud/match'
import { clearPendingInvite, pendingCodeFor, rememberMatchInUrl } from './invite'
import './online.css'

/**
 * Playing a friend: host a match ("Jemput kawan", then share the code or the
 * link) or join one with a code. Once both of you are in, `children(net)`
 * runs the game (net comes from useNetMatch). `frame(panel)` puts the lobby's
 * panels on the game's own background.
 */
export function OnlineLobby({ gameId, frame, onExit, children }) {
  const status = useAuth((s) => s.status)
  const hasProfile = useAuth((s) => Boolean(s.profile))
  const [match, setMatch] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [code, setCode] = useState('')
  const joined = useRef(false)

  const enter = async (action) => {
    setBusy(true)
    setError(null)
    try {
      const m = await action()
      rememberMatchInUrl(m)
      setMatch(m)
    } catch (e) {
      setError(explainMatchError(e))
      sfx.locked()
    } finally {
      setBusy(false)
    }
  }

  // came in through an invite link (or reloaded mid-match): join straight away
  useEffect(() => {
    const c = pendingCodeFor(gameId)
    if (!c || joined.current || status !== 'in' || !hasProfile) return
    joined.current = true
    clearPendingInvite()
    setCode(c)
    enter(() => joinMatch(c))
  }, [gameId, status, hasProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  const exit = () => {
    rememberMatchInUrl(null)
    onExit()
  }

  if (!cloudEnabled || status !== 'in' || !hasProfile) {
    return frame(
      <Panel title="Main dengan kawan">
        <p className="gs-panel__note">Log masuk dulu (Google, emel atau tetamu) untuk main dengan kawan.</p>
        <button type="button" className="gs-btn gs-btn--plain" onClick={exit}>
          Balik ke kampung
        </button>
      </Panel>,
    )
  }

  if (match) {
    return (
      <MatchRoom
        key={match.id}
        initial={match}
        frame={frame}
        onExit={exit}
        onNewMatch={(m) => {
          rememberMatchInUrl(m)
          setMatch(m)
        }}
      >
        {children}
      </MatchRoom>
    )
  }

  const ready = tidyCode(code).length === 6
  return frame(
    <Panel title="Main dengan kawan">
      <button type="button" className="gs-btn gs-btn--go" disabled={busy} onClick={() => enter(() => createMatch(gameId))}>
        Jemput kawan
      </button>
      <p className="ol-or">atau masuk kod dari kawan</p>
      <form
        className="ol-join"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && !busy) enter(() => joinMatch(tidyCode(code)))
        }}
      >
        <input
          className="ol-input"
          value={code}
          onChange={(e) => setCode(tidyCode(e.target.value))}
          placeholder="KOD"
          aria-label="Kod perlawanan"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          inputMode="text"
        />
        <button type="submit" className="gs-btn gs-btn--plain ol-join__go" disabled={!ready || busy}>
          Masuk
        </button>
      </form>
      {error && (
        <p className="ol-error" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="gs-panel__small">Menyambung…</p>}
      <button type="button" className="gs-btn gs-btn--plain" onClick={exit}>
        Balik ke kampung
      </button>
    </Panel>,
  )
}

function Panel({ title, children }) {
  return (
    <div className="gs-sheet">
      <div className="gs-panel ol-panel">
        <h2 className="gs-panel__title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** A match you're in: wait for your friend, then play. */
function MatchRoom({ initial, frame, onExit, onNewMatch, children }) {
  const net = useNetMatch(initial)
  const [copied, setCopied] = useState(false)
  const waiting = net.match.status === 'waiting' || !net.opponent

  const leave = () => {
    if (net.match.status === 'waiting' || net.match.status === 'playing') net.leave()
    onExit()
  }

  if (waiting) {
    const link = inviteLink(net.match)
    const message = `Jom main dam dengan saya di Permainan Tradisional! Kod: ${net.match.code}\n${link}`
    const share = async () => {
      sfx.select()
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Jom main!', text: message })
          return
        } catch {
          // closed the share sheet: fall through to copying
        }
      }
      copy()
    }
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(message)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        setCopied(false)
      }
    }
    return frame(
      <Panel title="Jemput kawan">
        <p className="gs-panel__label">Beri kod ini kepada kawan kamu</p>
        <p className="ol-code" aria-label={`Kod ${net.match.code.split('').join(' ')}`}>
          {net.match.code}
        </p>
        <div className="ol-share">
          <button type="button" className="gs-btn gs-btn--go" onClick={share}>
            Kongsi pautan
          </button>
          <a className="gs-btn gs-btn--plain ol-wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <button type="button" className="gs-btn gs-btn--plain" onClick={copy}>
            {copied ? 'Disalin ✓' : 'Salin'}
          </button>
        </div>
        <p className="ol-wait" role="status">
          <span className="ol-dots" aria-hidden="true" />
          {net.opponentOnline ? 'Kawan kamu sedang masuk…' : 'Menunggu kawan masuk…'}
        </p>
        <button type="button" className="gs-btn gs-btn--plain" onClick={leave}>
          Batal
        </button>
      </Panel>,
    )
  }

  return children({ net, leave, onNewMatch })
}
