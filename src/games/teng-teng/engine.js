/**
 * Teng-teng (ting-ting, ketinting), after the Malay rules (Warisan Melayu,
 * NLB Infopedia):
 *
 * - 9 petak drawn on the ground, "kapal terbang" shape:
 *     row 0: 1   row 1: 2   row 2: 3   row 3: 4 | 5   row 4: 6   row 5: 7 | 8   row 6: 9 (kepala)
 * - Stand at the start line with your back to the court and toss the gundu
 *   into the petak you're on (1, then 2, … 9). Missing it, or landing on a
 *   line, ends your turn.
 * - Hop one-footed through the single petak, two feet in the side-by-side
 *   pairs and in the kepala (9). Never step on a petak with a gundu in it, or
 *   on someone else's rumah: jump over it. Stepping on a line ends your turn.
 * - Coming back, stop before your gundu, pick it up, hop through and out.
 *   Then aim for the next petak.
 * - After all 9: timbang. Gundu on your head, hop through the court; at the
 *   end tip it off and catch it before it touches the ground.
 * - Then throw it blind (back to the court): the free petak it lands in is your
 *   rumah. Only you may stand in it, with both feet; others jump over it.
 * - Most rumah wins. (The full game runs until the court is full; we play to a
 *   set number of rumah to keep it short.)
 */

export const PETAK = [
  { id: 1, row: 0, col: 0 },
  { id: 2, row: 1, col: 0 },
  { id: 3, row: 2, col: 0 },
  { id: 4, row: 3, col: -1 },
  { id: 5, row: 3, col: 1 },
  { id: 6, row: 4, col: 0 },
  { id: 7, row: 5, col: -1 },
  { id: 8, row: 5, col: 1 },
  { id: 9, row: 6, col: 0, kepala: true },
]
export const ROWS = 7
export const SIZE = 0.62 // petak size, metres
export const LINE = 0.05 // a gundu this close to a line is "kena garisan"
export const START_GAP = 0.45 // start line to the near edge of petak 1

export const YOU = 0
export const THEM = 1

const byId = Object.fromEntries(PETAK.map((p) => [p.id, p]))
export const petak = (id) => byId[id]
export const rowOf = (row) => PETAK.filter((p) => p.row === row)

/** Centre of a petak on the ground; z runs away from the start line (negative). */
export function centreOf(id) {
  const p = byId[id]
  const x = p.col * (SIZE / 2)
  const z = -(START_GAP + SIZE / 2 + p.row * SIZE) - (p.kepala ? SIZE * 0.15 : 0)
  return [x, z]
}
export const halfOf = (id) => (byId[id].kepala ? [SIZE * 0.6, SIZE * 0.65] : [SIZE / 2, SIZE / 2])

/** Which petak a point is in, and whether it touches a line. Null if outside. */
export function landOn(x, z) {
  for (const p of PETAK) {
    const [cx, cz] = centreOf(p.id)
    const [hx, hz] = halfOf(p.id)
    const dx = Math.abs(x - cx)
    const dz = Math.abs(z - cz)
    if (dx <= hx && dz <= hz) return { id: p.id, onLine: hx - dx < LINE || hz - dz < LINE }
  }
  return null
}

/** Distance along the court (from the start line) of a petak's centre. */
export const reachOf = (id) => -centreOf(id)[1]
export const COURT_LENGTH = START_GAP + ROWS * SIZE + SIZE * 0.3

// ------------------------------------------------------------------ state
export function newGame(goal = 2) {
  return {
    goal,
    turn: YOU,
    players: [0, 1].map(() => ({ target: 1, stage: 'petak' })), // stage: petak | timbang | rumah
    houses: {}, // petak id -> player
    gundu: null, // { id } where the current player's gundu lies this turn
    winner: null,
  }
}

export const housesOf = (g, who) => Object.values(g.houses).filter((h) => h === who).length
export const freePetak = (g) => PETAK.filter((p) => g.houses[p.id] === undefined).map((p) => p.id)

/**
 * How a petak may be used by `who` this hop: 'free' (stand on it), 'own'
 * (your rumah: both feet allowed), 'blocked' (a gundu or someone else's rumah).
 */
export function petakUse(g, who, id, gunduAt) {
  if (gunduAt === id) return 'blocked'
  const owner = g.houses[id]
  if (owner === undefined) return 'free'
  return owner === who ? 'own' : 'blocked'
}

/**
 * The moves for a trip up the court and back. Each move is
 * { kind: 'sebelah' | 'dua' | 'langkau', land: [petak ids], row }
 * ('langkau' = jump over blocked rows; it lands in the next usable row).
 * `pickAt`: the move after which you bend to pick the gundu up (return trip).
 */
export function route(g, who, gunduAt) {
  const gRow = gunduAt ? petak(gunduAt).row : -1
  const rowMove = (row, gundu) => {
    const cells = rowOf(row).map((p) => ({ id: p.id, use: petakUse(g, who, p.id, gundu) }))
    const usable = cells.filter((c) => c.use !== 'blocked')
    if (!usable.length) return null
    const own = usable.find((c) => c.use === 'own')
    if (own) return { kind: 'dua', land: [own.id], row }
    if (rowOf(row)[0].kepala || (cells.length === 2 && usable.length === 2)) return { kind: 'dua', land: usable.map((c) => c.id), row }
    return { kind: 'sebelah', land: [usable[0].id], row }
  }
  const moves = []
  let skipped = false
  const push = (m) => {
    if (!m) {
      skipped = true
      return
    }
    moves.push(skipped ? { ...m, kind: 'langkau', foot: m.kind } : m)
    skipped = false
  }
  for (let row = 0; row < ROWS; row++) push(rowMove(row, gunduAt))
  const turnAt = moves.length - 1
  // coming back: stop on the row before the gundu, pick it up, then its petak is free
  let pickAt = gRow >= moves[turnAt].row ? turnAt : null
  skipped = false
  for (let row = moves[turnAt].row - 1; row >= 0; row--) {
    if (pickAt === null && row === gRow) pickAt = moves.length - 1
    push(rowMove(row, pickAt === null ? gunduAt : null))
  }
  return { moves, turnAt, pickAt }
}

/** Where a throw at distance `reach` (from the start line) with sideways `side` lands. */
export function throwLanding(reach, side) {
  return landOn(side, -reach)
}

/** Result of a throw for the current stage. */
export function judgeThrow(g, who, landing) {
  const pl = g.players[who]
  if (!landing) return { ok: false, why: 'keluar' }
  if (landing.onLine) return { ok: false, why: 'garisan' }
  if (pl.stage === 'rumah') {
    if (g.houses[landing.id] !== undefined) return { ok: false, why: 'berpunya' }
    return { ok: true, id: landing.id }
  }
  if (landing.id !== pl.target) return { ok: false, why: 'salah-petak', id: landing.id }
  return { ok: true, id: landing.id }
}

export const WHY = {
  keluar: 'Gundu terkeluar dari petak.',
  garisan: 'Gundu kena garisan!',
  'salah-petak': 'Gundu masuk petak yang salah.',
  berpunya: 'Petak tu dah ada tuan.',
  pijak: 'Terpijak garisan!',
  'kaki-salah': 'Salah kaki!',
  'pijak-gundu': 'Tak boleh pijak petak yang ada gundu!',
  'pijak-rumah': 'Tak boleh pijak rumah orang!',
  ambil: 'Tak sempat ambil gundu.',
  jatuh: 'Gundu jatuh dari kepala!',
  sambut: 'Tak sempat sambut gundu.',
}

/** A round (trip) completed: move the player on. Returns the new game. */
export function finishRound(g, who) {
  const players = g.players.map((p) => ({ ...p }))
  const pl = players[who]
  if (pl.stage === 'petak') {
    if (pl.target >= 9) pl.stage = 'timbang'
    else pl.target += 1
  } else if (pl.stage === 'timbang') pl.stage = 'rumah'
  return { ...g, players }
}

/** A rumah claimed. */
export function claimHouse(g, who, id) {
  const houses = { ...g.houses, [id]: who }
  const players = g.players.map((p, i) => (i === who ? { target: 1, stage: 'petak' } : { ...p }))
  // a player whose next target became someone's rumah aims for the next free one
  players.forEach((p, i) => {
    while (p.stage === 'petak' && houses[p.target] !== undefined && houses[p.target] !== i && p.target < 9) p.target += 1
    if (p.stage === 'petak' && houses[p.target] !== undefined && houses[p.target] !== i) p.stage = 'timbang'
  })
  const next = { ...g, houses, players }
  const mine = housesOf(next, who)
  if (mine >= g.goal) next.winner = who
  else if (!freePetak(next).length) {
    const a = housesOf(next, YOU)
    const b = housesOf(next, THEM)
    next.winner = a === b ? null : a > b ? YOU : THEM
    next.over = true
  }
  return next
}

export const nextTurn = (g) => ({ ...g, turn: 1 - g.turn, gundu: null })

// ------------------------------------------------------------------ the AI
export const AI = {
  mudah: { aim: 0.2, hop: 0.975, pick: 0.95, timbang: 0.72 },
  biasa: { aim: 0.13, hop: 0.985, pick: 0.97, timbang: 0.82 },
  pakar: { aim: 0.08, hop: 0.993, pick: 0.985, timbang: 0.92 },
}

/** Your timing window (seconds either side) and the ring time per hop. */
export const TIMING = {
  mudah: { w: 0.2, beat: 0.8, aimNoise: 0.06 },
  biasa: { w: 0.15, beat: 0.64, aimNoise: 0.09 },
  pakar: { w: 0.11, beat: 0.54, aimNoise: 0.12 },
}

/** Gaussian-ish noise. */
export const jitter = (random, s) => (random() + random() + random() - 1.5) * s * 1.15
