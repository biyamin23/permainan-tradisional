/**
 * Congkak rules engine — pure functions, no React. The rules are the usual
 * kampung ones (ms.wikipedia.org/wiki/Congkak, "Peraturan permainan").
 *
 * Board: 16 positions in sowing order.
 *   0–6   player's kampung (small houses)    7  player's rumah (store)
 *   8–14  opponent's kampung                 15 opponent's rumah
 * Seeds travel 0 → 1 → … → 7 → 8 → … → 15 → 0 (right to left along your own
 * row, into your rumah, then along the other row). Each side skips the other
 * side's rumah, and everyone skips a kampung that has been terbakar.
 *
 * A pusingan (round):
 *  1. Both players start TOGETHER: each takes the seeds of one of their own
 *     kampung and sows at the same time (startTogether / tickTogether).
 *     Each hand goes on its own; reach your rumah and you pick up another
 *     kampung straight away, without waiting for the other hand.
 *  2. Last seed in your own rumah → you carry on with any kampung of yours.
 *     Last seed in a kampung that already had seeds → take them all and keep
 *     sowing. Last seed in an empty kampung → mati: your go ends there. If it
 *     is one of your own and your seeds have already been round through the
 *     other side this go, you tembak: it and everything in the kampung across
 *     go into your rumah.
 *  3. After the start, turns alternate, each lasting until the seeds die.
 *  4. No seeds in your kampung on your turn: the turn passes to the other side.
 *  The pusingan ends when no kampung has any seeds left.
 *
 * Next pusingan: each player fills their kampung again, 7 seeds each, from
 * the seeds in their rumah. A kampung that can't be filled is terbakar and
 * sits out the rest of the game. A player who can't fill even one has lost.
 * At the end, most seeds in the rumah wins; level, and whoever has more
 * kampung terbakar loses.
 */

export const SEEDS_PER_HOUSE = 7
export const PLAYER = 0
export const OPPONENT = 1
export const STORE = [7, 15]
export const MAX_ROUNDS = 3
const SIZE = 16
const MAX_LAPS = 400 // guards against endless relay chains

export const housesOf = (side) => (side === PLAYER ? [0, 1, 2, 3, 4, 5, 6] : [8, 9, 10, 11, 12, 13, 14])
export const sideOf = (index) => (index <= 7 ? PLAYER : OPPONENT)
export const isStore = (index) => index === 7 || index === 15
/** House directly across the board. */
export const oppositeOf = (index) => 14 - index

const NONE_BURNT = new Array(SIZE).fill(false)

export function createBoard() {
  const pits = new Array(SIZE).fill(SEEDS_PER_HOUSE)
  pits[7] = 0
  pits[15] = 0
  return pits
}

export const createBurnt = () => new Array(SIZE).fill(false)

export const legalMoves = (pits, side, burnt = NONE_BURNT) => housesOf(side).filter((i) => !burnt[i] && pits[i] > 0)

const next = (index, side, burnt) => {
  let n = index
  do {
    n = (n + 1) % SIZE
  } while (n === STORE[1 - side] || burnt[n])
  return n
}

/**
 * One sowing hand, stepped a seed at a time, so a single go (playMove) and the
 * two hands of the live start (tickTogether) follow exactly the same rules.
 */
function startHand(pits, side, house) {
  const hand = pits[house]
  pits[house] = 0
  return { side, pos: house, hand, laps: 0, wentRound: false, done: false, inStore: false }
}

/** Drop one seed; when the hand runs out, decide what happens. Pushes events. */
function stepHand(pits, h, burnt, events, t) {
  h.pos = next(h.pos, h.side, burnt)
  pits[h.pos] += 1
  h.hand -= 1
  if (!isStore(h.pos) && sideOf(h.pos) !== h.side) h.wentRound = true
  events.push({ type: 'drop', pit: h.pos, hand: h.hand, side: h.side, t })
  if (h.hand > 0) return

  // the last seed of this handful
  if (h.pos === STORE[h.side]) {
    h.done = true
    h.inStore = true
    events.push({ type: 'extraTurn', side: h.side, t })
    return
  }
  if (pits[h.pos] > 1) {
    h.laps += 1
    if (h.laps > MAX_LAPS) {
      h.done = true
      events.push({ type: 'end', side: h.side, t })
      return
    }
    h.hand = pits[h.pos]
    pits[h.pos] = 0
    events.push({ type: 'relay', pit: h.pos, count: h.hand, side: h.side, t })
    return
  }
  // landed in an empty kampung: mati
  if (sideOf(h.pos) === h.side) {
    const opposite = oppositeOf(h.pos)
    if (pits[opposite] > 0 && !h.wentRound) {
      events.push({ type: 'noTembak', pit: h.pos, opposite, side: h.side, t })
    } else if (pits[opposite] > 0) {
      const count = pits[opposite] + 1
      pits[STORE[h.side]] += count
      events.push({ type: 'capture', pit: h.pos, opposite, count, store: STORE[h.side], side: h.side, t })
      pits[opposite] = 0
      pits[h.pos] = 0
    }
  }
  h.done = true
  events.push({ type: 'end', side: h.side, t })
}

/**
 * Play one go. Returns the board after it, the events that happened (for
 * animation) and whether the same side carries on (last seed in its rumah).
 * Events: pickup {pit,count} · drop {pit} · relay {pit,count} · capture {pit,opposite,count,store}
 *         · noTembak · extraTurn · end. Each has `side` and a tick `t`.
 */
export function playMove(board, side, house, burnt = NONE_BURNT) {
  const pits = board.slice()
  if (sideOf(house) !== side || isStore(house) || burnt[house] || pits[house] === 0) {
    throw new Error(`Illegal move ${house} for side ${side}`)
  }
  const events = []
  const h = startHand(pits, side, house)
  let t = 0
  events.push({ type: 'pickup', pit: house, count: h.hand, side, t })
  while (!h.done) stepHand(pits, h, burnt, events, ++t)
  return { pits, events, extraTurn: h.inStore }
}

/**
 * The start of every pusingan, played live: both players sow at once, one
 * seed each per tick (tickTogether), each hand following the rules on its
 * own. A hand that reaches its rumah leaves its side free to pick another
 * kampung (pickTogether) at once, while the other hand keeps going. A side
 * is out when its seeds die (or it reaches its rumah with nothing left to
 * pick). When both are out, whoever died first has the next go
 * (firstAfterTogether), as the other has just had the longer go.
 *
 * live: { pits, burnt, hands: [hand|null, hand|null], state: ['sow'|'pick'|'dead', …], diedAt, t }
 * Mutated in place; each call returns the events it caused.
 */
export function startTogether(board, burnt, housePlayer, houseOpponent) {
  const live = { pits: board.slice(), burnt, hands: [null, null], state: ['pick', 'pick'], diedAt: [Infinity, Infinity], t: 0 }
  const events = [...pickTogether(live, PLAYER, housePlayer), ...pickTogether(live, OPPONENT, houseOpponent)]
  return { live, events }
}

/** A side that is free to pick (start, or back in its rumah) takes up another kampung. */
export function pickTogether(live, side, house) {
  const { pits, burnt } = live
  if (live.state[side] !== 'pick' || sideOf(house) !== side || isStore(house) || burnt[house] || pits[house] === 0) {
    throw new Error(`Illegal pick ${house} for side ${side}`)
  }
  live.hands[side] = startHand(pits, side, house)
  live.state[side] = 'sow'
  return [{ type: 'pickup', pit: house, count: live.hands[side].hand, side, t: live.t }]
}

/** One tick: every hand still sowing drops a seed. */
export function tickTogether(live) {
  live.t += 1
  const events = []
  for (const side of [PLAYER, OPPONENT]) {
    const h = live.hands[side]
    if (!h) continue
    stepHand(live.pits, h, live.burnt, events, live.t)
    if (!h.done) continue
    live.hands[side] = null
    live.state[side] = h.inStore ? 'pick' : 'dead'
    if (!h.inStore) live.diedAt[side] = live.t
  }
  // back in the rumah with nothing left to pick up: out as well
  for (const side of [PLAYER, OPPONENT]) {
    if (live.state[side] === 'pick' && legalMoves(live.pits, side, live.burnt).length === 0) {
      live.state[side] = 'dead'
      live.diedAt[side] = live.t
    }
  }
  return events
}

export const togetherOver = (live) => live.state.every((s) => s === 'dead')
export const firstAfterTogether = (live) => (live.diedAt[PLAYER] <= live.diedAt[OPPONENT] ? PLAYER : OPPONENT)

/** Seeds left in any kampung? */
export const seedsInPlay = (pits) => [...housesOf(PLAYER), ...housesOf(OPPONENT)].reduce((a, i) => a + pits[i], 0)

/**
 * Who moves after `side`'s go: the same side if it carries on, else the
 * other; a side with no seeds in its kampung passes. Null: the pusingan is
 * over (no seeds left in any kampung).
 */
export function nextToMove(pits, burnt, side, carriesOn) {
  if (seedsInPlay(pits) === 0) return null
  const first = carriesOn ? side : 1 - side
  if (legalMoves(pits, first, burnt).length) return first
  if (legalMoves(pits, 1 - first, burnt).length) return 1 - first
  return null
}

/**
 * End a pusingan: anything still in a kampung goes to its owner's rumah
 * (only used if a pusingan is cut short), then each side refills its
 * kampung from its rumah, 7 to each, starting from the one furthest from
 * its rumah. Kampung left empty are terbakar (and stay so). A side that
 * can't fill a single kampung has lost (`conceded`).
 */
export function nextRound(board, burnt) {
  const pits = board.slice()
  for (const side of [PLAYER, OPPONENT]) {
    for (const i of housesOf(side)) {
      pits[STORE[side]] += pits[i]
      pits[i] = 0
    }
  }
  const scores = [pits[STORE[PLAYER]], pits[STORE[OPPONENT]]]
  const conceded = [PLAYER, OPPONENT].filter((s) => scores[s] < SEEDS_PER_HOUSE)
  if (conceded.length) return { pits, burnt, conceded, scores }
  const nextBurnt = burnt.slice()
  for (const side of [PLAYER, OPPONENT]) {
    let left = pits[STORE[side]]
    for (const i of housesOf(side)) {
      if (!nextBurnt[i] && left >= SEEDS_PER_HOUSE) {
        pits[i] = SEEDS_PER_HOUSE
        left -= SEEDS_PER_HOUSE
      } else nextBurnt[i] = true
    }
    pits[STORE[side]] = left
  }
  return { pits, burnt: nextBurnt, conceded: [], scores }
}

export const burntCount = (burnt, side) => housesOf(side).filter((i) => burnt[i]).length

/**
 * The final count: seeds in each rumah (anything left in a kampung goes to
 * its owner). Level, and the side with more kampung terbakar loses.
 */
export function finalResult(board, burnt, rounds) {
  const pits = board.slice()
  for (const side of [PLAYER, OPPONENT]) {
    for (const i of housesOf(side)) {
      pits[STORE[side]] += pits[i]
      pits[i] = 0
    }
  }
  const scores = [pits[STORE[PLAYER]], pits[STORE[OPPONENT]]]
  const burntBy = [burntCount(burnt, PLAYER), burntCount(burnt, OPPONENT)]
  let winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? PLAYER : OPPONENT
  let tieBreak = false
  if (winner === null && burntBy[0] !== burntBy[1]) {
    winner = burntBy[0] < burntBy[1] ? PLAYER : OPPONENT
    tieBreak = true
  }
  return { pits, scores, burnt: burntBy, rounds, winner, tieBreak }
}

// ------------------------------------------------------------------ AI
const storeDiff = (pits, side) => pits[STORE[side]] - pits[STORE[1 - side]]

const LEGACY = {
  mudah: { mistake: 0.65, plies: 1, guard: 0 },
  biasa: { mistake: 0, plies: 1, guard: 0 },
  pakar: { mistake: 0, plies: 2, guard: 0.5 },
}

const seedsOn = (pits, side) => housesOf(side).reduce((a, i) => a + pits[i], 0)

/** How good a position is for `side`: rumah difference, plus (if she thinks about it) guli kept on her side. */
function evaluate(pits, side, guard) {
  return storeDiff(pits, side) + guard * 0.2 * (seedsOn(pits, side) - seedsOn(pits, 1 - side))
}

/**
 * Look `plies` turns ahead (her turn, your reply, …), following carry-ons
 * within the same ply. Same rules and the same board you see: no peeking,
 * no special moves. Stops when the time budget runs out.
 */
function search(pits, side, burnt, plies, guard, clock, chain = 0) {
  if (++clock.nodes % 256 === 0 && performance.now() > clock.deadline) clock.timeout = true
  if (clock.timeout) return evaluate(pits, side, guard)
  const moves = legalMoves(pits, side, burnt)
  // nothing to play: the turn passes (or the pusingan is over)
  if (moves.length === 0) return evaluate(pits, side, guard)
  let best = -Infinity
  for (const move of moves) {
    const r = playMove(pits, side, move, burnt)
    let v
    if (r.extraTurn && chain < 2) v = search(r.pits, side, burnt, plies, guard, clock, chain + 1) + 1
    else if (plies <= 1) v = evaluate(r.pits, side, guard)
    else v = -search(r.pits, 1 - side, burnt, plies - 1, guard, clock, 0)
    if (v > best) best = v
  }
  return best
}

const THINK_BUDGET_MS = 250

/**
 * Choose a move for `side`. `level` is the tuning from progression
 * ({ mistake, plies, guard }), or an old level name.
 *  mistake  chance she just picks any pit (an understandable slip)
 *  plies    turns she looks ahead: 1 = best for this turn, 2+ = considers your replies
 *  guard    0..1 how much she cares about the guli she leaves on each side
 * Deeper looks are tried one at a time and kept only if they finish in time.
 * (For the opening she picks the same way, as if sowing alone: she can't see
 * which kampung you'll take either.)
 */
export function chooseMove(pits, side, level = 'biasa', random = Math.random, burnt = NONE_BURNT) {
  const cfg = typeof level === 'string' ? LEGACY[level] ?? LEGACY.biasa : level
  const moves = legalMoves(pits, side, burnt)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]
  if (random() < (cfg.mistake ?? 0)) return moves[Math.floor(random() * moves.length)]
  const guard = cfg.guard ?? 0
  const clock = { deadline: performance.now() + THINK_BUDGET_MS, nodes: 0, timeout: false }
  let chosen = moves
  for (let plies = 1; plies <= (cfg.plies ?? 1); plies++) {
    let best = -Infinity
    let bestMoves = []
    for (const move of moves) {
      const r = playMove(pits, side, move, burnt)
      let v
      if (r.extraTurn) v = search(r.pits, side, burnt, plies, guard, clock, 1) + 1
      else if (plies <= 1) v = evaluate(r.pits, side, guard)
      else v = -search(r.pits, 1 - side, burnt, plies - 1, guard, clock)
      if (v > best + 0.25) {
        best = v
        bestMoves = [move]
      } else if (Math.abs(v - best) <= 0.25) bestMoves.push(move)
    }
    if (clock.timeout && plies > 1) break
    chosen = bestMoves
  }
  return chosen[Math.floor(random() * chosen.length)]
}
