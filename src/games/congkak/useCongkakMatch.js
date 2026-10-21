import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { OPPONENT, PLAYER, STORE, checkGameOver, chooseMove, createBoard, playMove } from './engine'

const BASE_STEP = 190 // ms per seed at normal speed
const MIN_STEP = 25
const MAX_TURN_MS = 6500 // long relay chains speed up so no turn takes longer than this
const AI_THINK = 850

function stepDelay(eventCount, fast) {
  const base = fast ? BASE_STEP / 2.2 : BASE_STEP
  const budget = (fast ? MAX_TURN_MS / 2 : MAX_TURN_MS) / Math.max(1, eventCount)
  return Math.max(MIN_STEP, Math.min(base, budget))
}

/**
 * Runs one Congkak match: whose turn it is, the board shown on screen while
 * moves animate seed by seed, AI turns, and the final result.
 */
export function useCongkakMatch({ level, starter = PLAYER }) {
  const [pits, setPits] = useState(createBoard)
  const [turn, setTurn] = useState(starter)
  const [animating, setAnimating] = useState(false)
  const [hand, setHand] = useState(null) // { pit, count }
  const [flash, setFlash] = useState(null) // { pits: [], key }
  const [banner, setBanner] = useState(null) // { text, tone, key }
  const [result, setResult] = useState(null)
  const [fast, setFast] = useState(false)

  const timers = useRef([])
  const pending = useRef(null) // { finalPits, finish }
  const fastRef = useRef(fast)
  fastRef.current = fast

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  const say = useCallback((text, tone = 'info') => setBanner({ text, tone, key: Math.random() }), [])

  /** After a move finishes: next turn or game over. */
  const advance = useCallback(
    (boardAfter, side, extraTurn) => {
      const nextSide = extraTurn ? side : 1 - side
      const over = checkGameOver(boardAfter, nextSide)
      if (over) {
        if (over.swept > 0) {
          say(over.sweptBy === PLAYER ? `Kamu kutip baki ${over.swept} biji.` : `Aiman kutip baki ${over.swept} biji.`, 'info')
        }
        setPits(over.pits)
        later(() => {
          setResult(over)
          if (over.winner === PLAYER) sfx.win()
          else if (over.winner === OPPONENT) sfx.lose()
          else sfx.draw()
        }, over.swept > 0 ? 1200 : 500)
        return
      }
      setTurn(nextSide)
      if (extraTurn) say(side === PLAYER ? 'Masuk rumah. Kamu main lagi.' : 'Aiman masuk rumah, dia main lagi.', 'good')
    },
    [say],
  )

  /** Animate a move event by event. */
  const runMove = useCallback(
    (side, house) => {
      const outcome = playMove(pits, side, house)
      const display = pits.slice()
      const { events } = outcome
      const delay = stepDelay(events.length, fastRef.current)
      setAnimating(true)
      setBanner(null)

      const finish = () => {
        clearTimers()
        pending.current = null
        setHand(null)
        setPits(outcome.pits)
        setAnimating(false)
        advance(outcome.pits, side, outcome.extraTurn)
      }
      pending.current = { finish }

      let i = 0
      let drops = 0
      const step = () => {
        if (i >= events.length) {
          later(finish, 250)
          return
        }
        const e = events[i++]
        let wait = delay
        switch (e.type) {
          case 'pickup':
          case 'relay':
            display[e.pit] = 0
            setHand({ pit: e.pit, count: e.count })
            sfx.seedPickup()
            wait = delay * 1.6
            break
          case 'drop':
            display[e.pit] += 1
            setHand(e.hand > 0 ? { pit: e.pit, count: e.hand } : { pit: e.pit, count: 0 })
            sfx.seedDrop(drops++)
            break
          case 'capture':
            display[e.pit] = 0
            display[e.opposite] = 0
            display[e.store] += e.count
            setFlash({ pits: [e.pit, e.opposite, e.store], key: Math.random() })
            say(side === PLAYER ? `Tembak. ${e.count} biji masuk rumah kamu.` : `Aiman tembak ${e.count} biji kamu.`, side === PLAYER ? 'good' : 'bad')
            sfx.capture()
            wait = 900
            break
          case 'extraTurn':
            sfx.extraTurn()
            wait = 400
            break
          default:
            wait = 200
        }
        setPits(display.slice())
        later(step, wait)
      }
      step()
    },
    [pits, advance, say],
  )

  /** Player taps one of their houses. */
  const playHouse = useCallback(
    (house) => {
      if (result || animating || turn !== PLAYER || house > 6 || pits[house] === 0) return
      sfx.tap()
      runMove(PLAYER, house)
    },
    [result, animating, turn, pits, runMove],
  )

  /** Tap during an animation to jump to the end of the move. */
  const skip = useCallback(() => {
    if (pending.current) pending.current.finish()
  }, [])

  // AI turn
  useEffect(() => {
    if (result || animating || turn !== OPPONENT) return undefined
    const id = setTimeout(() => {
      const move = chooseMove(pits, OPPONENT, level)
      if (move !== null) runMove(OPPONENT, move)
    }, AI_THINK)
    return () => clearTimeout(id)
  }, [turn, animating, result, pits, level, runMove])

  const restart = useCallback(
    (nextStarter = PLAYER) => {
      clearTimers()
      pending.current = null
      setPits(createBoard())
      setTurn(nextStarter)
      setAnimating(false)
      setHand(null)
      setFlash(null)
      setBanner(null)
      setResult(null)
    },
    [],
  )

  return {
    pits,
    turn,
    animating,
    hand,
    flash,
    banner,
    result,
    fast,
    setFast,
    playHouse,
    skip,
    restart,
    scores: [pits[STORE[PLAYER]], pits[STORE[OPPONENT]]],
  }
}
