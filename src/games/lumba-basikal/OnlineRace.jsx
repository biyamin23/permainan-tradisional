import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { Vector3 } from 'three'
import { sfx } from '../../audio/engine'
import { useAuth } from '../../cloud/auth'
import { cloudEnabled } from '../../cloud/client'
import { createMatch, explainMatchError, inviteLink, joinMatch, tidyCode } from '../../cloud/match'
import { useRaceRoom } from '../../cloud/raceRoom'
import { CHILD_LOOKS } from '../../components/character/ChildModel'
import { ProgressReward, useProgressSession } from '../../components/progress/Progress'
import { completeGame, overallOf, useProgress as useProgression } from '../../progression/engine'
import { ExitButton, lookOf, usePlayerLook } from '../shared/GameShell'
import { clearPendingInvite, pendingCodeFor, rememberMatchInUrl } from '../online/invite'
import '../online/online.css'
import { BICYCLES, canRide, getBicycle } from './bicycles'
import { KAMARUL, RIVALS, SEAT_COLORS } from './cast'
import { BikeSelect, HoldButton, IDLE_INPUT, Joystick, clock, isTouch, shortClock, useRaceInput } from './LumbaBasikalGame'
import { createNetRace, rateFor } from './netRace'
import { progressOf } from './raceSim'
import { RaceView } from './RaceView'
import { buildTrack } from './track'
import { TRACKS, getTrack } from './tracks'

/**
 * Lumba Basikal with friends: the host opens a room for 2–8 riders on a
 * litar, friends join with the code or the link, everyone picks a bike, the
 * host starts, empty seats get AI riders, one lap, results for all.
 * (The race itself: netRace.js; the messages: cloud/raceRoom.js.)
 */

const GAME = 'lumba-basikal'
const BIKE_KEY = 'ptm-lb-online-bike'
const placeWord = (n) => `Ke-${n}`
const medal = (n) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : `${n}.`)

function Sheet({ title, children }) {
  return (
    <div className="gs-sheet">
      <div className="gs-panel ol-panel lb-room">
        {title && <h2 className="gs-panel__title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ entry: open a room or join one */

export function OnlineRace({ onExit, bikeIndex, setBikeIndex }) {
  const status = useAuth((s) => s.status)
  const hasProfile = useAuth((s) => Boolean(s.profile))
  const [match, setMatch] = useState(null)
  const [view, setView] = useState('menu') // menu | setup
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [code, setCode] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [trackId, setTrackId] = useState(TRACKS[0].id)
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

  // came in through an invite link (or reloaded): join straight away
  useEffect(() => {
    const c = pendingCodeFor(GAME)
    if (!c || joined.current || status !== 'in' || !hasProfile) return
    joined.current = true
    clearPendingInvite()
    setCode(c)
    enter(() => joinMatch(c))
  }, [status, hasProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  const exit = () => {
    rememberMatchInUrl(null)
    onExit()
  }

  if (match) {
    return (
      <Room
        key={match.id}
        initial={match}
        bikeIndex={bikeIndex}
        setBikeIndex={setBikeIndex}
        onExit={exit}
        onLobby={() => {
          rememberMatchInUrl(null)
          setMatch(null)
          setView('menu')
        }}
      />
    )
  }

  const frame = (body) => (
    <div className="gs lb lb-online">
      <div className="gs-top">
        <ExitButton onExit={exit} />
      </div>
      {body}
    </div>
  )

  if (!cloudEnabled || status !== 'in' || !hasProfile) {
    return frame(
      <Sheet title="Lumba dengan kawan">
        <p className="gs-panel__note">Log masuk dulu (Google, emel atau tetamu) untuk lumba dengan kawan.</p>
        <button type="button" className="gs-btn gs-btn--plain" onClick={exit}>
          Balik ke kampung
        </button>
      </Sheet>,
    )
  }

  if (view === 'setup') {
    return frame(
      <Sheet title="Buka bilik lumba">
        <p className="gs-panel__label">Berapa pelumba?</p>
        <div className="lb-seats-pick" role="radiogroup" aria-label="Bilangan pelumba">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={capacity === n}
              className={`gs-level ${capacity === n ? 'is-selected' : ''}`}
              onClick={() => {
                sfx.tap()
                setCapacity(n)
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="gs-panel__small lb-room__hint">Tempat yang tak diisi kawan akan diisi pelumba AI.</p>
        <p className="gs-panel__label">Litar</p>
        <div className="lb-track-pick">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`gs-level ${trackId === t.id ? 'is-selected' : ''}`}
              onClick={() => {
                sfx.tap()
                setTrackId(t.id)
              }}
            >
              <small>{t.level}</small>
              {t.name}
            </button>
          ))}
        </div>
        <button type="button" className="gs-btn gs-btn--go" disabled={busy} onClick={() => enter(() => createMatch(GAME, capacity, { track: trackId }))}>
          Buka bilik
        </button>
        {error && (
          <p className="ol-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="gs-btn gs-btn--plain" onClick={() => setView('menu')}>
          Kembali
        </button>
      </Sheet>,
    )
  }

  const ready = tidyCode(code).length === 6
  return frame(
    <Sheet title="Lumba dengan kawan">
      <button
        type="button"
        className="gs-btn gs-btn--go"
        onClick={() => {
          sfx.select()
          setView('setup')
        }}
      >
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
          aria-label="Kod bilik"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
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
    </Sheet>,
  )
}

/* ------------------------------------------------------------------ the room: who's in, bikes, start */

function loadBikeId() {
  try {
    return localStorage.getItem(BIKE_KEY)
  } catch {
    return null
  }
}

function Room({ initial, bikeIndex, setBikeIndex, onExit, onLobby }) {
  const room = useRaceRoom(initial)
  const level = useProgression((s) => overallOf(s.profile).level)
  const [picking, setPicking] = useState(false)
  const [roster, setRoster] = useState(null)
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)
  const trackId = initial.settings?.track ?? TRACKS[0].id
  const def = getTrack(trackId)

  // your bike: the one you rode online last time, if you can still ride it
  useEffect(() => {
    const saved = BICYCLES.findIndex((b) => b.id === loadBikeId())
    if (saved >= 0 && canRide(BICYCLES[saved], level)) setBikeIndex(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const bike = canRide(BICYCLES[bikeIndex], level) ? BICYCLES[bikeIndex] : BICYCLES[0]
  const { setBike } = room
  useEffect(() => {
    if (room.mySeat === null) return
    setBike(bike.id)
    try {
      localStorage.setItem(BIKE_KEY, bike.id)
    } catch {
      // private window: fine
    }
  }, [bike.id, setBike, room.mySeat]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => room.onEvent((name, data) => name === 'start' && setRoster(data.roster)), [room])

  // missed the host's "go" (the phone was busy elsewhere)? the line-up is kept with the match
  const saved = room.match.status === 'playing' ? room.match.settings?.roster : null
  const inSaved = saved?.some((r) => r.kind === 'human' && r.seat === room.mySeat)
  useEffect(() => {
    if (!roster && inSaved) setRoster(saved)
  }, [roster, inSaved]) // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => {
    room.leave()
    onExit()
  }

  if (roster) return <NetRace room={room} roster={roster} trackId={trackId} onExit={leave} onLobby={onLobby} />

  // the room was already racing without you (you joined too late)
  if (room.match.status === 'playing' && saved && !inSaved) {
    return (
      <div className="gs lb lb-online">
        <Sheet title="Perlumbaan sedang berjalan">
          <p className="gs-panel__note">Perlumbaan ini dah bermula. Tunggu yang seterusnya!</p>
          <button type="button" className="gs-btn gs-btn--plain" onClick={onLobby}>
            Kembali
          </button>
        </Sheet>
      </div>
    )
  }
  if (room.match.status === 'abandoned') {
    return (
      <div className="gs lb lb-online">
        <Sheet title="Bilik ditutup">
          <p className="gs-panel__note">Tuan rumah dah tutup bilik ini.</p>
          <button type="button" className="gs-btn gs-btn--plain" onClick={onLobby}>
            Kembali
          </button>
        </Sheet>
      </div>
    )
  }

  if (picking)
    return (
      <div className="gs lb">
        <div className="gs-top">
          <ExitButton onExit={() => setPicking(false)} />
        </div>
        <BikeSelect
          index={bikeIndex}
          setIndex={setBikeIndex}
          onPick={() => {
            sfx.select()
            setPicking(false)
          }}
        />
      </div>
    )

  const capacity = room.match.capacity
  // who rides: everyone in the room's table (the live "here" list can lag behind on a phone)
  const humans = room.players
  const bikeOf = (p) => p.bike ?? room.here[p.userId]?.bike ?? BICYCLES[0].id
  const canStart = room.isHost && humans.length >= 2 && !starting

  const start = async () => {
    sfx.select()
    setStarting(true)
    setError(null)
    // humans keep their seats; every other seat gets an AI rider
    const roster = humans.map((p) => ({ seat: p.seat, kind: 'human', name: p.name, gender: p.gender, bikeId: bikeOf(p) }))
    const basic = BICYCLES.filter((b) => !b.minLevel)
    let k = 0
    for (let seat = 0; seat < capacity; seat++) {
      if (roster.some((r) => r.seat === seat)) continue
      const rival = RIVALS[k % RIVALS.length]
      roster.push({ seat, kind: 'ai', name: rival.name, rival: k % RIVALS.length, bikeId: basic[(seat + k) % basic.length].id })
      k++
    }
    roster.sort((a, b) => a.seat - b.seat)
    try {
      await room.start(roster)
    } catch (e) {
      setError(explainMatchError(e))
      setStarting(false)
    }
  }

  const link = inviteLink(room.match)
  const message = `Jom lumba basikal dengan saya di Permainan Tradisional! Kod: ${room.match.code}\n${link}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  const share = async () => {
    sfx.select()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Jom lumba!', text: message })
        return
      } catch {
        // closed the share sheet: copy instead
      }
    }
    copy()
  }

  const seats = Array.from({ length: capacity }, (_, seat) => room.players.find((p) => p.seat === seat) ?? null)

  return (
    <div className="gs lb lb-online">
      <div className="gs-top">
        <ExitButton onExit={leave} />
      </div>
      <Sheet title={`Bilik lumba · ${def.name}`}>
        <p className="ol-code" aria-label={`Kod ${room.match.code.split('').join(' ')}`}>
          {room.match.code}
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

        <ol className="lb-seats" aria-label="Pelumba">
          {seats.map((p, seat) => {
            const me = p && p.userId === room.userId
            const here = p && (me || room.here[p.userId])
            const theirBike = p ? getBicycle(me ? bike.id : bikeOf(p)) : null
            return (
              <li key={seat} className={`${p ? (here ? 'is-here' : 'is-away') : 'is-empty'} ${me ? 'is-me' : ''}`}>
                <i className="lb-seats__dot" style={{ background: SEAT_COLORS[seat] }} />
                {p ? (
                  <>
                    <span className="lb-seats__name">
                      {p.name}
                      {seat === 0 && <small> · tuan rumah</small>}
                      {me && <small> · kamu</small>}
                    </span>
                    <span className="lb-seats__bike">
                      {theirBike?.name ?? '…'}
                      {!here && ' · ?'}
                    </span>
                  </>
                ) : (
                  <span className="lb-seats__name lb-seats__wait">Menunggu kawan… (AI kalau kosong)</span>
                )}
              </li>
            )
          })}
        </ol>

        <div className="lb-room__bike">
          <span>
            Basikal kamu: <b>{bike.name}</b>
          </span>
          <button
            type="button"
            className="gs-btn gs-btn--plain"
            onClick={() => {
              sfx.tap()
              setPicking(true)
            }}
          >
            Tukar
          </button>
        </div>

        {room.isHost ? (
          <>
            <button type="button" className="gs-btn gs-btn--go" disabled={!canStart} onClick={start}>
              {starting ? 'Memulakan…' : 'Mula lumba'}
            </button>
            {humans.length < 2 && <p className="gs-panel__small lb-room__hint">Perlu sekurang-kurangnya seorang kawan untuk mula.</p>}
          </>
        ) : (
          <p className="ol-wait" role="status">
            <span className="ol-dots" aria-hidden="true" />
            Menunggu tuan rumah mula…
          </p>
        )}
        {error && (
          <p className="ol-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="gs-btn gs-btn--plain" onClick={leave}>
          Keluar bilik
        </button>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ the race */

function NetRace({ room, roster, trackId, onExit, onLobby }) {
  const player = usePlayerLook()
  const gender = useAuth((s) => s.profile?.gender)
  const track = useMemo(() => buildTrack(getTrack(trackId)), [trackId])
  const session = useProgressSession('lumba-basikal')
  const hud = useRef({ dots: {} })
  const [toast, setToast] = useState(null)
  const [count, setCount] = useState(null)
  const [started, setStarted] = useState(false) // the count has begun
  const [ready, setReady] = useState(false)
  const [standings, setStandings] = useState(null)
  const [reward, setReward] = useState(null)
  const [cancelled, setCancelled] = useState(false)
  const [exitArmed, setExitArmed] = useState(false)
  const { read, touch } = useRaceInput()
  const touchUI = useMemo(isTouch, [])
  const { progress } = useProgress()
  const onEvent = useRef(null)

  const mySeat = room.mySeat
  const humans = roster.filter((r) => r.kind === 'human').length
  // who's who: name, picture, colour, look, bike
  const cast = useMemo(
    () =>
      roster.map((p) => {
        const bike = getBicycle(p.bikeId)
        if (p.kind === 'ai') {
          const rival = RIVALS[p.rival ?? 0]
          return { ...p, bike, color: rival.color, img: rival === KAMARUL ? KAMARUL.img : null, look: rival.look }
        }
        const base = CHILD_LOOKS[p.gender] ?? Object.values(CHILD_LOOKS)[0]
        const mine = p.seat === mySeat
        return { ...p, bike, color: mine ? player.color : SEAT_COLORS[p.seat], img: lookOf(p).img, look: mine ? base : { ...base, shirt: SEAT_COLORS[p.seat] } }
      }),
    [roster, mySeat, player.color],
  )
  const castBySeat = useMemo(() => new Map(cast.map((c) => [c.seat, c])), [cast])

  const race = useMemo(() => {
    const r = createNetRace({
      track,
      roster: cast,
      mySeat,
      isHost: room.isHost,
      aiLevel: session.tuning,
      rate: rateFor(humans),
      room: { sendState: room.sendState, sendSnap: room.sendSnap, sendFinal: room.sendFinal },
      onEvent: (e) => onEvent.current?.(e),
    })
    r.youPos = new Vector3()
    for (const o of r.others) {
      const c = castBySeat.get(o.seat)
      o.look = c.look
      o.url = c.bike.modelPath
      o.scale = c.bike.scale ?? 1
    }
    return r
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (window.location.search.includes('debug')) window.__race = race
    return () => race.dispose()
  }, [race])

  // the room's messages go straight into the race
  useEffect(() => room.onEvent((name, data) => race.receive(name, data, performance.now() / 1000)), [room, race])

  // a hidden page gets no animation frames: keep the race (and its messages, the
  // host's AI and clock) going on a timer until it's back (browsers allow ~1 a second)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) race.step(0, IDLE_INPUT, performance.now() / 1000)
    }, 250)
    return () => clearInterval(id)
  }, [race])

  const showToast = useCallback((text, tone = '', ms = 1400) => setToast({ text, tone, key: Math.random(), ms }), [])

  onEvent.current = (e) => {
    switch (e.type) {
      case 'count':
        setStarted(true)
        setCount(e.n === 0 ? 'JOM!' : String(e.n))
        if (e.n === 0) window.setTimeout(() => setCount(null), 800)
        break
      case 'checkpoint':
        showToast(`Checkpoint ${e.n}/${e.of}`, 'good')
        break
      case 'final':
        showToast('PECUT!', 'hot', 1800)
        break
      case 'place':
        if (e.place < e.was) showToast(`${placeWord(e.place)}!`, 'good', 900)
        break
      case 'hit':
        showToast(e.fall ? (e.what === 'lubang' ? 'JATUH! Lubang!' : e.what === 'edge' ? 'JATUH longkang!' : 'JATUH!') : e.big ? 'Aduh!' : e.what === 'ayam' ? 'Ayam!' : e.what === 'lubang' ? 'Lubang!' : 'Goyang!', 'bad', e.fall ? 1600 : 900)
        break
      case 'shoved':
        showToast('Kena himpit!', 'them', 900)
        break
      case 'winner':
        if (!e.you) showToast(`${e.name} sampai dulu!`, 'them', 1800)
        break
      case 'finished':
        showToast(`TAMAT! ${placeWord(e.place)}`, e.place === 1 ? 'good' : '', 2600)
        break
      case 'done': {
        const mine = e.standings.find((s) => s.seat === mySeat)
        setStandings(e.standings)
        if (mine?.place === 1) sfx.win()
        else sfx.lose()
        const you = race.you
        const field = e.standings.length
        setReward(
          completeGame(session, {
            won: mine?.place === 1,
            time: you.finished ? you.finishTime : null,
            par: track.L / 7.4,
            underPar: you.finished && you.finishTime <= track.L / 7.4,
            crashes: you.falls ?? 0,
            hits: you.hits ?? 0,
            checkpoints: you.nextCp / track.checkpoints.length,
            score: field - (mine?.place ?? field),
            theirs: (mine?.place ?? field) - 1,
            trackId,
            bikeId: castBySeat.get(mySeat)?.bike.id,
            seconds: Math.round(you.finished ? you.finishTime : race.time),
          }),
        )
        break
      }
      case 'cancel':
        setCancelled(true)
        break
      case 'resume':
        setCancelled(false)
        showToast('Tuan rumah kembali!', 'good')
        break
      default:
        break
    }
  }

  // HUD numbers straight into the DOM every frame (no re-renders)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const h = hud.current
      const you = race.you
      const pos = (r) => Math.max(0, Math.min(1, progressOf(track, r) / track.L))
      for (const x of race.riders) {
        const el = h.dots[x.seat]
        if (el) {
          el.style.left = `${pos(x.r) * 100}%`
          el.classList.toggle('is-gone', x.gone)
        }
      }
      if (h.time) {
        const text = shortClock(you.finished ? you.finishTime : race.time)
        if (h.time.textContent !== text) h.time.textContent = text
      }
      if (h.place) {
        const text = `${placeWord(race.place)}/${race.riders.length}`
        if (h.place.textContent !== text) h.place.textContent = text
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

  const myCast = castBySeat.get(mySeat)
  const looks = useMemo(() => ({ you: CHILD_LOOKS[gender] ?? Object.values(CHILD_LOOKS)[0] }), [gender])
  const urls = useMemo(() => ({ you: { url: myCast.bike.modelPath, scale: myCast.bike.scale ?? 1 } }), [myCast])
  const readInput = useCallback(() => (race.ready ? read() : IDLE_INPUT), [race, read])

  // leaving mid-race: tap twice (you're out of this race)
  const exit = () => {
    if (standings || cancelled || exitArmed) return onExit()
    setExitArmed(true)
    showToast('Tekan Keluar sekali lagi untuk tinggalkan perlumbaan', 'bad', 2200)
    setTimeout(() => setExitArmed(false), 3000)
    return undefined
  }

  return (
    <div className="lb-race">
      <RaceView race={race} looks={looks} urls={urls} readInput={readInput} onReady={onReady} />

      <div className="lb-hud">
        <div className="lb-top">
          <ExitButton onExit={exit} />
          <div className="lb-progress" aria-label="Kedudukan perlumbaan">
            <div className="lb-progress__names">
              <span ref={(el) => (hud.current.place = el)} className="lb-place">
                Ke-1/{roster.length}
              </span>
              <span ref={(el) => (hud.current.time = el)} className="lb-time">
                00:00
              </span>
              <span>{getTrack(trackId).name}</span>
            </div>
            <div className="lb-progress__line">
              {track.checkpoints.map((s, k) => (
                <i key={k} className="lb-progress__cp" style={{ left: `${(s / track.L) * 100}%` }} />
              ))}
              {cast.map((c) =>
                c.img ? (
                  <img
                    key={c.seat}
                    ref={(el) => (hud.current.dots[c.seat] = el)}
                    src={c.img}
                    alt=""
                    className={`lb-progress__dot ${c.seat === mySeat ? 'is-you' : 'is-them'}`}
                    style={{ borderColor: c.color }}
                  />
                ) : (
                  <span key={c.seat} ref={(el) => (hud.current.dots[c.seat] = el)} className="lb-progress__dot is-them lb-progress__dot--ai" style={{ background: c.color }}>
                    {c.name[0]}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        <p className="lb-cp">
          Checkpoint <b ref={(el) => (hud.current.cp = el)}>0/3</b> · {roster.length} pelumba
        </p>

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

        {touchUI && !standings && (
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
          <p>Memuatkan {getTrack(trackId).name}…</p>
          <div className="lb-loading__bar">
            <i style={{ width: `${Math.max(8, progress)}%` }} />
          </div>
          <p className="lb-loading__small">{Math.round(progress)}%</p>
        </div>
      )}
      {ready && !started && !standings && !cancelled && <p className="lb-waiting">Menunggu semua pelumba bersedia…</p>}

      {cancelled && !standings && (
        <Sheet title="Tuan rumah terputus">
          <p className="gs-panel__note">Menunggu tuan rumah kembali… Perlumbaan bersambung bila dia kembali.</p>
          <p className="ol-wait" role="status">
            <span className="ol-dots" aria-hidden="true" />
            Menunggu…
          </p>
          <button type="button" className="gs-btn gs-btn--plain" onClick={onLobby}>
            Bilik baharu
          </button>
          <button type="button" className="gs-btn gs-btn--plain" onClick={onExit}>
            Keluar
          </button>
        </Sheet>
      )}

      {standings && (
        <div className="gs-sheet lb-result-sheet">
          <div className="gs-panel lb-result">
            <h2 className={`gs-panel__title gs-panel__title--big ${standings.find((s) => s.seat === mySeat)?.place === 1 ? 'is-win' : ''}`}>TAMAT!</h2>
            <ol className="lb-podium lb-podium--many">
              {standings.map((s) => {
                const c = castBySeat.get(s.seat)
                return (
                  <li key={s.seat} className={s.seat === mySeat ? 'is-you' : ''}>
                    <span className="lb-podium__medal">{medal(s.place)}</span>
                    {c?.img ? (
                      <img src={c.img} alt="" />
                    ) : (
                      <span className="lb-podium__ai" style={{ background: c?.color }}>
                        {s.name[0]}
                      </span>
                    )}
                    <span className="lb-podium__name">
                      {s.name}
                      {s.kind === 'ai' && <small> · AI</small>}
                    </span>
                    <span className="lb-podium__time">{s.dnf ? 'DNF' : `${s.estimated ? '~' : ''}${clock(s.time)}`}</span>
                  </li>
                )
              })}
            </ol>
            <ProgressReward reward={reward} />
            <div className="lb-result__buttons">
              <button type="button" className="gs-btn gs-btn--go" onClick={onLobby}>
                Lumba lagi
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

