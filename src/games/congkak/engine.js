/**
 * Congkak rules engine — pure functions, no React.
 *
 * Board: 16 positions in sowing order.
 *   0–6   player's kampung (small houses)    7  player's rumah (store)
 *   8–14  opponent's kampung                 15 opponent's rumah
 * Seeds travel 0 → 1 → … → 7 → 8 → … → 15 → 0. Each side skips the
 * other side's rumah. Every small house starts with 7 seeds (98 in total).
 *
 * A turn:
 *  1. Pick a house on your side that has seeds; sow them one by one.
 *  2. Last seed in your own rumah → you get another turn.
 *  3. Last seed in a house that already had seeds → pick them all up and
 *     keep sowing ("main terus").
 *  4. Last seed in an empty house on your side → "tembak": take it and the
 *     seeds in the opposite house into your rumah. Turn ends. As in the
 *     official rules ("tikam hanya boleh dibuat selepas melalui kampung
 *     lawan" / only after one full pusingan), you may only tembak when, in
 *     this same turn, your seeds have gone round through the opponent's
 *     kampung and come back to your side. Otherwise the turn simply ends
 *     (mati) and the seed stays where it fell.
 *  5. Last seed in an empty house on the other side → turn ends.
 * The game ends when the player to move has no seeds in their kampung; the
 * other player then collects everything left on their side. Most seeds wins.
 */

export const SEEDS_PER_HOUSE = 7
export const PLAYER = 0
export const OPPONENT = 1
export const STORE = [7, 15]
const SIZE = 16
const MAX_LAPS = 400 // guards against endless relay chains

export const housesOf = (side) => (side === PLAYER ? [0, 1, 2, 3, 4, 5, 6] : [8, 9, 10, 11, 12, 13, 14])
export const sideOf = (index) => (index <= 7 ? PLAYER : OPPONENT)
export const isStore = (index) => index === 7 || index === 15
/** House directly across the board. */
export const oppositeOf = (index) => 14 - index

export function createBoard() {
  const pits = new Array(SIZE).fill(SEEDS_PER_HOUSE)
  pits[7] = 0
  pits[15] = 0
  return pits
}

export const legalMoves = (pits, side) => housesOf(side).filter((i) => pits[i] > 0)

const next = (index, side) => {
  let n = (index + 1) % SIZE
  if (n === STORE[1 - side]) n = (n + 1) % SIZE
  return n
}

/**
 * Play one move. Returns the board after the turn, the events that happened
 * (for animation) and whether the same side moves again.
 * Events: pickup {pit,count} · drop {pit} · relay {pit,count} · capture {pit,opposite,count,store}
 *         · extraTurn · end
 */
export function playMove(board, side, house) {
  const pits = board.slice()
  const events = []
  if (sideOf(house) !== side || isStore(house) || pits[house] === 0) {
    throw new Error(`Illegal move ${house} for side ${side}`)
  }

  let hand = pits[house]
  pits[house] = 0
  events.push({ type: 'pickup', pit: house, count: hand })
  let pos = house
  let laps = 0
  let extraTurn = false
  let passedStore = false
  let wentRound = false // a seed went into the opponent's kampung this turn

  while (hand > 0) {
    pos = next(pos, side)
    pits[pos] += 1
    hand -= 1
    if (pos === STORE[side]) passedStore = true
    if (!isStore(pos) && sideOf(pos) !== side) wentRound = true
    events.push({ type: 'drop', pit: pos, hand })
    if (hand > 0) continue

    // last seed of this handful
    if (pos === STORE[side]) {
      extraTurn = true
      events.push({ type: 'extraTurn' })
      break
    }
    if (pits[pos] > 1) {
      laps += 1
      if (laps > MAX_LAPS) {
        events.push({ type: 'end' })
        break
      }
      hand = pits[pos]
      pits[pos] = 0
      events.push({ type: 'relay', pit: pos, count: hand })
      continue
    }
    // landed in an empty house
    if (sideOf(pos) === side) {
      const opposite = oppositeOf(pos)
      if (pits[opposite] > 0 && !wentRound) {
        events.push({ type: 'noTembak', pit: pos, opposite })
      } else if (pits[opposite] > 0) {
        const count = pits[opposite] + 1
        pits[STORE[side]] += count
        events.push({ type: 'capture', pit: pos, opposite, count, store: STORE[side] })
        pits[opposite] = 0
        pits[pos] = 0
      }
    }
    events.push({ type: 'end' })
  }

  return { pits, events, extraTurn, passedStore }
}

/**
 * If the side about to move has nothing to play, the game is over: the other
 * side sweeps its remaining seeds into its rumah.
 */
export function checkGameOver(pits, sideToMove) {
  if (legalMoves(pits, sideToMove).length > 0) return null
  const final = pits.slice()
  const other = 1 - sideToMove
  let swept = 0
  for (const i of housesOf(other)) {
    swept += final[i]
    final[i] = 0
  }
  final[STORE[other]] += swept
  const player = final[STORE[PLAYER]]
  const opponent = final[STORE[OPPONENT]]
  return {
    pits: final,
    swept,
    sweptBy: other,
    scores: [player, opponent],
    winner: player === opponent ? null : player > opponent ? PLAYER : OPPONENT,
  }
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
 * Look `plies` turns ahead (her turn, your reply, …), following extra turns
 * within the same ply. Same rules and the same board you see: no peeking,
 * no special moves. Stops when the time budget runs out.
 */
function search(pits, side, plies, guard, clock, chain = 0) {
  if (++clock.nodes % 256 === 0 && performance.now() > clock.deadline) clock.timeout = true
  if (clock.timeout) return evaluate(pits, side, guard)
  const moves = legalMoves(pits, side)
  if (moves.length === 0) {
    const over = checkGameOver(pits, side)
    return (over.scores[side] - over.scores[1 - side]) * 10 // a finished game is decisive
  }
  let best = -Infinity
  for (const move of moves) {
    const r = playMove(pits, side, move)
    let v
    if (r.extraTurn && chain < 2) v = search(r.pits, side, plies, guard, clock, chain + 1) + 1
    else if (plies <= 1) v = evaluate(r.pits, side, guard)
    else v = -search(r.pits, 1 - side, plies - 1, guard, clock, 0)
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
 */
export function chooseMove(pits, side, level = 'biasa', random = Math.random) {
  const cfg = typeof level === 'string' ? LEGACY[level] ?? LEGACY.biasa : level
  const moves = legalMoves(pits, side)
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
      const r = playMove(pits, side, move)
      let v
      if (r.extraTurn) v = search(r.pits, side, plies, guard, clock, 1) + 1
      else if (plies <= 1) v = evaluate(r.pits, side, guard)
      else v = -search(r.pits, 1 - side, plies - 1, guard, clock)
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
