import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import {
  OPPONENT,
  PLAYER,
  applyMove,
  checkOutcome,
  chooseMove,
  countPieces,
  createBoard,
  legalMoves,
  ownerOf,
  resetsQuiet,
} from './engine'

const HOP_MS = 330 // one hop of a buah sliding across the board
const THINK_MS = 900 // Pak Tam looks at the board before he moves
const FADE_MS = 380 // eaten buah fade away

const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)]
const PAK_TAM = {
  eats: ['Hah, makan!', 'Hehe, kena lagi.', 'Tak perasan ke tu?', 'Ini baru dam orang lama.'],
  eatsMany: ['Hah! Borong!', 'Sapu bersih, cu!'],
  haji: ['Naik haji aku!', 'Haji dah ni, hati-hati.'],
  loses: ['Aduh, tak nampak pulak.', 'Pandai cucu ni.', 'Hmm, boleh tahan.', 'Alamak, terlepas.'],
  youHaji: ['Wah, naik haji dah!', 'Eh, cepatnya naik haji.'],
}

/** Every piece gets an id so the board can slide it from square to square. */
function idsFor(board) {
  let next = 1
  return board.map((v) => (v ? next++ : null))
}

/** Piece ids after a move: the mover keeps its id, eaten ones are gone. */
function idsAfter(prev, move) {
  const next = prev.slice()
  const id = next[move.from]
  next[move.from] = null
  for (const sq of move.captured) next[sq] = null
  next[move.to] = id
  return next
}

/**
 * Online, both players see their own buah at the bottom. Moves go over the
 * wire as the host (seat 0) sees the board; seat 1's board is the same one
 * turned round (square sq ↔ 63 - sq), so the same flip works both ways.
 */
const flipFor = (seat) => (seat === 0 ? (sq) => sq : (sq) => 63 - sq)

/** The legal move for `side` that follows exactly these squares (or null: not legal). */
const findMove = (board, side, path) =>
  legalMoves(board, side).find((m) => m.path.length === path.length && m.path.every((sq, i) => sq === path[i])) ?? null

/**
 * One Dam match against Pak Tam: whose turn it is, tap-to-select and
 * tap-to-move for you (with chained makan), Pak Tam's moves hop by hop, and
 * the result.
 *
 * Online (`net` from useNetMatch: { seat, moves, loaded, send }), the other
 * side's moves come from your friend instead of Pak Tam: yours are sent as
 * you make them, theirs are checked against the rules and played hop by hop.
 * `them` is the other side's name for the messages.
 */
export function useDamMatch({ level, starter = PLAYER, net = null, them = 'Pak Tam' }) {
  const [board, setBoard] = useState(createBoard)
  const [ids, setIds] = useState(() => idsFor(createBoard()))
  const [turn, setTurn] = useState(starter)
  const [quiet, setQuiet] = useState(0)
  const [selected, setSelected] = useState(null) // square of the chosen buah
  const [path, setPath] = useState([]) // hops made so far in a chained makan
  const [moving, setMoving] = useState(null) // { id, sq } buah in flight
  const [fading, setFading] = useState([]) // squares of buah being eaten
  const [lastMove, setLastMove] = useState(null)
  const [banner, setBanner] = useState(null)
  const [speech, setSpeech] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const say = useCallback((text, tone = 'info') => setBanner({ text, tone, key: Math.random() }), [])
  const pakTamSays = useCallback((text) => setSpeech({ text, key: Math.random() }), [])

  const moves = useMemo(() => (turn === PLAYER && !result ? legalMoves(board, PLAYER) : []), [board, turn, result])
  const mustCapture = moves.length > 0 && moves[0].captured.length > 0

  // moves still possible for the chosen buah, given the hops already made
  const candidates = useMemo(() => {
    if (selected === null) return []
    const prefix = path.length ? path : [selected]
    return moves.filter((m) => m.from === selected && prefix.every((sq, i) => m.path[i] === sq))
  }, [moves, selected, path])

  const targets = useMemo(() => {
    const step = path.length ? path.length : 1
    return [...new Set(candidates.map((m) => m.path[step]).filter((sq) => sq !== undefined))]
  }, [candidates, path])

  const movable = useMemo(() => [...new Set(moves.map((m) => m.from))], [moves])

  /** Apply a finished move: eat, promote, check the end, pass the turn. */
  const commit = useCallback(
    (move, side) => {
      if (net && side === PLAYER) net.send({ path: move.path.map(flipFor(net.seat)) })
      const before = board
      const after = applyMove(before, move)
      const nextQuiet = resetsQuiet(before, move) ? 0 : quiet + 1
      setFading(move.captured)
      setLastMove({ from: move.from, to: move.to, side })
      if (move.captured.length) sfx.capture()
      later(() => {
        setBoard(after)
        setIds((prev) => idsAfter(prev, move))
        setFading([])
        setMoving(null)
        setSelected(null)
        setPath([])
        setQuiet(nextQuiet)

        const n = move.captured.length
        if (side === PLAYER) {
          if (move.promote) {
            say('Naik haji! Buah ni boleh undur sekarang.', 'good')
            if (!net) pakTamSays(pickLine(PAK_TAM.youHaji))
            sfx.extraTurn()
          } else if (n) {
            say(n > 1 ? `Makan ${n} buah sekali gus!` : `Makan! 1 buah ${them} kena.`, 'good')
            if (!net) pakTamSays(pickLine(PAK_TAM.loses))
          }
        } else {
          if (move.promote) {
            say(`${them} naik haji!`, 'bad')
            if (!net) pakTamSays(pickLine(PAK_TAM.haji))
            sfx.extraTurn()
          } else if (n) {
            say(`${them} makan ${n} buah kamu.`, 'bad')
            if (!net) pakTamSays(pickLine(n > 1 ? PAK_TAM.eatsMany : PAK_TAM.eats))
          }
        }

        const nextSide = 1 - side
        const outcome = checkOutcome(after, nextSide, nextQuiet)
        setBusy(false)
        if (outcome) {
          const [mine, theirs] = countPieces(after)
          later(() => {
            setResult({ ...outcome, pieces: [mine, theirs] })
            if (outcome.winner === PLAYER) sfx.win()
            else if (outcome.winner === OPPONENT) sfx.lose()
            else sfx.draw()
          }, 700)
          return
        }
        setTurn(nextSide)
      }, move.captured.length ? FADE_MS : 60)
    },
    [board, quiet, say, pakTamSays, net, them],
  )

  /** Slide a buah along hops (each hop = one square in `hops`), then call done. */
  const slide = useCallback((id, hops, done) => {
    hops.forEach((sq, i) => {
      later(() => {
        setMoving({ id, sq })
        sfx.seedDrop(i)
      }, i * HOP_MS)
    })
    later(done, hops.length * HOP_MS)
  }, [])

  /** You tap a square. Returns what happened, so the screen can explain. */
  const tapSquare = useCallback(
    (sq) => {
      if (result) return 'over'
      if (turn !== PLAYER || busy) return 'wait'
      const owner = ownerOf(board[sq])

      // chained makan in progress: only the next hop is allowed
      if (path.length > 0) {
        if (!targets.includes(sq)) return 'chain'
      } else if (owner === PLAYER) {
        if (!movable.includes(sq)) {
          setSelected(null)
          return mustCapture ? 'must-capture' : 'blocked'
        }
        sfx.tap()
        setSelected(sq === selected ? null : sq)
        return 'selected'
      } else if (selected === null) {
        return owner === OPPONENT ? 'theirs' : 'empty'
      } else if (!targets.includes(sq)) {
        return mustCapture ? 'must-capture' : 'not-target'
      }

      // a legal hop
      const newPath = path.length ? [...path, sq] : [selected, sq]
      const remaining = candidates.filter((m) => newPath.every((p, i) => m.path[i] === p))
      const id = ids[selected]
      setBusy(true)
      setPath(newPath)
      slide(id, [sq], () => {
        const done = remaining.find((m) => m.path.length === newPath.length)
        if (done && remaining.length === 1) {
          commit(done, PLAYER)
          return
        }
        // more makan to do: if only one way to continue, keep going by itself
        const nextHops = [...new Set(remaining.map((m) => m.path[newPath.length]))]
        if (nextHops.length === 1 && remaining.every((m) => m.path.length > newPath.length)) {
          let chainPath = newPath
          const follow = () => {
            const left = remaining.filter((m) => chainPath.every((p, i) => m.path[i] === p))
            const hops = [...new Set(left.map((m) => m.path[chainPath.length]).filter((x) => x !== undefined))]
            const finished = left.find((m) => m.path.length === chainPath.length)
            if (finished && left.length === 1) return commit(finished, PLAYER)
            if (hops.length !== 1) {
              setPath(chainPath)
              setBusy(false)
              return undefined
            }
            chainPath = [...chainPath, hops[0]]
            setPath(chainPath)
            return slide(id, [hops[0]], follow)
          }
          follow()
          return
        }
        setBusy(false)
      })
      return 'moved'
    },
    [result, turn, busy, board, path, targets, movable, mustCapture, selected, candidates, ids, slide, commit],
  )

  // ---- online: rebuild from the record, then play your friend's moves as they come
  const played = useRef(0) // how many of net.moves are on the board
  const rebuilt = useRef(false)
  const netMoves = net?.moves
  const netLoaded = net?.loaded
  const netSeat = net?.seat

  useEffect(() => {
    if (!netLoaded || rebuilt.current) return
    rebuilt.current = true
    if (!netMoves.length) return
    // back after a reload: replay everything so far without animation
    const flip = flipFor(netSeat)
    let b = createBoard()
    let ids = idsFor(b)
    let q = 0
    let side = starter
    let last = null
    for (const entry of netMoves) {
      side = entry.seat === netSeat ? PLAYER : OPPONENT
      const move = findMove(b, side, entry.move.path.map(flip))
      if (!move) {
        console.warn('[dam] move in the record is not legal', entry.seq)
        break
      }
      q = resetsQuiet(b, move) ? 0 : q + 1
      ids = idsAfter(ids, move)
      b = applyMove(b, move)
      last = { from: move.from, to: move.to, side }
      played.current += 1
    }
    setBoard(b)
    setIds(ids)
    setQuiet(q)
    setLastMove(last)
    const outcome = checkOutcome(b, 1 - side, q)
    if (outcome) setResult({ ...outcome, pieces: countPieces(b) })
    else setTurn(1 - side)
  }, [netLoaded, netMoves, netSeat, starter])

  useEffect(() => {
    if (!net || !rebuilt.current || result || busy) return
    const entry = netMoves[played.current]
    if (!entry) return
    if (entry.seat === netSeat) {
      played.current += 1 // one of ours: already on the board
      return
    }
    if (turn !== OPPONENT) return
    const move = findMove(board, OPPONENT, entry.move.path.map(flipFor(netSeat)))
    played.current += 1
    if (!move) {
      console.warn('[dam] friend sent a move that is not legal here', entry.seq)
      return
    }
    setBusy(true)
    setSelected(move.from)
    slide(ids[move.from], move.path.slice(1), () => commit(move, OPPONENT))
  }, [net, netMoves, netSeat, turn, result, busy, board, ids, slide, commit])

  // Pak Tam's turn
  useEffect(() => {
    if (net || result || turn !== OPPONENT || busy) return undefined
    const id = setTimeout(() => {
      const move = chooseMove(board, OPPONENT, level)
      if (!move) return
      setBusy(true)
      setSelected(move.from)
      slide(ids[move.from], move.path.slice(1), () => commit(move, OPPONENT))
    }, THINK_MS)
    return () => clearTimeout(id)
  }, [net, turn, result, busy, board, ids, level, slide, commit])

  const restart = useCallback((nextStarter = PLAYER) => {
    clearTimers()
    const fresh = createBoard()
    setBoard(fresh)
    setIds(idsFor(fresh))
    setTurn(nextStarter)
    setQuiet(0)
    setSelected(null)
    setPath([])
    setMoving(null)
    setFading([])
    setLastMove(null)
    setBanner(null)
    setSpeech(null)
    setResult(null)
    setBusy(false)
  }, [])

  const [mine, theirs] = countPieces(board)
  return {
    board,
    ids,
    turn,
    selected,
    path,
    targets,
    movable: selected === null && turn === PLAYER && !busy ? movable : [],
    mustCapture,
    moving,
    fading,
    lastMove,
    banner,
    speech,
    result,
    busy,
    say,
    tapSquare,
    restart,
    pieces: [mine, theirs],
  }
}
