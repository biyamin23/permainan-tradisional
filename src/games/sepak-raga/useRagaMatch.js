import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import {
  DEAD_REASON,
  LAMBUNGAN,
  PERFECT,
  PLAYERS,
  ROUNDS,
  SERVER,
  SKILL,
  TEAM_THEM,
  TEAM_YOU,
  TIMING,
  TURN_SECONDS,
  aiAction,
  legalTargets,
  matchResult,
  newRally,
  scorePass,
  serve,
  simulateRally,
  touch,
} from './engine'

/**
 * Runs a match of Sepak Raga: two teams take turns in the circle (3 rounds ×
 * 3 lambungan each). Game state lives in a ref (`g`) that the 3D view reads
 * every frame; `bump()` re-renders the buttons and cards.
 *
 * Court: circle radius R round (0, 0); player i stands at angle i·72°,
 * clockwise seen from above, player 1 (i = 0) nearest the camera.
 */

export const R = 3
export const now = () => performance.now() / 1000

export function spotOf(i) {
  const a = (i / PLAYERS) * Math.PI * 2
  return [-Math.sin(a) * R, 0, Math.cos(a) * R]
}

const KIND_Y = { kid: { sila: 0.42, kuda: 0.45, lutut: 0.62, kepala: 1.5 }, adult: { sila: 0.5, kuda: 0.55, lutut: 0.78, kepala: 1.95 } }
/** Where the ball meets player i for a given kind of touch. */
export function contactPoint(i, kind, build) {
  const [x, , z] = spotOf(i)
  const k = kind === 'kuda' ? 0.86 : 0.84
  return [x * k, KIND_Y[build]?.[kind] ?? 0.6, z * k]
}
/** The human's touches meet the ball at a comfortable height in front. */
// (a little to your right, so the ball isn't hidden behind you)
const YOU_POINT = (() => {
  const [x, , z] = spotOf(0)
  return [x * 0.86 + 0.42, 0.95, z * 0.86]
})()

const pickKind = (random) => {
  const r = random()
  return r < 0.45 ? 'sila' : r < 0.65 ? 'kuda' : r < 0.85 ? 'lutut' : 'kepala'
}

/** Ball position on a flight at time t. */
export function ballAt(f, t) {
  if (!f) return null
  const u = Math.min(1, Math.max(0, (t - f.start) / f.dur))
  return [
    f.from[0] + (f.to[0] - f.from[0]) * u,
    f.from[1] + (f.to[1] - f.from[1]) * u + f.apex * 4 * u * (1 - u),
    f.from[2] + (f.to[2] - f.from[2]) * u,
  ]
}

/** Tuning for a match: from progression ({ timing, you, them }), or an old level name. */
const tune = (level) => (typeof level === 'string' ? { timing: TIMING[level], you: SKILL.you[level], them: SKILL.them[level] } : level)

export function useRagaMatch({ level, starter, teams }) {
  const [, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const timers = useRef(new Set())
  const g = useRef(null)
  if (!g.current) {
    g.current = {
      level,
      teams, // [yourTeam, pakTeam]
      order: [starter, 1 - starter],
      turnIdx: 0,
      round: 1,
      lambungan: 1,
      team: starter,
      scores: [0, 0],
      seconds: [0, 0],
      timeLeft: TURN_SECONDS,
      rally: newRally(),
      flight: null,
      window: null, // { tc, w }: your timing window
      phase: 'start', // start | serve | live | dead | turnEnd | done
      banner: null,
      speech: null,
      result: null,
      lastQuality: null,
      acts: [0, 1].map(() => Array.from({ length: PLAYERS }, () => ({ t: -99, kind: 'sila' }))),
      clockNow: () => 0, // the 3D view's clock (for PersonModel actions)
      skippedTo: null,
    }
  }

  // ?debug: expose the match for automated checks
  if (typeof window !== 'undefined' && window.location.search.includes('debug')) window.__raga = g

  const later = useCallback((sec, fn) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, sec * 1000)
    timers.current.add(id)
    return id
  }, [])
  const cancel = useCallback((id) => {
    window.clearTimeout(id)
    timers.current.delete(id)
  }, [])
  const clearAll = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current.clear()
  }, [])
  useEffect(() => clearAll, [clearAll])

  const banner = useCallback(
    (text, tone = 'info') => {
      g.current.banner = { text, tone, key: `${Math.random()}` }
      bump()
    },
    [bump],
  )
  const say = useCallback(
    (text) => {
      g.current.speech = { text, key: `${Math.random()}` }
      bump()
    },
    [bump],
  )

  // ------------------------------------------------------------ helpers
  const isYou = (team, i) => team === TEAM_YOU && i === 0
  const buildOf = (team) => (team === TEAM_YOU ? 'kid' : 'adult')
  const pointFor = (team, i, kind) => (isYou(team, i) ? YOU_POINT : contactPoint(i, kind, buildOf(team)))
  const animate = (team, i, kind) => {
    const a = g.current.acts[team][i]
    a.t = g.current.clockNow()
    a.kind = kind
  }
  const ballNow = () => {
    const s = g.current
    return ballAt(s.flight, now()) ?? [0, 1, R]
  }
  const fly = (to, dur, apex, kind, from = ballNow()) => {
    g.current.flight = { from, to, start: now(), dur, apex, kind }
    return g.current.flight.start + dur
  }

  // ------------------------------------------------------------ the rally
  // (declared with function hoisting through a ref so they can call each other)
  const fx = useRef({})
  const f = fx.current

  f.startTurn = () => {
    const s = g.current
    s.team = s.order[s.turnIdx]
    s.lambungan = 1
    s.timeLeft = TURN_SECONDS
    s.phase = 'start'
    s.flight = null
    s.window = null
    banner(s.team === TEAM_YOU ? `Pusingan ${s.round}: giliran pasukan kamu!` : `Pusingan ${s.round}: giliran Geng Pak-pak!`, s.team === TEAM_YOU ? 'you' : 'them')
    later(1.6, f.startLambungan)
  }

  f.startLambungan = () => {
    const s = g.current
    s.rally = newRally()
    s.window = null
    // the server holds the ball up in both hands
    const [x, , z] = spotOf(SERVER)
    const h = buildOf(s.team) === 'kid' ? 1.15 : 1.5
    s.flight = { from: [x * 0.9, h, z * 0.9], to: [x * 0.9, h, z * 0.9], start: now(), dur: 1, apex: 0, kind: 'hold' }
    if (s.team === TEAM_YOU) {
      s.phase = 'serve'
      bump()
    } else {
      s.phase = 'live'
      bump()
      const targets = [2, 3, 4]
      later(1.1, () => f.serveTo(targets[Math.floor(Math.random() * 3)]))
    }
  }

  f.serveTo = (to) => {
    const s = g.current
    if (s.rally.serving !== true) return
    animate(s.team, SERVER, 'lambung')
    s.rally = serve(s.rally, to)
    s.phase = 'live'
    bump()
    later(0.28, () => {
      sfx.pop()
      const kind = isYou(s.team, to) ? 'sila' : pickKind(Math.random)
      const tc = fly(pointFor(s.team, to, kind), 1.35, 2.6, 'serve')
      f.arrive(to, kind, tc)
    })
  }

  /** The ball is on its way to player i, reaching them at time tc. */
  f.arrive = (i, kind, tc) => {
    const s = g.current
    if (isYou(s.team, i)) {
      const w = tune(s.level).timing
      s.window = { tc, w, missId: later(tc - now() + w, () => f.youMiss('lambat')) }
      bump()
      return
    }
    later(tc - now(), () => f.aiTouch(i, kind))
  }

  f.aiTouch = (i, kind) => {
    const s = g.current
    if (s.phase !== 'live') return
    const skill = tune(s.level)[s.team === TEAM_YOU ? 'you' : 'them']
    const ok = Math.random() < skill
    animate(s.team, i, kind)
    const action = aiAction(s.rally, Math.random, s.team === TEAM_YOU ? 0 : null)
    f.apply(i, action, ok)
  }

  /** Player i plays the ball: 'timang' or a teammate's index. */
  f.apply = (i, action, ok) => {
    const s = g.current
    const wasPass = s.rally.incoming === 'pass' && s.rally.touches === 0
    let r = touch(s.rally, action, ok)
    if (!ok || r.dead) {
      s.rally = r
      f.die(r.dead ?? 'jatuh', i)
      return
    }
    sfx.seedPickup()
    if (wasPass) {
      r = scorePass(r)
      s.scores[s.team] += 1
      if (s.team === TEAM_THEM && r.points % 6 === 0) {
        const pak = s.teams[TEAM_THEM][Math.floor(Math.random() * PLAYERS)]
        say(`${pak.name}: ${pak.lines[Math.floor(Math.random() * pak.lines.length)]}`)
      }
    }
    s.rally = r
    if (r.dead) {
      f.die(r.dead, i)
      return
    }
    const target = action === 'timang' ? i : action
    const kind = isYou(s.team, target) ? 'sila' : pickKind(Math.random)
    const tc =
      action === 'timang'
        ? fly(pointFor(s.team, target, kind), isYou(s.team, target) ? 1.0 : 0.85, 1.25, 'timang')
        : fly(pointFor(s.team, target, kind), 1.12, 2.4, 'pass')
    bump()
    f.arrive(target, kind, tc)
  }

  /** Your miss: too early, too late. */
  f.youMiss = (why) => {
    const s = g.current
    if (!s.window) return
    cancel(s.window.missId)
    s.window = null
    s.rally = { ...s.rally, dead: 'jatuh' }
    f.die('jatuh', 0, why === 'awal' ? 'Awal sangat! Bola terlepas.' : 'Lambat! Bola jatuh.')
  }

  f.die = (reason, near, text) => {
    const s = g.current
    s.phase = 'dead'
    s.window = null
    const [x, , z] = spotOf(near)
    const spill = [x * 0.7 + (Math.random() - 0.5) * 1.2, 0.07, z * 0.7 + (Math.random() - 0.5) * 1.2]
    fly(spill, 0.6, 0.35, 'drop')
    later(0.6, () => sfx.locked())
    const line = text ?? `Mati! ${DEAD_REASON[reason] ?? ''}`
    banner(line, s.team === TEAM_YOU ? 'bad' : 'them')
    if (s.team === TEAM_THEM) say(`${s.teams[TEAM_THEM][near].name}: Alamak!`)
    later(2.1, f.nextLambungan)
  }

  f.nextLambungan = () => {
    const s = g.current
    if (s.timeLeft <= 0 || s.lambungan >= LAMBUNGAN) {
      f.endTurn()
      return
    }
    s.lambungan += 1
    f.startLambungan()
  }

  f.endTurn = () => {
    const s = g.current
    s.phase = 'turnEnd'
    s.window = null
    s.flight = null
    bump()
    later(1.2, () => {
      if (s.turnIdx === 0) {
        s.turnIdx = 1
        f.startTurn()
      } else if (s.round >= ROUNDS) {
        f.finish()
      } else {
        s.round += 1
        s.turnIdx = 0
        f.startTurn()
      }
    })
  }

  f.finish = () => {
    const s = g.current
    s.phase = 'done'
    s.result = { ...matchResult(s.scores, s.seconds), scores: s.scores.slice(), seconds: s.seconds.slice() }
    if (s.result.winner === TEAM_YOU) sfx.win()
    else if (s.result.winner === TEAM_THEM) sfx.lose()
    else sfx.draw()
    bump()
  }

  // ------------------------------------------------------------ the clock
  useEffect(() => {
    let last = now()
    const id = window.setInterval(() => {
      const s = g.current
      const t = now()
      const dt = t - last
      last = t
      if (s.phase !== 'live' && s.phase !== 'serve') return
      if (s.phase === 'serve') return // waiting for you to toss doesn't use the clock
      s.timeLeft = Math.max(0, s.timeLeft - dt)
      s.seconds[s.team] += dt
      if (s.timeLeft <= 0) {
        clearAll()
        f.die('masa', 0, 'Masa tamat!')
      }
      bump()
    }, 250)
    return () => window.clearInterval(id)
  }, [bump, clearAll, f])

  // first turn
  useEffect(() => {
    f.startTurn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------ your input
  /** Toss the ball to start a lambungan (you are player 1). */
  const serveTo = useCallback((to) => {
    const s = g.current
    if (s.phase !== 'serve' || s.team !== TEAM_YOU) return
    sfx.tap()
    f.serveTo(to)
  }, [f])

  /**
   * Play the ball: 'timang' or a teammate's index. Must be tapped as the
   * ball reaches you (the ring closes). Returns what happened.
   */
  const play = useCallback(
    (action) => {
      const s = g.current
      const win = s.window
      if (!win || s.phase !== 'live') return 'wait'
      const d = now() - win.tc
      if (d < -0.5) return 'early'
      cancel(win.missId)
      s.window = null
      if (Math.abs(d) > win.w) {
        f.youMiss(d < 0 ? 'awal' : 'lambat')
        return 'miss'
      }
      s.lastQuality = { perfect: Math.abs(d) <= PERFECT, key: Math.random() }
      animate(TEAM_YOU, 0, action === 'timang' ? 'lutut' : 'sila')
      f.apply(0, action, true)
      return 'ok'
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancel, f],
  )

  /** Skip the rest of Geng Pak-pak's turn (worked out instantly). */
  const skip = useCallback(() => {
    const s = g.current
    if (s.team !== TEAM_THEM || s.phase === 'done' || s.phase === 'turnEnd') return
    clearAll()
    const skill = tune(s.level).them
    let gained = 0
    let left = s.timeLeft
    let lamb = s.lambungan
    // the lambungan in play now (already-scored points stay)
    if (!s.rally.dead && !s.rally.serving && s.phase === 'live') {
      const r = simulateRally(skill, Math.random, left, s.rally)
      gained += r.points - s.rally.points
      left -= r.seconds
    }
    else if (s.phase === 'serve' || s.rally.serving) lamb -= 1
    while (lamb < LAMBUNGAN && left > 0) {
      lamb += 1
      const r = simulateRally(skill, Math.random, left)
      gained += r.points
      left -= r.seconds
    }
    s.scores[TEAM_THEM] += gained
    s.seconds[TEAM_THEM] += s.timeLeft - Math.max(0, left)
    s.timeLeft = Math.max(0, left)
    s.lambungan = LAMBUNGAN
    banner(`Geng Pak-pak dapat ${gained} mata lagi.`, 'them')
    f.endTurn()
  }, [banner, clearAll, f])

  const s = g.current
  const yourBall = s.team === TEAM_YOU && s.phase === 'live' && Boolean(s.window)
  return {
    g,
    state: s,
    yourTurn: s.team === TEAM_YOU && s.phase !== 'done',
    yourBall,
    // your passes (you are player 1): across the circle to players 3 and 4
    legal: s.team === TEAM_YOU ? legalTargets({ ...s.rally, holder: 0, serving: false }) : [],
    serveTo,
    play,
    skip,
  }
}
