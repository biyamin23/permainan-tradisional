/**
 * Dam (Malaysian draughts) rules, pure JS. The board is 8×8 and only the dark
 * squares are used. 12 buah each; you start at the bottom and move up.
 *
 * - A buah moves one square diagonally forward.
 * - Makan (capture) by jumping forward over an enemy buah next to you onto the
 *   empty square behind it. An ordinary buah never moves or makan backward.
 * - Makan is compulsory. After a jump, keep jumping while you can (one move).
 * - A buah that ends its move on the far row naik haji (becomes a king).
 *   A haji also moves one square at a time, but forward or backward, and
 *   makan forward or backward (jumping one buah next to it).
 * - You lose when you have no buah left or no move to make.
 * - Draw: 40 moves in a row with no makan and no ordinary buah moving
 *   (only haji walking about).
 *
 * Board: array of 64. 0 empty, 1 your buah, 2 your haji, -1 opponent buah,
 * -2 opponent haji. Square index = row * 8 + col, row 0 at the top.
 */

export const PLAYER = 0
export const OPPONENT = 1
export const SIZE = 8
const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]
export const DRAW_PLIES = 40

export const rowOf = (sq) => (sq / SIZE) | 0
export const colOf = (sq) => sq % SIZE
export const isDark = (sq) => (rowOf(sq) + colOf(sq)) % 2 === 1
const at = (r, c) => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? r * SIZE + c : -1)

/** +1 for your pieces, -1 for the opponent's. */
export const sign = (side) => (side === PLAYER ? 1 : -1)
export const ownerOf = (v) => (v > 0 ? PLAYER : v < 0 ? OPPONENT : null)
export const isKing = (v) => Math.abs(v) === 2

export function createBoard() {
  const board = new Array(64).fill(0)
  for (let sq = 0; sq < 64; sq++) {
    if (!isDark(sq)) continue
    const r = rowOf(sq)
    if (r <= 2) board[sq] = -1
    else if (r >= 5) board[sq] = 1
  }
  return board
}

const forward = (side) => (side === PLAYER ? -1 : 1)
const lastRow = (side) => (side === PLAYER ? 0 : SIZE - 1)

/** All capture sequences starting from `from` (recursive, pieces stay until the move ends). */
function captureChains(board, from, side, piece) {
  const chains = []
  const king = isKing(piece)
  const s = sign(side)

  const walk = (sq, path, captured) => {
    let extended = false
    const r = rowOf(sq)
    const c = colOf(sq)
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== forward(side)) continue // an ordinary buah only makan forward
      const mid = at(r + dr, c + dc)
      const land = at(r + dr * 2, c + dc * 2)
      if (mid < 0 || land < 0) continue
      if (board[mid] * s >= 0 || captured.includes(mid)) continue
      if (board[land] !== 0 && land !== from) continue
      extended = true
      walk(land, [...path, land], [...captured, mid])
    }
    if (!extended && captured.length > 0) chains.push({ path, captured })
  }

  walk(from, [from], [])
  return chains
}

function quietMoves(board, from, side, piece) {
  const moves = []
  const r = rowOf(from)
  const c = colOf(from)
  // one square diagonally: forward only for a buah, any way for a haji
  const rows = isKing(piece) ? [-1, 1] : [forward(side)]
  for (const dr of rows) {
    for (const dc of [-1, 1]) {
      const t = at(r + dr, c + dc)
      if (t >= 0 && board[t] === 0) moves.push({ path: [from, t], captured: [] })
    }
  }
  return moves
}

function finish(board, side, move) {
  const from = move.path[0]
  const to = move.path[move.path.length - 1]
  const piece = board[from]
  return {
    ...move,
    from,
    to,
    promote: !isKing(piece) && rowOf(to) === lastRow(side),
  }
}

/** Every legal move for `side`. When any makan is possible, only makan moves. */
export function legalMoves(board, side) {
  const s = sign(side)
  const captures = []
  const quiet = []
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq]
    if (piece * s <= 0) continue
    for (const m of captureChains(board, sq, side, piece)) captures.push(finish(board, side, m))
    if (captures.length === 0) for (const m of quietMoves(board, sq, side, piece)) quiet.push(finish(board, side, m))
  }
  return captures.length > 0 ? captures : quiet
}

/** Squares of your buah that are able to makan right now (for the "wajib makan" hint). */
export function piecesThatMustCapture(board, side) {
  const moves = legalMoves(board, side)
  if (!moves.length || !moves[0].captured.length) return []
  return [...new Set(moves.map((m) => m.from))]
}

export function applyMove(board, move) {
  const next = board.slice()
  const piece = next[move.from]
  next[move.from] = 0
  for (const sq of move.captured) next[sq] = 0
  next[move.to] = move.promote ? piece * 2 : piece
  return next
}

export function countPieces(board) {
  let mine = 0
  let theirs = 0
  for (const v of board) {
    if (v > 0) mine++
    else if (v < 0) theirs++
  }
  return [mine, theirs]
}

/**
 * Game state after a move. `quiet` counts plies since the last makan or
 * ordinary buah move (for the draw rule).
 */
export function checkOutcome(board, sideToMove, quiet) {
  if (legalMoves(board, sideToMove).length === 0) {
    return { winner: 1 - sideToMove, reason: countPieces(board)[sideToMove] === 0 ? 'habis' : 'terkunci' }
  }
  if (quiet >= DRAW_PLIES) return { winner: null, reason: 'seri' }
  return null
}

/** Is this move one that resets the draw counter? */
export const resetsQuiet = (board, move) => move.captured.length > 0 || !isKing(board[move.from])

// ---------------------------------------------------------------- AI

const CENTER = [0, 1, 2, 3, 3, 2, 1, 0]

/** Score from `side`'s point of view. */
function evaluate(board, side) {
  let score = 0
  for (let sq = 0; sq < 64; sq++) {
    const v = board[sq]
    if (v === 0) continue
    const owner = v > 0 ? PLAYER : OPPONENT
    const r = rowOf(sq)
    let value
    if (isKing(v)) value = 330 + CENTER[colOf(sq)] * 3 + CENTER[r] * 3
    else {
      const advance = owner === PLAYER ? 7 - r : r
      value = 100 + advance * 5 + CENTER[colOf(sq)] * 2
      // keeping the back row guarded stops the other side naik haji
      if ((owner === PLAYER && r === 7) || (owner === OPPONENT && r === 0)) value += 6
    }
    score += owner === side ? value : -value
  }
  return score
}

function search(board, side, depth, alpha, beta, deadline, stats) {
  stats.nodes++
  const moves = legalMoves(board, side)
  if (moves.length === 0) return -100000 - depth
  if (depth <= 0 && !moves[0].captured.length) return evaluate(board, side)
  if (depth <= -6) return evaluate(board, side) // limit capture extensions
  if (stats.nodes % 1024 === 0 && Date.now() > deadline) stats.timeout = true
  if (stats.timeout) return evaluate(board, side)
  moves.sort((a, b) => b.captured.length - a.captured.length || Number(b.promote) - Number(a.promote))
  let best = -Infinity
  for (const m of moves) {
    const score = -search(applyMove(board, m), 1 - side, depth - 1, -beta, -alpha, deadline, stats)
    if (score > best) best = score
    if (score > alpha) alpha = score
    if (alpha >= beta) break
  }
  return best
}

const LEVEL = {
  mudah: { depth: 1, blunder: 0.35, ms: 150 },
  biasa: { depth: 3, blunder: 0.08, ms: 400 },
  pakar: { depth: 7, blunder: 0, ms: 900 },
}

/**
 * Pick a move for `side`. `level` is the tuning from progression
 * ({ depth, blunder, ms }: how far ahead he searches, how often he slips,
 * how long he may think) or an old level name.
 */
export function chooseMove(board, side, level = 'biasa', random = Math.random) {
  const moves = legalMoves(board, side)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]
  const cfg = typeof level === 'string' ? LEVEL[level] ?? LEVEL.biasa : level
  if (random() < cfg.blunder) return moves[Math.floor(random() * moves.length)]

  const deadline = Date.now() + cfg.ms
  let bestMoves = moves
  // iterative deepening: keep the deepest search that finished in time
  for (let depth = 1; depth <= cfg.depth; depth++) {
    const stats = { nodes: 0, timeout: false }
    let best = -Infinity
    let found = []
    for (const m of moves) {
      const score = -search(applyMove(board, m), 1 - side, depth - 1, -Infinity, Infinity, deadline, stats)
      if (score > best + 0.5) {
        best = score
        found = [m]
      } else if (Math.abs(score - best) <= 0.5) found.push(m)
    }
    if (stats.timeout && depth > 1) break
    bestMoves = found
    if (stats.timeout) break
  }
  return bestMoves[Math.floor(random() * bestMoves.length)]
}
