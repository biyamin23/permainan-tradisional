/**
 * Sepak Raga Ratus (bulatan), after the JPVPK competition rules:
 *
 * - 5 players per team in a 6 m circle, numbered 1–5 clockwise, each keeping
 *   their place. A 2 m circle sits in the middle.
 * - Player 1 starts a lambungan by tossing the ball (by hand) to player 3, 4
 *   or 5. That first receiver may not pass back to player 1.
 * - Any part of the body except the hands and arms. One player may touch the
 *   ball at most 3 times in a row; the 3rd touch must go to a teammate.
 * - Every pass must cross the 2 m circle. In a 6 m circle of five, only the
 *   two players across from you can be reached that way (a pass to your
 *   neighbour passes 2.4 m from the middle, outside the small circle).
 * - Each completed pass (timbangan) scores 1 point.
 * - Every player must touch the ball at least once in every 20 points.
 * - The ball is dead when it falls, a player touches it a 4th time, or a pass
 *   doesn't cross the small circle.
 * - 3 rounds; each team gets 3 lambungan per round (and a time limit).
 *   Most points over the 3 rounds wins; level on points, the team that kept
 *   the ball up longer wins.
 *
 * Indices here are 0–4 (player 1 is index 0).
 */

export const PLAYERS = 5
export const MAX_TOUCHES = 3
export const LAMBUNGAN = 3
export const ROUNDS = 3
export const TOUCH_CHECK = 20
export const SERVER = 0
/** The official round is 10 minutes; ours is shortened to keep it snappy. */
export const TURN_SECONDS = 90

export const TEAM_YOU = 0
export const TEAM_THEM = 1

const mod = (n) => ((n % PLAYERS) + PLAYERS) % PLAYERS

/** True when a pass from `a` to `b` crosses the 2 m circle (not a neighbour). */
export const crossesMiddle = (a, b) => {
  const d = mod(b - a)
  return d === 2 || d === 3
}

/** Who the server may toss to: players 3, 4 and 5. */
export const SERVE_TARGETS = [2, 3, 4]

/** A fresh lambungan: the server holds the ball. */
export function newRally(touchedSince = null) {
  return {
    holder: SERVER,
    serving: true, // the server still has the ball in hand
    touches: 0, // touches in a row by the holder
    firstReceiver: null, // who took the serve (may not pass back to the server)
    points: 0,
    touchedSince: touchedSince ?? Array(PLAYERS).fill(0), // touches since the last 20-point check
    dead: null,
  }
}

/** Players the holder may pass to now. */
export function legalTargets(r) {
  if (r.serving) return SERVE_TARGETS
  const out = [mod(r.holder + 2), mod(r.holder + 3)]
  return r.holder === r.firstReceiver ? out.filter((t) => t !== SERVER) : out
}

/** The server tosses the ball to `to` (a hand toss: not a touch, no point). */
export function serve(r, to) {
  if (!r.serving || !SERVE_TARGETS.includes(to)) return { ...r, dead: 'serve' }
  return { ...r, serving: false, holder: to, touches: 0, firstReceiver: to, incoming: 'serve' }
}

/**
 * The holder plays the ball: `action` is 'timang' (keep it, up in the air)
 * or a teammate index to pass to. `ok` says whether the touch was clean
 * (false: the ball fell). Returns the new rally (check `.dead`).
 */
export function touch(r, action, ok = true) {
  if (r.dead) return r
  const touchedSince = r.touchedSince.slice()
  if (!ok) return { ...r, dead: 'jatuh' }
  const touches = r.touches + 1
  touchedSince[r.holder] += 1
  if (action === 'timang') {
    if (touches >= MAX_TOUCHES) return { ...r, touchedSince, touches, dead: 'lebih' }
    return { ...r, touchedSince, touches, incoming: null }
  }
  if (!crossesMiddle(r.holder, action)) return { ...r, touchedSince, touches, dead: 'lintas' }
  if (r.holder === r.firstReceiver && action === SERVER) return { ...r, touchedSince, touches, dead: 'balik' }
  return { ...r, touchedSince, holder: action, touches: 0, incoming: 'pass', passFrom: r.holder }
}

/**
 * The receiver controls a pass cleanly: the pass counts as a timbangan.
 * Call after the receiver's first touch on an incoming pass succeeds.
 */
export function scorePass(r) {
  const points = r.points + 1
  if (points % TOUCH_CHECK !== 0) return { ...r, points }
  if (r.touchedSince.some((n) => n === 0)) return { ...r, points, dead: 'giliran' }
  return { ...r, points, touchedSince: Array(PLAYERS).fill(0) }
}

export const DEAD_REASON = {
  jatuh: 'Bola jatuh ke tanah.',
  lebih: 'Lebih 3 sentuhan!',
  lintas: 'Hantaran tak melintasi bulatan kecil.',
  balik: 'Penerima pertama tak boleh hantar balik kepada pemain 1.',
  giliran: 'Ada pemain belum sentuh bola dalam 20 mata.',
  masa: 'Masa tamat.',
  serve: 'Lambungan tak sah.',
}

// ---------------------------------------------------------------- the AI

/** Chance a touch is clean, per team and level. */
export const SKILL = {
  you: { mudah: 0.97, biasa: 0.96, pakar: 0.955 }, // your teammates (kampung kids)
  them: { mudah: 0.93, biasa: 0.958, pakar: 0.975 }, // Geng Pak-pak
}

/** Timing window (seconds either side of contact) for your own touches. */
export const TIMING = { mudah: 0.22, biasa: 0.16, pakar: 0.11 }
export const PERFECT = 0.06

/**
 * What an AI holder does with the ball. Spreads touches so nobody misses
 * the 20-point check, and (for your team) likes passing to you (index `favour`).
 */
export function aiAction(r, random = Math.random, favour = null) {
  // control first, sometimes a second timang, rarely a direct pass
  if (r.touches === 0 && random() < 0.82) return 'timang'
  if (r.touches === 1 && random() < 0.18) return 'timang'
  const targets = legalTargets(r)
  if (favour !== null && targets.includes(favour) && random() < 0.5) return favour
  const least = Math.min(...targets.map((t) => r.touchedSince[t]))
  const pool = targets.filter((t) => r.touchedSince[t] === least)
  return pool[Math.floor(random() * pool.length)]
}

/** Seconds a touch takes in play (ball in the air), for simulated turns. */
const AIR = { timang: 0.85, pass: 1.1, serve: 1.3 }

/**
 * Play out a whole lambungan for an all-AI team (used to skip the other
 * team's turn), or the rest of one already going (`start`).
 * Returns { points, seconds, reason } (points include `start.points`).
 */
export function simulateRally(skill, random = Math.random, timeLeft = Infinity, start = null) {
  let r = start && !start.serving && !start.dead ? start : newRally()
  let seconds = 0
  if (r.serving) {
    seconds = AIR.serve
    r = serve(r, SERVE_TARGETS[Math.floor(random() * 3)])
  }
  let guard = 0
  while (!r.dead && guard++ < 5000) {
    if (seconds >= timeLeft) return { points: r.points, seconds: timeLeft, reason: 'masa', touchedSince: r.touchedSince }
    const wasPass = r.incoming === 'pass' && r.touches === 0
    const ok = random() < skill
    const action = aiAction(r, random)
    r = touch(r, action, ok)
    if (r.dead) break
    if (wasPass) r = scorePass(r)
    seconds += action === 'timang' ? AIR.timang : AIR.pass
  }
  return { points: r.points, seconds, reason: r.dead, touchedSince: r.touchedSince }
}

/** Final result from both teams' totals. */
export function matchResult(points, seconds) {
  if (points[0] !== points[1]) return { winner: points[0] > points[1] ? TEAM_YOU : TEAM_THEM, tiebreak: false }
  if (Math.round(seconds[0]) !== Math.round(seconds[1])) return { winner: seconds[0] > seconds[1] ? TEAM_YOU : TEAM_THEM, tiebreak: true }
  return { winner: null, tiebreak: true }
}
