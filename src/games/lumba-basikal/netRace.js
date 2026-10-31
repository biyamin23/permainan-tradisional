import { raceSfx, setMusicPace, sfx } from '../../audio/engine.js'
import { makeKamarulAI, thinkKamarul } from './kamarulAI.js'
import { checkProgress, makeRacer, placeObstacles, progressOf, separate, stepRacer, updateObstacles } from './raceSim.js'

/**
 * A race with friends: 2–8 riders, one lap, AI in the empty seats.
 *
 * Every screen simulates its own rider (no lag on your own bike); the host
 * also runs the AI riders. Everyone else on your screen is a copy that
 * follows what the host last said about them, carried forward along their
 * heading in between, so they ride smoothly even at 2 updates a second.
 * Bumping happens on each screen against those copies.
 *
 * The host runs the clock: it holds the grid until everyone has loaded,
 * counts down, and after the first rider crosses gives the rest a while to
 * come in, then sends the final standings.
 *
 * `room` is the transport (useRaceRoom, or a stand-in in tests):
 *   room.sendState(s) · room.sendSnap(snap) · room.sendFinal(standings, winnerSeat, again)
 *
 * Lag: a guest's uplink echoes the last snapshot's timestamp, so the host
 * knows each guest's round trip; snapshots carry everyone's one-way delay,
 * and each copy is carried forward by the whole way it travelled.
 * and the screen feeds incoming messages to race.receive(name, data, now).
 */

const READY_WAIT = 10 // seconds the host waits on the grid for slow loaders
const PRE_MIN = 2.2
const COUNT_SECONDS = 3
const WAIT_FOR_REST = 25 // after the first rider crosses, how long the others get
const AFTER_ALL = 3 // celebration before the results
const GONE_AFTER = 15 // seconds without a word: that rider has dropped out (or the host has)
const MAX_AGE = 1.2 // never carry a rider forward further than this
const SNAP_DIST = 8 // a copy further than this from where it should be jumps there
const STEP = 1 / 30 // longest single physics step
const MAX_CATCH_UP = 2 // a longer stall than this is not replayed

const PHASES = ['pre', 'count', 'race', 'finish', 'done']

const BUDGET = 50 // Realtime messages a second one race may use (the Free plan allows 100 for the whole project)

/** Updates a second for `humans` players: each guest's uplink (2 messages) + one snapshot to all (1 + players). */
export const rateFor = (humans) => Math.max(2, Math.min(10, Math.floor(BUDGET / Math.max(1, 3 * humans - 2))))
const r2 = (v) => Math.round(v * 100) / 100

/** Grid slots: four abreast, rows 3.2 m apart. */
function gridSpot(track, seat) {
  const col = seat % 4
  const row = Math.floor(seat / 4)
  const half = Math.max(1.4, track.width[0] / 2 - 0.5)
  return { lat: (col - 1.5) * Math.min(1.3, half / 1.5), back: Math.round((row * 3.2) / track.ds) }
}

/** A rider as it goes over the wire (numbers only, rounded). */
export function encodeRider(r) {
  const flags = (r.boosting ? 1 : 0) | (r.lastThrottle > 0 ? 2 : 0) | (r.finished ? 4 : 0)
  return [r2(r.x), r2(r.z), Math.round(r.heading * 1000) / 1000, r2(r.speed), r.i, r.lap, r2(r.lean), r2(r.steer), r2(r.fallT), r.fallDir, r2(r.stun), flags, r2(r.finishTime), r.nextCp]
}

function decodeRider(t) {
  return {
    x: t[0], z: t[1], heading: t[2], speed: t[3], i: t[4], lap: t[5], lean: t[6], steer: t[7],
    fallT: t[8], fallDir: t[9], stun: t[10], boosting: (t[11] & 1) > 0, pedal: (t[11] & 2) > 0,
    finished: (t[11] & 4) > 0, finishTime: t[12], nextCp: t[13],
  }
}

const angleDiff = (a, b) => {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

const _p = { i: 0, lat: 0 }

/** Move a copy towards where its rider should be now. */
function followTarget(track, r, tg, now, dt) {
  const age = Math.min(MAX_AGE, Math.max(0, now - tg.at))
  const moving = tg.fallT > 0 || tg.finished ? 0 : tg.speed
  const px = tg.x + Math.sin(tg.heading) * moving * age
  const pz = tg.z + Math.cos(tg.heading) * moving * age
  // ride on at their speed, then close part of the gap to where they should be
  if (!r.fallT) {
    r.x += Math.sin(r.heading) * moving * dt
    r.z += Math.cos(r.heading) * moving * dt
  }
  const far = Math.hypot(px - r.x, pz - r.z) > SNAP_DIST
  const k = far ? 1 : 1 - Math.exp(-5 * dt)
  r.x += (px - r.x) * k
  r.z += (pz - r.z) * k
  r.heading += angleDiff(tg.heading, r.heading) * (far ? 1 : 1 - Math.exp(-8 * dt))
  r.speed = tg.speed
  r.lean += (tg.lean - r.lean) * (1 - Math.exp(-8 * dt))
  r.steer = tg.steer
  r.boosting = tg.boosting
  r.lastThrottle = tg.pedal ? 1 : 0
  r.distance += r.speed * dt
  if (tg.pedal) r.crank += (r.speed / Math.max(0.2, r.bike.wheelR ?? 0.3) / 2.4) * dt
  if (tg.fallT > 0 && r.fallT <= 0) {
    r.fallT = tg.fallT
    r.fallDir = tg.fallDir
  } else r.fallT = Math.max(0, r.fallT - dt)
  r.stun = Math.max(0, tg.stun - age)
  r.finished = tg.finished
  r.finishTime = tg.finishTime
  r.nextCp = tg.nextCp
  // where on the loop, from the target's lap and the nearest sample
  track.project(r.x, r.z, far ? tg.i : r.i, far ? 20 : 8, _p)
  let lap = tg.lap
  if (tg.i > track.n * 0.8 && _p.i < track.n * 0.2) lap++
  else if (tg.i < track.n * 0.2 && _p.i > track.n * 0.8) lap--
  r.i = _p.i
  r.lat = _p.lat
  r.lap = lap
  const y = track.heightAt(r.i, r.lat)
  r.pitch = Math.atan2(track.heightAt(r.i + 2, r.lat) - track.heightAt(r.i - 2, r.lat), 4 * track.ds) * Math.cos(angleDiff(r.heading, Math.atan2(track.tx[r.i], track.tz[r.i])))
  r.y = y
}

/**
 * roster: [{ seat, kind: 'human' | 'ai', name, bike }] (bike: from bicycles.js)
 * aiLevel: the AI riders' tuning (the host's). quiet: no sounds (tests).
 */
export function createNetRace({ track, roster, mySeat, isHost, aiLevel, room, onEvent = () => {}, quiet = false, rate = 4 }) {
  const obstacles = placeObstacles(track, track.def.obstacles)
  const riders = roster.map((p) => {
    const spot = gridSpot(track, p.seat)
    const r = makeRacer(track, { ...p.bike }, spot.lat, `seat-${p.seat}`)
    r.i = track.wrap(r.i - spot.back)
    track.point(r.i, spot.lat, r)
    r.heading = Math.atan2(track.tx[r.i], track.tz[r.i])
    r.lastThrottle = 0
    const local = p.seat === mySeat || (isHost && p.kind === 'ai')
    return {
      ...p,
      r,
      local,
      ai: isHost && p.kind === 'ai' ? makeKamarulAI(track, aiLevel) : null,
      target: null, // last word about a copy: decoded rider + `at`
      heardAt: 0, // (host) last message from this human
      ready: p.kind === 'ai' || p.seat === mySeat,
      gone: false,
    }
  })
  const bySeat = new Map(riders.map((x) => [x.seat, x]))
  const mine = bySeat.get(mySeat)
  const others = riders.filter((x) => x.seat !== mySeat)

  const race = {
    track,
    obstacles,
    you: mine.r,
    others,
    riders,
    phase: 'pre',
    phaseT: 0,
    time: 0,
    clock: 0,
    count: 3,
    winner: null,
    paused: false,
    ready: false,
    standings: null,
    cancelled: false,
    lastSnapAt: 0,
    firstAt: null,
    place: 1,
  }
  // the camera's "the other one": whoever is nearest you
  Object.defineProperty(race, 'kamarul', {
    get() {
      let best = others[0]?.r ?? mine.r
      let bd = Infinity
      for (const o of others) {
        const d = (o.r.x - mine.r.x) ** 2 + (o.r.z - mine.r.z) ** 2
        if (d < bd) {
          bd = d
          best = o.r
        }
      }
      return best
    },
  })

  const sound = (fn) => {
    if (!quiet) fn()
  }
  const setPhase = (p, t = 0) => {
    race.phase = p
    race.phaseT = t
  }

  /** Messages from the room. `now` is this screen's clock (seconds). */
  race.receive = (name, data, now) => {
    if (name === 'state' && isHost) {
      const x = bySeat.get(data.seat)
      if (!x || x.local) return
      x.heardAt = now
      x.gone = false
      if (data.s.ready) x.ready = true
      // round trip: now, less the snapshot it last saw and how long it held it
      if (data.s.e) {
        const rtt = Math.max(0, Math.min(1500, now * 1000 - data.s.e[0] - data.s.e[1]))
        x.oneWay = x.oneWay === undefined ? rtt / 2 : x.oneWay * 0.8 + (rtt / 2) * 0.2
      }
      if (data.s.r) x.target = { ...decodeRider(data.s.r), at: now - (x.oneWay ?? 0) / 1000 }
    } else if (name === 'snap' && !isHost) {
      race.lastSnapAt = now
      race.snapTs = data.ts
      const ow = data.ow ?? {}
      const mine = ow[mySeat] ?? 0
      for (const row of data.rs) {
        const x = bySeat.get(row[0])
        if (!x || x.seat === mySeat) continue
        // how old this is: held by the host, plus their way to the host, plus the host's way to you
        x.target = { ...decodeRider(row.slice(2)), at: now - (row[1] + (ow[row[0]] ?? 0) + mine) / 1000 }
        x.gone = row[2 + 14] === 1
      }
      // the host's clock: catch up with its phase
      const hostPhase = PHASES[data.ph]
      if (PHASES.indexOf(hostPhase) > PHASES.indexOf(race.phase) && hostPhase !== 'done') {
        const from = race.phase
        setPhase(hostPhase, data.pt)
        if (hostPhase === 'count' || (from === 'pre' && hostPhase === 'race')) {
          race.count = 4 // the count below announces 3
        }
        if (hostPhase === 'race' && from !== 'count') race.time = data.rt
      }
    } else if (name === 'final' && !isHost) {
      finishWith(data.standings)
    } else if (name === 'left') {
      const x = bySeat.get(data.seat)
      if (x) x.gone = true
    }
  }

  const finishWith = (standings) => {
    if (race.standings) return
    race.standings = standings
    setPhase('done')
    sound(() => setMusicPace(1))
    onEvent({ type: 'done', standings })
  }

  /** Host: everyone's place once it's over (finished by time, then the rest by distance, gone last). */
  const standingsNow = () => {
    const rows = riders.map((x) => {
      const r = x.r
      let time = r.finished ? r.finishTime : null
      if (time === null && !x.gone) time = race.time + Math.max(0, track.L - progressOf(track, r)) / Math.max(4, r.speed)
      return { seat: x.seat, name: x.name, kind: x.kind, time: time === null ? null : r2(time), dnf: x.gone && !r.finished, estimated: !r.finished && !x.gone }
    })
    rows.sort((a, b) => (a.dnf - b.dnf) || (a.time ?? 1e9) - (b.time ?? 1e9))
    return rows.map((row, k) => ({ ...row, place: k + 1 }))
  }

  /** Where you are right now (1 = in front). */
  const placeOf = (me) => {
    if (race.standings) return race.standings.find((s) => s.seat === mySeat)?.place ?? 1
    const mp = progressOf(track, me)
    let place = 1
    for (const o of others) {
      if (o.gone) continue
      const r = o.r
      if (me.finished) {
        if (r.finished && r.finishTime < me.finishTime) place++
      } else if (r.finished || progressOf(track, r) > mp) place++
    }
    return place
  }

  const stepOnce = (dt, input, now) => {
    if (race.standings) {
      race.clock += dt
      // the host says the results again for a while (one message can get lost)
      if (isHost && race.clock - race.finalAt < 10 && race.clock - race.finalSent >= 1) {
        race.finalSent = race.clock
        room.sendFinal(race.standings, race.winnerSeat, true)
      }
      return
    }
    if (race.paused) return
    race.clock += dt
    race.phaseT += dt
    updateObstacles(track, obstacles, race.clock)
    const racing = race.phase === 'race' || race.phase === 'finish'

    // ----- the clock (host decides; guests follow its snapshots)
    if (isHost) {
      if (race.phase === 'pre') {
        const allReady = riders.every((x) => x.ready || x.gone)
        if (race.ready && race.phaseT > PRE_MIN && (allReady || race.phaseT > READY_WAIT)) {
          setPhase('count')
          race.count = 4
        }
      }
    } else if (race.lastSnapAt && now - race.lastSnapAt > GONE_AFTER && !race.cancelled) {
      race.cancelled = true
      onEvent({ type: 'cancel' })
      return
    }
    // once the count has begun, everyone goes on their own clock (no waiting for a snapshot)
    if (race.phase === 'count' && race.phaseT >= COUNT_SECONDS) setPhase('race', race.phaseT - COUNT_SECONDS)
    if (race.phase === 'count') {
      const n = Math.max(0, 3 - Math.floor(race.phaseT / (COUNT_SECONDS / 3)))
      if (n !== race.count && n > 0) {
        race.count = n
        sound(() => raceSfx.count())
        onEvent({ type: 'count', n })
      }
    }
    if (race.phase === 'race' && race.count !== 0) {
      race.count = 0
      sound(() => {
        raceSfx.go()
        raceSfx.bell()
      })
      onEvent({ type: 'count', n: 0 })
    }

    // ----- ride: your own bike, the host's AI, and copies of everyone else
    const me = mine.r
    stepRacer(track, me, racing && !me.finished ? input : IDLE, dt, obstacles, race.clock)
    for (const x of others) {
      if (x.ai) {
        // AI riders race whoever is nearest them
        let near = me
        let nd = Infinity
        for (const y of riders) {
          if (y === x) continue
          const d = (y.r.x - x.r.x) ** 2 + (y.r.z - x.r.z) ** 2
          if (d < nd) {
            nd = d
            near = y.r
          }
        }
        const inp = thinkKamarul(x.ai, track, x.r, near, obstacles, race.time, dt, racing)
        stepRacer(track, x.r, x.r.finished ? IDLE : inp, dt, obstacles, race.clock)
      } else if (x.target && !x.gone) {
        followTarget(track, x.r, x.target, now, dt)
      }
    }
    // bumps: anything simulated here against everyone near it
    for (let a = 0; a < riders.length; a++) {
      const A = riders[a]
      if (A.gone) continue
      for (let b = a + 1; b < riders.length; b++) {
        const B = riders[b]
        if (B.gone || (!A.local && !B.local)) continue
        const pusher = A.ai?.state === 'BUMP' ? A.r : B.ai?.state === 'BUMP' ? B.r : null
        const contact = separate(A.r, B.r, pusher)
        if (contact && (A.r === me || B.r === me) && race.clock - (race.lastBump ?? -9) > 1.2) {
          race.lastBump = race.clock
          sound(() => raceSfx.knock(contact === 'shove'))
        }
      }
    }
    if (racing) {
      race.time += dt
      checkProgress(track, me, race.time)
      for (const x of others) if (x.ai) checkProgress(track, x.r, race.time)
    }

    // ----- your moments
    for (const e of me.events) {
      if (e === 'hit' || e === 'stun' || e === 'fall') {
        sound(() => {
          raceSfx.knock(e !== 'hit')
          if (me.lastHit === 'ayam') raceSfx.chicken()
          if (me.lastHit === 'motosikal') raceSfx.horn()
        })
        onEvent({ type: 'hit', who: 'you', big: e !== 'hit', fall: e === 'fall', what: me.lastHit })
      }
      if (e === 'shoved') onEvent({ type: 'shoved' })
      if (e === 'splash') sound(() => raceSfx.splash())
      if (e === 'checkpoint') {
        sound(() => raceSfx.checkpoint())
        onEvent({ type: 'checkpoint', n: me.nextCp, of: track.checkpoints.length })
      }
      if (e === 'final') {
        sound(() => setMusicPace(1.3))
        onEvent({ type: 'final' })
      }
      if (e === 'finish') {
        sound(() => sfx.extraTurn())
        onEvent({ type: 'finished', place: placeOf(me) })
      }
    }

    // ----- places, the first across, the end (host)
    const place = placeOf(me)
    if (place !== race.place && race.phase === 'race' && race.time > 3) onEvent({ type: 'place', place, was: race.place })
    race.place = place
    if (racing && !race.winner) {
      const first = riders.find((x) => x.r.finished)
      if (first) {
        race.winner = first.r.name
        race.firstAt = race.time
        if (race.phase === 'race') setPhase('finish')
        onEvent({ type: 'winner', seat: first.seat, name: first.name, you: first.seat === mySeat })
      }
    }
    if (isHost) {
      // a guest who's gone quiet has dropped out
      for (const x of others) {
        if (x.kind !== 'human' || x.gone) continue
        if (x.heardAt === 0) x.heardAt = now
        else if (now - x.heardAt > GONE_AFTER) x.gone = true
      }
      if (race.phase === 'finish') {
        const allIn = riders.every((x) => x.r.finished || x.gone)
        if (allIn && race.allInAt === undefined) race.allInAt = race.phaseT
        const timeUp = race.time - race.firstAt > WAIT_FOR_REST
        if ((race.allInAt !== undefined && race.phaseT - race.allInAt > AFTER_ALL) || timeUp) {
          const standings = standingsNow()
          const winner = standings.find((s) => !s.dnf)
          race.winnerSeat = winner ? winner.seat : null
          race.finalAt = race.finalSent = race.clock
          room.sendFinal(standings, race.winnerSeat, false)
          finishWith(standings)
        }
      }
    }

  }

  /** Tell the others (a few times a second, at most once a frame, on the real clock). */
  const sendUpdate = (now) => {
    if (race.standings || now - (race.sentAt ?? -1) < 1 / rate) return
    race.sentAt = now
    const me = mine.r
    if (isHost) {
      const ow = {}
      for (const x of riders) if (x.oneWay !== undefined) ow[x.seat] = Math.round(x.oneWay)
      room.sendSnap({
        ts: Math.round(now * 1000),
        ow,
        ph: PHASES.indexOf(race.phase),
        pt: r2(race.phaseT),
        rt: r2(race.time),
        rs: riders.map((x) => {
          // (how long the host has held it; their own way here is in `ow`)
          const fresh = x.local || !x.target ? 0 : Math.max(0, Math.round((now - x.target.at) * 1000 - (x.oneWay ?? 0)))
          const tuple = x.local || !x.target ? encodeRider(x.r) : encodeRider({ ...x.r, ...x.target, lastThrottle: x.target.pedal ? 1 : 0 })
          return [x.seat, fresh, ...tuple, x.gone ? 1 : 0]
        }),
      })
    } else {
      const echo = race.snapTs === undefined ? undefined : [race.snapTs, Math.round((now - race.lastSnapAt) * 1000)]
      room.sendState({ ready: race.ready, r: encodeRider(me), e: echo })
    }
  }

  /**
   * One frame. The race keeps to real time whatever the frame rate: a slow
   * frame is caught up in small steps, so a phone that drops frames doesn't
   * slow the race (or, on the host, the clock and the AI) for everyone.
   */
  race.step = (dt, input, now) => {
    const real = race.lastNow === undefined ? dt : Math.min(MAX_CATCH_UP, Math.max(0, now - race.lastNow))
    race.lastNow = now
    if (real <= 0) return
    const n = Math.max(1, Math.ceil(real / STEP))
    for (let k = 0; k < n; k++) stepOnce(real / n, input, now - real + (real * (k + 1)) / n)
    sendUpdate(now)
  }

  race.dispose = () => sound(() => setMusicPace(1))
  return race
}

const IDLE = { throttle: 0, brake: 0, steer: 0, boost: false }
