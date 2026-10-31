import {
  MAX_ROUNDS,
  OPPONENT,
  PLAYER,
  createBoard,
  createBurnt,
  finalResult,
  nextRound,
  nextToMove,
  playMove,
} from './engine.js'

/**
 * Congkak against a friend. Each player sees their own row at the bottom, so
 * the board is stored as the host (seat 0) sees it; seat 1's view is the
 * same board turned round: position i ↔ (i + 8) % 16, and the two sides swap.
 * The same flip works both ways.
 *
 * What goes into the match record (in order):
 *   { type: 'together', round, pits, first }   the simultaneous start is over
 *        (sent by the host, who runs it): the board after it, and the seat
 *        whose seeds died first (they have the next go)
 *   { type: 'move', house }                    one go by the seat that sent it
 * Refilling between pusingan and the end of the match follow from these, the
 * same way on both screens.
 */

export const MAX_TURNS = 300 // a pusingan that somehow never ends is called after this

/** Position as `seat` sees it ↔ as the host sees it (same flip both ways). */
export const flipPos = (seat, i) => (seat === 0 ? i : (i + 8) % 16)
export const flipBoard = (seat, arr) => (seat === 0 ? arr.slice() : arr.map((_, i) => arr[(i + 8) % 16]))
/** Seat in the match ↔ side on this screen (PLAYER is always you). */
export const sideOfSeat = (seat, s) => (s === seat ? PLAYER : OPPONENT)
export const seatOfSide = (seat, side) => (side === PLAYER ? seat : 1 - seat)

/**
 * After a go by `side` (carrying on or not): whose go next, or the end of the
 * pusingan (refill, or the end of the match). Mirrors what the match screen
 * does after every go.
 */
export function afterGo(state, side, carriesOn) {
  const s = { ...state, turns: state.turns + 1 }
  const next = s.turns > MAX_TURNS ? null : nextToMove(s.pits, s.burnt, side, carriesOn)
  if (next !== null) return { ...s, phase: 'play', turn: next }
  if (s.round >= MAX_ROUNDS) return { ...s, phase: 'over', result: finalResult(s.pits, s.burnt, s.round) }
  const nr = nextRound(s.pits, s.burnt)
  if (nr.conceded.length) return { ...s, phase: 'over', result: finalResult(nr.pits, s.burnt, s.round) }
  return { ...s, pits: nr.pits, burnt: nr.burnt, round: s.round + 1, phase: 'opening', turn: null, turns: 0 }
}

export const startState = () => ({ pits: createBoard(), burnt: createBurnt(), round: 1, phase: 'opening', turn: null, turns: 0, result: null })

/** Apply one record entry (from `entry.seat`) as `seat` sees it. Throws if it doesn't fit. */
export function applyEntry(state, entry, seat) {
  const { move } = entry
  if (move.type === 'together') {
    if (state.phase !== 'opening' || move.round !== state.round) throw new Error('start out of place')
    const s = { ...state, pits: flipBoard(seat, move.pits) }
    // whoever died first goes next: as if the other side has just had a go
    return afterGo(s, 1 - sideOfSeat(seat, move.first), false)
  }
  if (move.type === 'move') {
    const side = sideOfSeat(seat, entry.seat)
    if (state.phase !== 'play' || state.turn !== side) throw new Error('move out of turn')
    const out = playMove(state.pits, side, flipPos(seat, move.house), state.burnt)
    return { ...afterGo({ ...state, pits: out.pits }, side, out.extraTurn), lastEvents: out.events }
  }
  throw new Error(`unknown entry ${move.type}`)
}

/** The match so far, rebuilt from the record (after a reload). */
export function replay(entries, seat) {
  let state = startState()
  for (const entry of entries) state = applyEntry(state, entry, seat)
  return state
}
