import { useEffect, useState } from 'react'
import { sfx } from '../../audio/engine'
import { authActions, explain, useAuth } from '../../cloud/auth'
import { fetchLeaderboard } from '../../cloud/leaderboard'
import { fetchRaceLeaderboard } from '../../cloud/raceTimes'
import { fetchProgressLeaderboard } from '../../cloud/progress'
import { getBicycle } from '../../games/lumba-basikal/bicycles'
import { TRACKS } from '../../games/lumba-basikal/tracks'
import { SCREENS, playerActions, usePlayerState } from '../../state/playerState'
import { ProfilePanel } from '../progress/ProfilePanel'
import './account.css'

const BOARD_GAMES = [
  // overall level across all five games
  { id: 'overall', name: 'Keseluruhan', emoji: '⭐', overall: true },
  { id: 'congkak', name: 'Congkak', emoji: '🐚', best: 'biji' },
  { id: 'dam', name: 'Dam Haji', emoji: '⚪' },
  { id: 'sepak-raga', name: 'Sepak Raga', emoji: '🏐', best: 'mata' },
  { id: 'ting-ting', name: 'Teng-Teng', emoji: '👣' },
  // ranked by best lap on each litar, not by wins
  { id: 'lumba-basikal', name: 'Lumba Basikal', emoji: '🚲', race: true },
]

const lapTime = (ms) => {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

const KIND = {
  google: { icon: '🟢', label: 'Akaun Google' },
  email: { icon: '✉️', label: 'Akaun emel' },
  guest: { icon: '🎒', label: 'Tetamu' },
}

const AVATAR = { lelaki: '/avatars/pemain-lelaki.webp', perempuan: '/avatars/pemain-perempuan.webp' }

function Row({ r, mine, game }) {
  const medal = ['🥇', '🥈', '🥉'][r.rank - 1]
  return (
    <li className={`ac-row ${mine ? 'is-me' : ''}`}>
      <span className="ac-rank">{medal ?? r.rank}</span>
      <img className="ac-face" src={AVATAR[r.gender] ?? AVATAR.lelaki} alt="" />
      <span className="ac-name">
        {r.name}
        {mine && <em> (kamu)</em>}
      </span>
      {game.overall ? (
        <span className="ac-stat">
          <span className="ac-stat__wins">
            <b>Lv {r.overall_level}</b>
          </span>
          <small>{r.total_xp.toLocaleString('ms-MY')} XP</small>
        </span>
      ) : game.race ? (
        <span className="ac-stat">
          <span className="ac-stat__wins">
            <b>{lapTime(r.best_ms)}</b>
          </span>
          <small>{getBicycle(r.bike_id).name}</small>
        </span>
      ) : (
        <span className="ac-stat">
          <span className="ac-stat__wins">
            <b>{r.wins}</b> menang
          </span>
          {game.best && r.best > 0 && (
            <small>
              terbaik {r.best} {game.best}
            </small>
          )}
        </span>
      )}
    </li>
  )
}

function Leaderboard({ userId }) {
  const [game, setGame] = useState(BOARD_GAMES[0])
  const [track, setTrack] = useState(TRACKS[0].id)
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let live = true
    setState({ loading: true })
    ;(game.overall ? fetchProgressLeaderboard(userId) : game.race ? fetchRaceLeaderboard(track, userId) : fetchLeaderboard(game.id, userId))
      .then((data) => live && setState(data))
      .catch((err) => live && setState({ error: explain(err) }))
    return () => {
      live = false
    }
  }, [game, track, userId])

  return (
    <div className="ac-board">
      <div className="ac-chips" role="tablist" aria-label="Permainan">
        {BOARD_GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === game.id}
            className={`ac-chip ${g.id === game.id ? 'is-on' : ''}`}
            onClick={() => {
              sfx.tap()
              setGame(g)
            }}
          >
            <span aria-hidden="true">{g.emoji}</span> {g.name}
          </button>
        ))}
      </div>
      {game.race && (
        <div className="ac-chips ac-chips--sub" role="tablist" aria-label="Litar">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === track}
              className={`ac-chip ${t.id === track ? 'is-on' : ''}`}
              onClick={() => {
                sfx.tap()
                setTrack(t.id)
              }}
            >
              {t.level} · {t.name}
            </button>
          ))}
        </div>
      )}
      {state.loading ? (
        <p className="ac-empty">Memuatkan…</p>
      ) : state.error ? (
        <p className="ac-empty">{state.error}</p>
      ) : state.top.length === 0 ? (
        <p className="ac-empty">
          {game.overall
            ? 'Belum ada sesiapa lagi. Main apa-apa permainan untuk naik level!'
            : game.race
              ? 'Belum ada masa di litar ini. Jadilah yang pertama!'
              : `Belum ada sesiapa. Jadilah yang pertama menang ${game.name}!`}
        </p>
      ) : (
        <ol className="ac-list">
          {state.top.map((r) => (
            <Row key={r.user_id} r={r} game={game} mine={r.user_id === userId} />
          ))}
          {state.me && (
            <>
              <li className="ac-gap" aria-hidden="true">
                ⋯
              </li>
              <Row r={state.me} game={game} mine />
            </>
          )}
        </ol>
      )}
    </div>
  )
}

/** A guest adds Google or an email to the same account, so nothing is lost. */
function KeepAccount() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (job) => {
    setBusy(true)
    setNote(null)
    try {
      await job()
    } catch (err) {
      setNote({ bad: true, text: explain(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ac-keep">
      <p className="ac-keep__lead">
        <b>Simpan akaun kamu.</b> Sekarang rekod kamu hanya di telefon ini. Sambung dengan Google atau emel supaya tak hilang.
      </p>
      <button type="button" className="ac-btn ac-btn--google" disabled={busy} onClick={() => run(authActions.guestToGoogle)}>
        Sambung dengan Google
      </button>
      {!open ? (
        <button type="button" className="ac-btn" onClick={() => setOpen(true)}>
          Sambung dengan emel
        </button>
      ) : (
        <form
          className="ac-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (password.length < 6) return setNote({ bad: true, text: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' })
            run(async () => {
              await authActions.guestToEmail(email, password)
              setNote({ text: `Semak emel ${email.trim()} dan tekan pautan pengesahan. Selepas itu kamu boleh log masuk dengan emel ini.` })
            })
          }}
        >
          <input type="email" autoComplete="email" placeholder="Emel" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" autoComplete="new-password" placeholder="Kata laluan (6 aksara atau lebih)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="ac-btn ac-btn--go" disabled={busy}>
            {busy ? 'Sebentar…' : 'Simpan'}
          </button>
        </form>
      )}
      {note && <p className={`ac-note ${note.bad ? 'is-bad' : ''}`}>{note.text}</p>}
    </div>
  )
}

/** Tap your name in the kampung: the leaderboard and your account. */
export function AccountSheet({ live, onClose, startTab = 'board' }) {
  const [tab, setTab] = useState(startTab)
  const auth = useAuth((s) => s)
  const kind = KIND[auth.kind] ?? KIND.guest
  const cloud = auth.status === 'in'
  const playerName = usePlayerState((s) => s.playerName)
  const playerGender = usePlayerState((s) => s.playerGender)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ac" role="dialog" aria-modal="true" aria-label="Akaun dan papan pendahulu" onClick={onClose}>
      <div className="ac-card" onClick={(e) => e.stopPropagation()}>
        <header className="ac-head">
          <div className="ac-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'profil'} className={`ac-tab ${tab === 'profil' ? 'is-on' : ''}`} onClick={() => setTab('profil')}>
              📜 Profil
            </button>
            <button type="button" role="tab" aria-selected={tab === 'board'} className={`ac-tab ${tab === 'board' ? 'is-on' : ''}`} onClick={() => setTab('board')}>
              🏆 Kedudukan
            </button>
            <button type="button" role="tab" aria-selected={tab === 'me'} className={`ac-tab ${tab === 'me' ? 'is-on' : ''}`} onClick={() => setTab('me')}>
              👤 Akaun
            </button>
          </div>
          <button type="button" className="ac-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </header>

        {live != null && (
          <p className="ac-live">
            <span className="ac-dot" aria-hidden="true" /> {live} orang di kampung sekarang
          </p>
        )}

        {tab === 'profil' ? (
          <ProfilePanel name={auth.profile?.name ?? playerName ?? 'Pemain'} gender={auth.profile?.gender ?? playerGender} />
        ) : tab === 'board' ? (
          cloud ? (
            <Leaderboard userId={auth.user?.id} />
          ) : (
            <p className="ac-empty">Log masuk untuk lihat papan pendahulu.</p>
          )
        ) : (
          <div className="ac-me">
            <div className="ac-who">
              <img className="ac-face ac-face--big" src={AVATAR[auth.profile?.gender] ?? AVATAR.lelaki} alt="" />
              <div>
                <p className="ac-who__name">{auth.profile?.name ?? 'Pemain'}</p>
                <p className="ac-who__kind">
                  {kind.icon} {kind.label}
                  {auth.email ? ` · ${auth.email}` : ''}
                </p>
              </div>
            </div>
            {auth.kind === 'guest' && <KeepAccount />}
            <button
              type="button"
              className="ac-btn"
              onClick={() => {
                sfx.tap()
                onClose()
                playerActions.goTo(SCREENS.CHARACTER)
              }}
            >
              ✏️ Tukar nama / watak
            </button>
            {cloud && (
              <button
                type="button"
                className="ac-btn ac-btn--out"
                onClick={() => {
                  sfx.close()
                  authActions.signOut()
                }}
              >
                Log keluar
              </button>
            )}
            {auth.kind === 'guest' && <p className="ac-small">Tetamu yang log keluar tak boleh masuk semula ke akaun yang sama.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
