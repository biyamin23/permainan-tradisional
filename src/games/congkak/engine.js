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
 *     seeds in the opposite house into your rumah. Turn ends. You may only
 *     tembak once you've gone round at least once: a seed of yours must have
 *     passed through your own rumah (earlier in the game or earlier in this
 *     move). Before that, the seed just stays and the turn ends.
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
export function playMove(board, side, house, canTembak = true) {
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

  while (hand > 0) {
    pos = next(pos, side)
    pits[pos] += 1
    hand -= 1
    if (pos === STORE[side]) passedStore = true
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
      if (pits[opposite] > 0 && !(canTembak || passedStore)) {
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

/** Best result a side can reach this turn (follows extra turns greedily). */
function bestTurnValue(pits, side, depth, canTembak = true) {
  const moves = legalMoves(pits, side)
  if (moves.length === 0) return { value: storeDiff(pits, side), move: null }
  let best = { value: -Infinity, move: moves[0] }
  for (const move of moves) {
    const result = playMove(pits, side, move, canTembak)
    let value
    if (result.extraTurn && depth > 0) {
      value = bestTurnValue(result.pits, side, depth - 1, canTembak || result.passedStore).value
    } else {
      value = storeDiff(result.pits, side)
    }
    if (value > best.value) best = { value, move, pits: result.pits, extraTurn: result.extraTurn }
  }
  return best
}

/**
 * Choose a move for `side`.
 * mudah  — mostly random, sometimes greedy
 * biasa  — greedy: best store difference after its own turn
 * pakar  — looks one opponent reply ahead (minimax, 2 ply)
 */
export function chooseMove(pits, side, level = 'biasa', random = Math.random, lapped = [true, true]) {
  const moves = legalMoves(pits, side)
  if (moves.length === 0) return null
  if (level === 'mudah' && random() < 0.65) return moves[Math.floor(random() * moves.length)]
  if (level !== 'pakar') return bestTurnValue(pits, side, 3, lapped[side]).move

  let bestMove = moves[0]
  let bestValue = -Infinity
  for (const move of moves) {
    const result = playMove(pits, side, move, lapped[side])
    const mine = lapped[side] || result.passedStore
    let value
    if (result.extraTurn) {
      value = bestTurnValue(result.pits, side, 3, mine).value + 2 // extra turns are worth a little more
    } else {
      // the opponent replies with its best greedy turn
      const reply = bestTurnValue(result.pits, 1 - side, 2, lapped[1 - side])
      value = -reply.value
    }
    if (value > bestValue) {
      bestValue = value
      bestMove = move
    }
  }
  return bestMove
}
