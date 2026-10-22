import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { OPPONENT, PLAYER, STORE, checkGameOver, chooseMove, createBoard, playMove } from './engine'

// One steady pace for every move, however long the relay chain.
// Holding the Laju button doubles it while held (tap the board to skip to the end).
export const STEP_MS = 380
const AI_THINK = 1100

/**
 * Runs one Congkak match: whose turn it is, the board shown on screen while
 * moves animate seed by seed, AI turns, and the final result.
 */
export function useCongkakMatch({ level, starter = PLAYER }) {
  const [pits, setPits] = useState(createBoard)
  const [turn, setTurn] = useState(starter)
  const [animating, setAnimating] = useState(false)
  const [hand, setHand] = useState(null) // { pit, count, side, tick }
  const [mover, setMover] = useState(null) // side whose move is animating
  const [flash, setFlash] = useState(null) // { pits: [], key }
  const [banner, setBanner] = useState(null) // { text, tone, key }
  const [result, setResult] = useState(null)
  const [fast, setFast] = useState(false)

  // a side may only tembak once its seeds have gone round past its own rumah
  const lapped = useRef([false, false])
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

  const say = useCallback((text, tone = 'info') => setBanner({ text, tone, key: Math.random(), at: Date.now() }), [])
  // things Aisyah says out loud, shown as a speech bubble on her side
  const [speech, setSpeech] = useState(null)
  const rivalSays = useCallback((text) => setSpeech({ text, key: Math.random() }), [])

  /** After a move finishes: next turn or game over. */
  const advance = useCallback(
    (boardAfter, side, extraTurn) => {
      const nextSide = extraTurn ? side : 1 - side
      const over = checkGameOver(boardAfter, nextSide)
      if (over) {
        if (over.swept > 0) {
          if (over.sweptBy === PLAYER) say(`Kamu kutip baki ${over.swept} guli!`, 'good')
          else rivalSays(`Aku kutip baki ${over.swept} biji, ya.`)
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
      if (extraTurn) {
        if (side === PLAYER) say('Masuk rumah! Kamu main lagi.', 'good')
        else {
          say('Aisyah masuk rumah, dia main lagi.', 'them')
          rivalSays('Masuk rumah! Aku main lagi.')
        }
      }
    },
    [say, rivalSays],
  )

  /** Animate a move event by event. */
  const runMove = useCallback(
    (side, house) => {
      const outcome = playMove(pits, side, house, lapped.current[side])
      if (outcome.passedStore) lapped.current[side] = true
      const display = pits.slice()
      const { events } = outcome
      setAnimating(true)
      setMover(side)
      // keep a message the player has only just been shown
      setBanner((b) => (b && Date.now() - b.at < 1800 ? b : null))

      const finish = () => {
        clearTimers()
        pending.current = null
        setHand(null)
        setPits(outcome.pits)
        setAnimating(false)
        setMover(null)
        advance(outcome.pits, side, outcome.extraTurn)
      }
      pending.current = { finish }

      let i = 0
      let drops = 0
      const step = () => {
        if (i >= events.length) {
          later(finish, fastRef.current ? 125 : 250)
          return
        }
        const e = events[i++]
        // read every step, so pressing or releasing Laju takes effect mid-move
        const speed = fastRef.current ? 2 : 1
        const delay = STEP_MS
        let wait = delay
        switch (e.type) {
          case 'pickup':
          case 'relay':
            display[e.pit] = 0
            setHand({ pit: e.pit, count: e.count, side, tick: i })
            sfx.seedPickup()
            wait = delay * 1.6
            break
          case 'drop':
            display[e.pit] += 1
            setHand({ pit: e.pit, count: e.hand, side, tick: i })
            sfx.seedDrop(drops++)
            break
          case 'capture':
            display[e.pit] = 0
            display[e.opposite] = 0
            display[e.store] += e.count
            setFlash({ pits: [e.pit, e.opposite, e.store], key: Math.random() })
            if (side === PLAYER) {
              say(`Tembak! +${e.count} guli untuk kamu`, 'good')
              rivalSays('Alamak, habis biji aku!')
            } else {
              say(`Aisyah tembak! ${e.count} guli masuk rumah dia`, 'bad')
              rivalSays(`Tembak! ${e.count} biji kamu aku ambil.`)
            }
            sfx.capture()
            wait = 900
            break
          case 'noTembak':
            if (side === PLAYER) say('Belum cukup satu pusingan. Belum boleh tembak lagi.', 'bad')
            wait = 600
            break
          case 'extraTurn':
            sfx.extraTurn()
            wait = 400
            break
          default:
            wait = 200
        }
        setPits(display.slice())
        later(step, wait / speed)
      }
      step()
    },
    [pits, advance, say, rivalSays],
  )

  /** Player taps one of their houses. */
  /**
   * Player taps a house. Returns what happened so the screen can react:
   * 'played' · 'wait' (Aisyah's turn) · 'busy' (your own seeds still moving)
   * · 'theirs' (Aisyah's row) · 'empty' · 'over'
   */
  const playHouse = useCallback(
    (house) => {
      if (result) return 'over'
      if (turn !== PLAYER || (animating && mover === OPPONENT)) return 'wait'
      if (animating) return 'busy'
      if (house > 6) return 'theirs'
      if (pits[house] === 0) return 'empty'
      sfx.tap()
      runMove(PLAYER, house)
      return 'played'
    },
    [result, animating, mover, turn, pits, runMove],
  )

  /** Tap during an animation to jump to the end of the move. */
  const skip = useCallback(() => {
    if (pending.current) pending.current.finish()
  }, [])

  // AI turn
  useEffect(() => {
    if (result || animating || turn !== OPPONENT) return undefined
    const id = setTimeout(() => {
      const move = chooseMove(pits, OPPONENT, level, Math.random, lapped.current)
      if (move !== null) runMove(OPPONENT, move)
    }, AI_THINK)
    return () => clearTimeout(id)
  }, [turn, animating, result, pits, level, runMove])

  const restart = useCallback(
    (nextStarter = PLAYER) => {
      clearTimers()
      pending.current = null
      lapped.current = [false, false]
      setPits(createBoard())
      setTurn(nextStarter)
      setAnimating(false)
      setHand(null)
      setMover(null)
      setFlash(null)
      setBanner(null)
      setSpeech(null)
      setResult(null)
    },
    [],
  )

  return {
    pits,
    turn,
    mover,
    say,
    speech,
    rivalSays,
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
