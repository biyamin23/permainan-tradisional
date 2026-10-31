import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF, useProgress } from '@react-three/drei'
import { Vector3 } from 'three'
import { sfx } from '../../audio/engine'
import { useAuth } from '../../cloud/auth'
import { fetchRaceLeaderboard, fetchTrackRecords } from '../../cloud/raceTimes'
import { CHILD_LOOKS } from '../../components/character/ChildModel'
import { GAME_MODES, usePlayerState } from '../../state/playerState'
import { ExitButton, RulesButton, RulesSheet, usePlayerLook } from '../shared/GameShell'
import { BICYCLES, canRide, getBicycle, statBars } from './bicycles'
import { BikePreview } from './BikePreview'
import { preloadKamarulVoice } from './kamarulVoice'
import { createRace } from './raceController'
import { progressOf } from './raceSim'
import { RaceView } from './RaceView'
import { loadRecords, saveResult } from './records'
import { MasteryStatus, ProgressReward, useProgressSession } from '../../components/progress/Progress'
import { GAME_UNLOCKS } from '../../progression/config'
import { completeGame, gameUnlocked, overallOf, useProgress as useProgression } from '../../progression/engine'
import { KAMARUL } from './cast'
import { buildTrack } from './track'
import { TRACKS, getTrack } from './tracks'
import './lumbaBasikal.css'

/**
 * LUMBA BASIKAL: race Kamarul, the kampung's jaguh basikal, round one of
 * three litar. Pilih basikal → pilih litar → (load) → on the line → 3, 2, 1,
 * JOM! → checkpoints → final stretch → finish → result.
 */


const RULES = [
  'Lumba satu pusingan litar melawan Kamarul. Siapa sampai garisan TAMAT dulu, dia menang.',
  'Lalu checkpoint 1, 2 dan 3 mengikut urutan. Potong jalan merentas rumput tak dikira.',
  'W / ↑ kayuh, A D / ← → belok, S / ↓ brek, SPACE pecut, Esc rehat.',
  'Di telefon: joystick kiri untuk kayuh dan belok, butang PECUT dan BREK di kanan.',
  'Pecut menghabiskan meter. Ia penuh semula perlahan-lahan bila tak digunakan.',
  'Langgar ayam, batu, ranting atau lopak: basikal goyang dan perlahan. Langgar motosikal atau orang: terhenti sekejap.',
  'Setiap basikal lain rasanya: ada yang laju, ada yang cepat memecut, ada yang mudah dikawal.',
  'Litar Biasa dan Jaguh ada jalan pintas. Kamarul yang jaguh pun tahu!',
]

// a race with friends (loaded when chosen; it borrows the pickers and controls below)
const OnlineRace = lazy(() => import('./OnlineRace').then((m) => ({ default: m.OnlineRace })))

export const clock = (sec) => {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`
}
export const shortClock = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export const isTouch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

/* ------------------------------------------------------------------ pick a bike */

function Bars({ n }) {
  return (
    <span className="lb-bars" aria-label={`${n} daripada 5`}>
      {[1, 2, 3, 4, 5].map((k) => (
        <i key={k} className={k <= n ? 'is-on' : ''} />
      ))}
    </span>
  )
}

export function BikeSelect({ index, setIndex, onPick }) {
  const bike = BICYCLES[index]
  const stats = statBars(bike)
  // the Level 10 bikes: on show to everyone, rideable from Level 10
  const level = useProgression((s) => overallOf(s.profile).level)
  const open = canRide(bike, level)
  const pick = useCallback(() => {
    if (open) onPick()
    else sfx.tap()
  }, [open, onPick])
  const go = useCallback(
    (d) => {
      sfx.tap()
      setIndex((i) => (i + d + BICYCLES.length) % BICYCLES.length)
    },
    [setIndex],
  )
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') go(-1)
      if (e.key === 'ArrowRight' || e.key === 'd') go(1)
      if (e.key === 'Enter') pick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, pick])
  return (
    <div className="lb-select">
      <h2 className="lb-title">Pilih basikal</h2>
      <div className="lb-stage">
        <button type="button" className="lb-arrow" aria-label="Basikal sebelum" onClick={() => go(-1)}>
          ◀
        </button>
        <div className={`lb-bike ${open ? '' : 'is-locked'}`}>
          <BikePreview url={bike.modelPath} scale={bike.scale ?? 1} />
          {bike.minLevel && (
            <span className="lb-elite">
              {open ? '⭐' : '🔒'} Level {bike.minLevel}+
            </span>
          )}
          {!open && <span className="lb-lock">🔒 Buka pada Level {bike.minLevel} · kamu Level {level}</span>}
          {open && bike.minLevel && <span className="lb-unlocked">✓ Terbuka · kamu Level {level}</span>}
        </div>
        <button type="button" className="lb-arrow" aria-label="Basikal seterusnya" onClick={() => go(1)}>
          ▶
        </button>
      </div>
      <div className={`lb-card ${open ? '' : 'is-locked'}`}>
        <h3 className="lb-card__name">
          {!open && '🔒 '}
          {bike.name}
        </h3>
        <p className="lb-card__desc">{bike.description}</p>
        <dl className="lb-stats">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <Bars n={v} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="lb-dots" role="tablist" aria-label="Basikal">
          {BICYCLES.map((b, k) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={k === index}
              aria-label={canRide(b, level) ? b.name : `${b.name} (dikunci, Level ${b.minLevel})`}
              className={`${k === index ? 'is-on' : ''} ${b.minLevel ? 'is-elite' : ''} ${canRide(b, level) ? '' : 'is-locked'}`}
              onClick={() => {
                sfx.tap()
                setIndex(k)
              }}
            />
          ))}
        </div>
        <button type="button" className={`gs-btn gs-btn--go ${open ? '' : 'lb-track__go is-locked'}`} onClick={pick} aria-disabled={!open}>
          {open ? 'Pilih' : `🔒 Level ${bike.minLevel}`}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ pick a litar */

/** The loop drawn small, start flag and shortcut included. */
function TrackMap({ def }) {
  const { path, view, start, shortcuts } = useMemo(() => {
    const t = buildTrack(def)
    const pts = []
    for (let i = 0; i < t.n; i += 4) pts.push([t.px[i], t.pz[i]])
    const xs = pts.map((p) => p[0])
    const zs = pts.map((p) => p[1])
    const pad = 14
    return {
      path: `M${pts.map((p) => p.join(' ')).join(' L')} Z`,
      view: `${Math.min(...xs) - pad} ${Math.min(...zs) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...zs) - Math.min(...zs) + pad * 2}`,
      start: [t.px[0], t.pz[0]],
      shortcuts: t.shortcuts,
    }
  }, [def])
  return (
    <svg className="lb-map" viewBox={view} aria-hidden="true">
      <path d={path} fill="none" stroke="#4f8a3a" strokeWidth="16" strokeLinejoin="round" />
      <path d={path} fill="none" stroke={def.surface === 'tar' ? '#6c675f' : '#c98a55'} strokeWidth={def.width * 1.3} strokeLinejoin="round" />
      {shortcuts.map((s, k) => (
        <line key={k} x1={s.ax} y1={s.az} x2={s.bx} y2={s.bz} stroke="#3b6fd1" strokeWidth="3.5" strokeDasharray="5 5" />
      ))}
      <circle cx={start[0]} cy={start[1]} r="7" fill="#fff" stroke="#3b2414" strokeWidth="3" />
    </svg>
  )
}

/** What you'll meet on a litar, for the picker. */
function trackFeatures(def) {
  const count = (type) => def.obstacles.filter((o) => o.type === type).length
  const f = []
  if (def.bridges.length) f.push(`🌉 Jambatan ×${def.bridges.length}`)
  if (def.shortcuts.length) f.push('🔀 Jalan pintas')
  if (def.hills.length) f.push('⛰️ Bukit')
  if (def.mud.length) f.push('🟫 Lumpur')
  if (count('lubang')) f.push(`🕳️ Lubang ×${count('lubang')}`)
  if (count('lopak')) f.push('💧 Lopak')
  if (count('ayam')) f.push('🐔 Ayam')
  if (count('motosikal')) f.push('🛵 Motosikal')
  if (count('orang')) f.push('🚶 Orang lalu')
  if (count('batu') + count('ranting')) f.push('🪨 Batu & ranting')
  if (def.narrow.length) f.push('↔️ Jalan sempit')
  return f
}

function TrackSelect({ bike, startId, onPick, onBack }) {
  const records = useMemo(() => loadRecords(), [])
  const [index, setIndex] = useState(() => Math.max(0, TRACKS.findIndex((t) => t.id === startId)))
  const t = TRACKS[index]
  // the fastest in the kampung on each litar (from the leaderboard; none offline)
  const [champs, setChamps] = useState({})
  useEffect(() => {
    let live = true
    fetchTrackRecords().then((r) => live && setChamps(r))
    return () => {
      live = false
    }
  }, [])
  const go = useCallback((d) => {
    sfx.tap()
    setIndex((i) => (i + d + TRACKS.length) % TRACKS.length)
  }, [])
  const profile = useProgression((st) => st.profile)
  const open = gameUnlocked(profile, 'lumba-basikal', TRACKS[index].id)
  const pick = useCallback(() => {
    if (!open) {
      sfx.locked()
      return
    }
    sfx.select()
    onPick(TRACKS[index].id)
  }, [index, onPick, open])
  const needs = GAME_UNLOCKS['lumba-basikal'].find((u) => u.id === TRACKS[index].id)?.mastery
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') go(-1)
      if (e.key === 'ArrowRight' || e.key === 'd') go(1)
      if (e.key === 'Enter') pick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, pick])
  const mine = records.tracks[t.id]
  const champ = champs[t.id]
  return (
    <div className="lb-select">
      <h2 className="lb-title">Pilih litar</h2>
      <p className="lb-sub">
        Basikal: <b>{bike.name}</b>{' '}
        <button type="button" className="lb-link" onClick={onBack}>
          tukar
        </button>
      </p>
      <div className="lb-mastery">
        <MasteryStatus gameId="lumba-basikal" compact />
      </div>
      <div className="lb-stage">
        <button type="button" className="lb-arrow" aria-label="Litar sebelum" onClick={() => go(-1)}>
          ◀
        </button>
        <div className="lb-preview lb-preview--map" style={{ '--accent': t.color }} key={t.id}>
          <span className="lb-preview__level">{t.level}</span>
          <span className="lb-preview__stars" aria-label={`${t.stars} bintang`}>
            {'★'.repeat(t.stars)}
            <span>{'★'.repeat(3 - t.stars)}</span>
          </span>
          <TrackMap def={t} />
          {!open && (
            <span className="lb-lock">
              🔒 Buka pada Mastery Lv. {needs}
            </span>
          )}
        </div>
        <button type="button" className="lb-arrow" aria-label="Litar seterusnya" onClick={() => go(1)}>
          ▶
        </button>
      </div>
      <div className="lb-card" style={{ '--accent': t.color }}>
        <h3 className="lb-card__name">{t.name}</h3>
        <p className="lb-card__desc">{t.description}</p>
        <ul className="lb-features">
          {trackFeatures(t).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="lb-card__facts">
          Kamarul main ikut kemahiran kamu
          {mine && (
            <>
              {' '}
              · Rekod kamu <b>{clock(mine.best)}</b>
            </>
          )}
        </p>
        {champ && (
          <p className="lb-card__facts lb-track__champ">
            🏆 Juara kampung: {champ.name} {clock(champ.best_ms / 1000)}
          </p>
        )}
        <div className="lb-dots" role="tablist" aria-label="Litar">
          {TRACKS.map((x, k) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={k === index}
              aria-label={x.name}
              className={k === index ? 'is-on' : ''}
              onClick={() => {
                sfx.tap()
                setIndex(k)
              }}
            />
          ))}
        </div>
        <button type="button" className={`gs-btn lb-track__go ${open ? '' : 'is-locked'}`} onClick={pick}>
          {open ? 'Pilih' : `🔒 Mastery Lv. ${needs}`}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ input */

export function useRaceInput() {
  const keys = useRef(new Set())
  const touch = useRef({ x: 0, y: 0, boost: false, brake: false })
  const out = useRef({ throttle: 0, brake: 0, steer: 0, boost: false })
  useEffect(() => {
    const codes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'])
    const down = (e) => {
      if (!codes.has(e.code)) return
      if (e.target instanceof HTMLElement && e.target.closest('button') && e.code === 'Space') e.target.blur()
      e.preventDefault()
      keys.current.add(e.code)
    }
    const up = (e) => keys.current.delete(e.code)
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
  const read = useCallback(() => {
    const k = keys.current
    const t = touch.current
    const has = (...c) => c.some((x) => k.has(x))
    const o = out.current
    const right = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0)
    o.steer = Math.max(-1, Math.min(1, right + (Math.abs(t.x) > 0.12 ? t.x : 0)))
    o.throttle = has('KeyW', 'ArrowUp') ? 1 : t.y > 0.2 ? Math.min(1, t.y * 1.5) : 0
    o.brake = has('KeyS', 'ArrowDown') || t.brake ? 1 : t.y < -0.35 ? Math.min(1, -t.y) : 0
    if (o.brake) o.throttle = 0
    o.boost = has('Space') || t.boost
    return o
  }, [])
  return { read, touch }
}

/** Left-thumb joystick: up to pedal, sideways to steer, down to brake. */
export function Joystick({ touch }) {
  const base = useRef(null)
  const id = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const R = 46
  const move = (e) => {
    const rect = base.current.getBoundingClientRect()
    let dx = e.clientX - (rect.left + rect.width / 2)
    let dy = e.clientY - (rect.top + rect.height / 2)
    const l = Math.hypot(dx, dy)
    if (l > R) {
      dx = (dx / l) * R
      dy = (dy / l) * R
    }
    setKnob({ x: dx, y: dy })
    touch.current.x = dx / R
    touch.current.y = -dy / R
  }
  const end = (e) => {
    if (id.current !== e.pointerId) return
    id.current = null
    setKnob({ x: 0, y: 0 })
    touch.current.x = 0
    touch.current.y = 0
  }
  return (
    <div
      ref={base}
      className="joystick lb-joystick"
      onPointerDown={(e) => {
        id.current = e.pointerId
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // pointer already gone
        }
        move(e)
      }}
      onPointerMove={(e) => id.current === e.pointerId && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-hidden="true"
    >
      <div className="joystick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

export function HoldButton({ className, label, onChange }) {
  const set = (v) => (e) => {
    try {
      if (v) e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // pointer already gone
    }
    onChange(v)
  }
  return (
    <button
      type="button"
      className={className}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onLostPointerCapture={() => onChange(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ the race */

function Race({ bike, trackId, onPickTrack, onExit, onAgain }) {
  const player = usePlayerLook()
  const userId = useAuth((s) => s.user?.id)
  const myBest = useMemo(() => loadRecords().tracks[trackId]?.best, [trackId])
  const gender = usePlayerState((s) => s.playerGender)
  const track = useMemo(() => buildTrack(getTrack(trackId)), [trackId])
  const kamarulBike = useMemo(() => getBicycle(bike.id === 'chopper' ? 'bmx' : 'chopper'), [bike])
  const hud = useRef({})
  const [toast, setToast] = useState(null)
  const [speech, setSpeech] = useState(null)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [rules, setRules] = useState(false)
  const [result, setResult] = useState(null)
  const [count, setCount] = useState(null)
  const [board, setBoard] = useState(null)
  const { read, touch } = useRaceInput()
  const touchUI = useMemo(isTouch, [])
  const { progress } = useProgress()

  const onEvent = useRef(null)
  // difficulty for this race (fixed for the race), from your Lumba Basikal progress
  const session = useProgressSession('lumba-basikal')
  const race = useMemo(() => {
    const r = createRace({ track, playerBike: { ...bike }, kamarulBike: { ...kamarulBike }, kamarulLevel: session.tuning, onEvent: (e) => onEvent.current?.(e) })
    r.youPos = new Vector3()
    return r
  }, [track, bike, kamarulBike, session])
  useEffect(() => {
    // ?debug: expose the race for automated checks
    if (window.location.search.includes('debug')) window.__race = race
    return () => race.dispose()
  }, [race])

  const showToast = useCallback((text, tone = '', ms = 1400) => {
    setToast({ text, tone, key: Math.random(), ms })
  }, [])

  onEvent.current = (e) => {
    switch (e.type) {
      case 'say':
        setSpeech({ words: e.words, key: Math.random() })
        break
      case 'count':
        setCount(e.n === 0 ? 'JOM!' : String(e.n))
        if (e.n === 0) window.setTimeout(() => setCount(null), 800)
        break
      case 'checkpoint':
        showToast(`Checkpoint ${e.n}/${e.of}`, 'good')
        break
      case 'final':
        showToast('PECUT!', 'hot', 1800)
        break
      case 'lead':
        showToast(e.who === 'you' ? 'Kamu di depan!' : 'Kamarul potong!', e.who === 'you' ? 'good' : 'them')
        break
      case 'hit':
        if (e.who === 'you')
          showToast(e.fall ? (e.what === 'lubang' ? 'JATUH! Lubang!' : e.what === 'edge' ? 'JATUH longkang!' : 'JATUH!') : e.big ? 'Aduh!' : e.what === 'ayam' ? 'Ayam!' : e.what === 'lubang' ? 'Lubang!' : 'Goyang!', 'bad', e.fall ? 1600 : 900)
        else if (e.fall) showToast('Kamarul jatuh!', 'good', 1200)
        break
      case 'shoved':
        showToast('Kamarul himpit!', 'them', 900)
        break
      case 'winner':
        showToast(e.who === 'you' ? 'TAMAT! Kamu menang!' : 'TAMAT! Kamarul menang!', e.who === 'you' ? 'good' : 'them', 2600)
        break
      case 'done': {
        const you = race.you
        const k = race.kamarul
        const won = you.finishTime <= k.finishTime
        const saved = saveResult({ won, trackId, bikeId: bike.id, time: you.finishTime })
        if (won) sfx.win()
        else sfx.lose()
        const reward = completeGame(session, {
          won,
          time: you.finishTime,
          par: track.L / 7.4,
          underPar: you.finishTime <= track.L / 7.4,
          crashes: you.falls ?? 0,
          hits: you.hits ?? 0,
          checkpoints: you.nextCp / track.checkpoints.length,
          score: won ? 1 : 0,
          theirs: won ? 0 : 1,
          trackId,
          bikeId: bike.id,
          seconds: Math.round(you.finishTime),
        })
        setResult({ won, you: you.finishTime, kamarul: k.finishTime, newBest: saved.newBest, best: saved.track.best, reward })
        // where that puts you on the kampung leaderboard (once the time has gone up)
        if (userId)
          window.setTimeout(() => {
            fetchRaceLeaderboard(trackId, userId, 1)
              .then(({ top, me }) => {
                const mine = top.find((r) => r.user_id === userId) ?? me
                setBoard({ rank: mine?.rank ?? null, champ: top[0] ?? null })
              })
              .catch(() => {})
          }, 900)
        window.setTimeout(() => race.sayRematch(), 1600)
        break
      }
      default:
        break
    }
  }

  useEffect(() => {
    preloadKamarulVoice()
  }, [])

  // the tutorial / rules sheet or pause holds the race
  useEffect(() => {
    race.paused = paused || rules
  }, [race, paused, rules])

  // Esc pauses (and must not close the game underneath)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || rules) return
      e.stopImmediatePropagation()
      e.preventDefault()
      if (result) return
      sfx.tap()
      setPaused((p) => !p)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [rules, result])

  // HUD numbers straight into the DOM every frame (no re-renders)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const h = hud.current
      const you = race.you
      const k = race.kamarul
      const L = track.L
      const pos = (r) => Math.max(0, Math.min(1, progressOf(track, r) / L))
      if (h.you) h.you.style.left = `${pos(you) * 100}%`
      if (h.kamarul) h.kamarul.style.left = `${pos(k) * 100}%`
      if (h.time) {
        const t = you.finished ? you.finishTime : race.time
        const text = shortClock(t)
        if (h.time.textContent !== text) h.time.textContent = text
      }
      if (h.speed) {
        const text = String(Math.round(you.speed * 3.6))
        if (h.speed.textContent !== text) h.speed.textContent = text
      }
      if (h.boost) h.boost.style.transform = `scaleX(${you.boost.toFixed(3)})`
      if (h.boostWrap) h.boostWrap.classList.toggle('is-on', you.boosting)
      if (h.cp) {
        const text = `${Math.min(you.nextCp, track.checkpoints.length)}/${track.checkpoints.length}`
        if (h.cp.textContent !== text) h.cp.textContent = text
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [race, track])

  const onReady = useCallback(() => {
    race.ready = true
    setReady(true)
  }, [race])

  const looks = useMemo(() => ({ you: CHILD_LOOKS[gender] ?? Object.values(CHILD_LOOKS)[0], kamarul: KAMARUL.look }), [gender])
  const urls = useMemo(
    () => ({ you: { url: bike.modelPath, scale: bike.scale ?? 1 }, kamarul: { url: kamarulBike.modelPath, scale: kamarulBike.scale ?? 1 } }),
    [bike, kamarulBike],
  )
  const readInput = useCallback(() => (race.ready ? read() : IDLE_INPUT), [race, read])
  const def = track.def

  return (
    <div className="lb-race">
      <RaceView race={race} looks={looks} urls={urls} readInput={readInput} onReady={onReady} />

      <div className="lb-hud">
        <div className="lb-top">
          <ExitButton onExit={onExit} />
          <div className="lb-progress" aria-label="Kedudukan perlumbaan">
            <div className="lb-progress__names">
              <span>{player.name}</span>
              <span ref={(el) => (hud.current.time = el)} className="lb-time">
                00:00
              </span>
              <span>Kamarul</span>
            </div>
            <div className="lb-progress__line">
              {track.checkpoints.map((s, k) => (
                <i key={k} className="lb-progress__cp" style={{ left: `${(s / track.L) * 100}%` }} />
              ))}
              <img ref={(el) => (hud.current.kamarul = el)} src={KAMARUL.img} alt="" className="lb-progress__dot is-them" />
              <img ref={(el) => (hud.current.you = el)} src={player.img} alt="" className="lb-progress__dot is-you" style={{ borderColor: player.color }} />
            </div>
          </div>
          <button type="button" className="gs-pill lb-pause" aria-label="Rehat" onClick={() => setPaused(true)}>
            ❚❚
          </button>
        </div>
        <p className="lb-cp">
          Checkpoint <b ref={(el) => (hud.current.cp = el)}>0/3</b> · {def.name}
          {myBest !== undefined && <> · Rekod kamu {clock(myBest)}</>}
        </p>

        {speech && (
          <div className="lb-speech" key={speech.key} onAnimationEnd={(e) => e.animationName === 'lb-speech-out' && setSpeech(null)}>
            <img src={KAMARUL.img} alt="" />
            <p>{speech.words}</p>
          </div>
        )}
        {toast && (
          <p className={`lb-toast is-${toast.tone}`} key={toast.key} style={{ animationDuration: `${toast.ms}ms` }} onAnimationEnd={() => setToast(null)}>
            {toast.text}
          </p>
        )}
        {count && (
          <p className={`lb-count ${count === 'JOM!' ? 'is-go' : ''}`} key={count}>
            {count}
          </p>
        )}

        <div className="lb-speed" aria-label="Laju">
          <b ref={(el) => (hud.current.speed = el)}>0</b>
          <span>km/j</span>
        </div>
        <div className={`lb-boost ${touchUI ? 'is-touch' : ''}`} ref={(el) => (hud.current.boostWrap = el)}>
          <span>PECUT{touchUI ? '' : ' · SPACE'}</span>
          <div className="lb-boost__bar">
            <i ref={(el) => (hud.current.boost = el)} />
          </div>
        </div>

        {touchUI && !result && (
          <>
            <Joystick touch={touch} />
            <div className="lb-buttons">
              <HoldButton className="lb-btn lb-btn--boost" label="PECUT" onChange={(v) => (touch.current.boost = v)} />
              <HoldButton className="lb-btn lb-btn--brake" label="BREK" onChange={(v) => (touch.current.brake = v)} />
            </div>
          </>
        )}
      </div>

      {!ready && (
        <div className="lb-loading">
          <p>Memuatkan {def.name}…</p>
          <div className="lb-loading__bar">
            <i style={{ width: `${Math.max(8, progress)}%` }} />
          </div>
          <p className="lb-loading__small">{Math.round(progress)}%</p>
        </div>
      )}

      {paused && !result && (
        <div className="gs-sheet">
          <div className="gs-panel">
            <h2 className="gs-panel__title">Rehat sekejap</h2>
            <button type="button" className="gs-btn gs-btn--go" onClick={() => setPaused(false)}>
              Sambung
            </button>
            <button type="button" className="gs-btn gs-btn--plain" onClick={() => setRules(true)}>
              Cara main
            </button>
            <button type="button" className="gs-btn gs-btn--plain" onClick={onAgain}>
              Mula semula
            </button>
            <button type="button" className="gs-btn gs-btn--plain" onClick={onPickTrack}>
              Pilih litar
            </button>
            <button type="button" className="gs-btn gs-btn--plain" onClick={onExit}>
              Keluar
            </button>
          </div>
        </div>
      )}
      {rules && <RulesSheet game="Lumba Basikal" rules={RULES} onClose={() => setRules(false)} />}

      {result && (
        <div className="gs-sheet lb-result-sheet">
          <div className="gs-panel lb-result">
            <h2 className={`gs-panel__title gs-panel__title--big ${result.won ? 'is-win' : ''}`}>TAMAT!</h2>
            <ol className="lb-podium">
              {[
                { name: player.name, img: player.img, time: result.you, you: true },
                { name: 'Kamarul', img: KAMARUL.img, time: result.kamarul },
              ]
                .sort((a, b) => a.time - b.time)
                .map((p, k) => (
                  <li key={p.name} className={p.you ? 'is-you' : ''}>
                    <span className="lb-podium__medal">{k === 0 ? '🥇' : '🥈'}</span>
                    <img src={p.img} alt="" />
                    <span className="lb-podium__name">{p.name}</span>
                    <span className="lb-podium__time">{clock(p.time)}</span>
                  </li>
                ))}
            </ol>
            <p className="lb-result__line">
              {result.won ? 'Kamu kalahkan jaguh basikal kampung!' : `Kamarul sampai ${(result.you - result.kamarul).toFixed(1)} saat lebih awal. Cuba lagi!`}
            </p>
            <ProgressReward reward={result.reward} />
            {result.newBest ? (
              <p className="lb-result__best">Masa terbaik kamu di litar ini!</p>
            ) : (
              <p className="lb-result__small">Masa terbaik kamu: {clock(result.best)}</p>
            )}
            {board?.rank && (
              <p className="lb-result__rank">
                Papan pendahulu {def.name}: <b>#{board.rank}</b>
                {board.champ && board.rank !== 1 && <> · Juara {board.champ.name} {clock(board.champ.best_ms / 1000)}</>}
              </p>
            )}
            {!userId && <p className="lb-result__small">Log masuk untuk masuk papan pendahulu.</p>}
            <dl className="lb-result__facts">
              <div>
                <dt>Litar</dt>
                <dd>{def.name}</dd>
              </div>
              <div>
                <dt>Basikal</dt>
                <dd>{bike.name}</dd>
              </div>
            </dl>
            <div className="lb-result__buttons">
              <button type="button" className="gs-btn gs-btn--go" onClick={onAgain}>
                Main lagi
              </button>
              <button type="button" className="gs-btn gs-btn--plain" onClick={onPickTrack}>
                Pilih litar
              </button>
              <button type="button" className="gs-btn gs-btn--plain" onClick={onExit}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const IDLE_INPUT = { throttle: 0, brake: 0, steer: 0, boost: false }

/* ------------------------------------------------------------------ the game */

export function LumbaBasikalGame({ mode, onExit }) {
  const [screen, setScreen] = useState('bike') // bike | track | race
  const [bikeIndex, setBikeIndex] = useState(0)
  const [trackId, setTrackId] = useState(null)
  const [raceKey, setRaceKey] = useState(0)
  const [rules, setRules] = useState(false)
  const bike = BICYCLES[bikeIndex]
  const level = useProgression((s) => overallOf(s.profile).level)
  // (a locked bike can't get past the picker, however it was reached)
  useEffect(() => {
    if (screen !== 'bike' && !canRide(bike, level)) setScreen('bike')
  }, [screen, bike, level])

  useEffect(() => {
    BICYCLES.forEach((b) => useGLTF.preload(b.modelPath))
  }, [])

  const toTrack = useCallback(() => {
    sfx.select()
    setScreen('track')
  }, [])

  if (mode === GAME_MODES.MULTIPLAYER)
    return (
      <Suspense fallback={<p className="game-screen__loading">Memuatkan…</p>}>
        <OnlineRace onExit={onExit} bikeIndex={bikeIndex} setBikeIndex={setBikeIndex} />
      </Suspense>
    )

  if (screen === 'race' && trackId)
    return (
      <Race
        key={`${trackId}-${raceKey}`}
        bike={bike}
        trackId={trackId}
        onExit={onExit}
        onPickTrack={() => setScreen('track')}
        onAgain={() => {
          sfx.select()
          setRaceKey((k) => k + 1)
        }}
      />
    )

  return (
    <div className="gs lb">
      <div className="gs-top">
        <ExitButton onExit={onExit} />
        <RulesButton onOpen={() => setRules(true)} />
      </div>
      {screen === 'bike' && <BikeSelect index={bikeIndex} setIndex={setBikeIndex} onPick={toTrack} />}
      {screen === 'track' && (
        <TrackSelect
          bike={bike}
          startId={trackId}
          onBack={() => setScreen('bike')}
          onPick={(id) => {
            setTrackId(id)
            setScreen('race')
          }}
        />
      )}
      {rules && <RulesSheet game="Lumba Basikal" rules={RULES} onClose={() => setRules(false)} />}
    </div>
  )
}
