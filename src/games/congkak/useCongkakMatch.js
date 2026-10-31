import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import {
  MAX_ROUNDS,
  OPPONENT,
  PLAYER,
  STORE,
  burntCount,
  chooseMove,
  createBoard,
  createBurnt,
  finalResult,
  legalMoves,
  nextRound,
  firstAfterTogether,
  nextToMove,
  pickTogether,
  playMove,
  startTogether,
  tickTogether,
  togetherOver,
} from './engine'

// One steady pace for every move, however long the relay chain.
// Holding the Laju button doubles it while held (tap the board to skip to the end).
export const STEP_MS = 380
const AI_THINK = 1100
const AI_THINK_QUICK = 550 // only one or two kampung to choose from
const AI_PICK_TICKS = 2 // in the live start, Aisyah picks again this many seeds after reaching her rumah
const MAX_TURNS = 300 // a pusingan that somehow never ends is called after this

/**
 * Runs one Congkak match (engine.js has the rules): every pusingan starts
 * with both of you sowing at once, then turns alternate until no kampung has
 * seeds left; then the kampung are refilled (some may be terbakar) for the
 * next pusingan, up to MAX_ROUNDS or until someone can't fill a kampung.
 *
 * phase: 'opening' (waiting for you to pick your first kampung; Aisyah has
 *        already picked hers) · 'together' (both sowing live; `youPick`
 *        when you're back in your rumah and can pick again) · 'play'
 *        (turns) · 'between' (refilling) ·
 *        'over'
 */
export function useCongkakMatch({ level }) {
  const [pits, setPits] = useState(createBoard)
  const [burnt, setBurnt] = useState(createBurnt)
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState('opening')
  const [turn, setTurn] = useState(PLAYER)
  const [animating, setAnimating] = useState(false)
  const [hands, setHands] = useState([null, null]) // per side: { pit, count, side, tick }
  const [movers, setMovers] = useState([]) // sides whose seeds are moving
  const [flash, setFlash] = useState(null) // { pits: [], key }
  const [banner, setBanner] = useState(null) // { text, tone, key }
  const [result, setResult] = useState(null)
  const [fast, setFast] = useState(false)

  const timers = useRef([])
  const pending = useRef(null) // { finish }
  const turnsThisRound = useRef(0)
  const fastRef = useRef(fast)
  fastRef.current = fast
  // Aisyah's kampung for the start of this pusingan (she's ready before you are)
  const theirOpening = useRef(null)

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

  const announceCapture = useCallback(
    (e, quiet = false) => {
      setFlash({ pits: [e.pit, e.opposite, e.store], key: Math.random() })
      if (e.side === PLAYER) {
        say(`Tembak! +${e.count} guli untuk kamu`, 'good')
        rivalSays('Alamak, habis biji aku!')
      } else {
        say(`Aisyah tembak! ${e.count} guli masuk rumah dia`, 'bad')
        rivalSays(`Tembak! ${e.count} biji kamu aku ambil.`)
      }
      if (!quiet) sfx.capture()
    },
    [say, rivalSays],
  )

  const finishMatch = useCallback((board, burntNow, rounds) => {
    const over = finalResult(board, burntNow, rounds)
    setPits(over.pits)
    setPhase('over')
    later(() => {
      setResult(over)
      if (over.winner === PLAYER) sfx.win()
      else if (over.winner === OPPONENT) sfx.lose()
      else sfx.draw()
    }, 700)
  }, [])

  /** A pusingan is over: refill for the next one, or finish the match. */
  const endRound = useCallback(
    (board, burntNow, roundNow) => {
      setPhase('between')
      if (roundNow >= MAX_ROUNDS) {
        say(`Tamat ${MAX_ROUNDS} pusingan. Kira guli dalam rumah!`, 'info')
        later(() => finishMatch(board, burntNow, roundNow), 1200)
        return
      }
      const nr = nextRound(board, burntNow)
      if (nr.conceded.length) {
        const who = nr.conceded.length === 2 ? 'Kedua-dua pihak' : nr.conceded[0] === PLAYER ? 'Kamu' : 'Aisyah'
        say(`${who} tak cukup guli untuk mengisi kampung. Permainan tamat!`, 'info')
        later(() => finishMatch(nr.pits, burntNow, roundNow), 1600)
        return
      }
      const newly = [PLAYER, OPPONENT].map((s) => burntCount(nr.burnt, s) - burntCount(burntNow, s))
      const burntLine = newly.some((n) => n > 0) ? ` Terbakar: kamu ${newly[0]}, Aisyah ${newly[1]}.` : ''
      say(`Pusingan ${roundNow + 1}! Isi semula kampung.${burntLine}`, 'info')
      later(() => {
        setPits(nr.pits)
        setBurnt(nr.burnt)
        setRound(roundNow + 1)
        if (newly[0] > 0) rivalSays(`Kampung kamu terbakar ${newly[0]}!`)
        else if (newly[1] > 0) rivalSays('Alamak, kampung aku terbakar…')
        theirOpening.current = null
        turnsThisRound.current = 0
        setPhase('opening')
        setTurn(PLAYER)
      }, 1800)
    },
    [say, rivalSays, finishMatch],
  )

  /** After a go: next turn, a pass, or the end of the pusingan. */
  const advance = useCallback(
    (boardAfter, burntNow, roundNow, side, carriesOn) => {
      turnsThisRound.current += 1
      const nextSide = turnsThisRound.current > MAX_TURNS ? null : nextToMove(boardAfter, burntNow, side, carriesOn)
      if (nextSide === null) {
        endRound(boardAfter, burntNow, roundNow)
        return
      }
      setTurn(nextSide)
      const wanted = carriesOn ? side : 1 - side
      if (nextSide !== wanted) {
        // rule 4: no seeds in your kampung on your turn, the turn passes
        if (wanted === PLAYER) say('Kampung kamu kosong. Giliran Aisyah.', 'them')
        else say('Kampung Aisyah kosong. Giliran kamu lagi!', 'good')
      } else if (carriesOn) {
        if (side === PLAYER) say('Masuk rumah! Kamu main lagi.', 'good')
        else {
          say('Aisyah masuk rumah, dia main lagi.', 'them')
          rivalSays('Masuk rumah! Aku main lagi.')
        }
      }
    },
    [say, rivalSays, endRound],
  )

  /**
   * Animate events tick by tick (events with the same tick, like both hands
   * dropping a seed in the opening, happen together), then call `done`.
   */
  const animate = useCallback(
    (from, events, done) => {
      const display = from.slice()
      setAnimating(true)
      setMovers([...new Set(events.map((e) => e.side))])
      // keep a message the player has only just been shown
      setBanner((b) => (b && Date.now() - b.at < 1800 ? b : null))
      const now = [null, null]
      let i = 0
      let drops = 0

      const finish = () => {
        clearTimers()
        pending.current = null
        setHands([null, null])
        setAnimating(false)
        setMovers([])
        done()
      }
      pending.current = { finish }

      const step = () => {
        if (i >= events.length) {
          later(finish, fastRef.current ? 125 : 250)
          return
        }
        const t = events[i].t
        let wait = 200
        // everything that happens on this tick
        while (i < events.length && events[i].t === t) {
          const e = events[i++]
          const side = e.side
          switch (e.type) {
            case 'pickup':
            case 'relay':
              display[e.pit] = 0
              now[side] = { pit: e.pit, count: e.count, side, tick: `${t}-${side}` }
              sfx.seedPickup()
              wait = Math.max(wait, STEP_MS * 1.6)
              break
            case 'drop':
              display[e.pit] += 1
              now[side] = { pit: e.pit, count: e.hand, side, tick: `${t}-${side}` }
              sfx.seedDrop(drops++)
              wait = Math.max(wait, STEP_MS)
              break
            case 'capture':
              display[e.pit] = 0
              display[e.opposite] = 0
              display[e.store] += e.count
              announceCapture(e)
              wait = Math.max(wait, 900)
              break
            case 'noTembak':
              if (side === PLAYER) say('Mati! Belum satu pusingan, tak boleh tembak.', 'bad')
              wait = Math.max(wait, 600)
              break
            case 'extraTurn':
              sfx.extraTurn()
              now[side] = null
              wait = Math.max(wait, 400)
              break
            case 'end':
              now[side] = null
              break
            default:
          }
        }
        setHands([now[0], now[1]])
        setPits(display.slice())
        // read every tick, so pressing or releasing Laju takes effect mid-move
        later(step, wait / (fastRef.current ? 2 : 1))
      }
      step()
    },
    [say, rivalSays, announceCapture],
  )

  /** One go by one side. */
  const runMove = useCallback(
    (side, house) => {
      const outcome = playMove(pits, side, house, burnt)
      const roundNow = round
      const burntNow = burnt
      animate(pits, outcome.events, () => {
        setPits(outcome.pits)
        advance(outcome.pits, burntNow, roundNow, side, outcome.extraTurn)
      })
    },
    [pits, burnt, round, animate, advance],
  )

  // ---- the start of a pusingan, played live: both hands sow at once, and a
  // side back in its rumah picks up another kampung straight away
  const live = useRef(null) // engine live state + { round, aiAt }
  const [youPick, setYouPick] = useState(false) // you're back in your rumah mid-start: pick again now
  // while both hands are still alive the race is on: no skipping, no Laju
  const [bothAlive, setBothAlive] = useState(false)
  const liveRacing = (L) => !L.state.includes('dead')
  const levelRef = useRef(level)
  levelRef.current = level
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  /** Put the live board on screen: seeds, both hands, whether you can pick. */
  const showLive = useCallback((L) => {
    setPits(L.pits.slice())
    setHands(L.hands.map((h, side) => (h ? { pit: h.pos, count: h.hand, side, tick: `${L.t}-${side}` } : null)))
    setMovers([PLAYER, OPPONENT].filter((s) => L.hands[s]))
    setYouPick(L.state[PLAYER] === 'pick')
    setBothAlive(liveRacing(L))
  }, [])

  /** Sounds and messages for one live tick; returns how long to linger on it. */
  const cueLive = useCallback(
    (L, events, quiet) => {
      let wait = STEP_MS
      let drops = 0
      for (const e of events) {
        if (e.type === 'capture') {
          announceCapture(e, quiet)
          wait = 900
        } else if (quiet) {
          // skipping: no sounds
        } else if (e.type === 'drop') sfx.seedDrop(drops++)
        else if (e.type === 'pickup' || e.type === 'relay') {
          sfx.seedPickup()
          if (e.type === 'pickup') wait = STEP_MS * 1.6
        } else if (e.type === 'noTembak' && e.side === PLAYER) say('Mati! Belum satu pusingan, tak boleh tembak.', 'bad')
        else if (e.type === 'extraTurn') {
          sfx.extraTurn()
          if (L.state[e.side] !== 'pick') continue
          if (e.side === PLAYER) say('Masuk rumah! Terus pilih kampung dan sambung.', 'good')
          else rivalSays('Masuk rumah! Sambung!')
        }
      }
      return wait
    },
    [say, rivalSays, announceCapture],
  )

  /** One tick; Aisyah picks up another kampung a moment after reaching her rumah. */
  const liveStep = (L, quiet) => {
    const events = tickTogether(L)
    if (L.state[OPPONENT] === 'pick') {
      if (L.aiAt === null) L.aiAt = L.t + (quiet ? 0 : AI_PICK_TICKS)
      if (L.t >= L.aiAt) {
        events.push(...pickTogether(L, OPPONENT, chooseMove(L.pits, OPPONENT, levelRef.current, Math.random, L.burnt)))
        L.aiAt = null
      }
    }
    return events
  }

  /** Both sides are out: whoever died first has the next go. */
  const finishLive = () => {
    const L = live.current
    live.current = null
    clearTimers()
    setHands([null, null])
    setMovers([])
    setYouPick(false)
    setBothAlive(false)
    setAnimating(false)
    setPits(L.pits)
    setPhase('play')
    advanceRef.current(L.pits, L.burnt, L.round, 1 - firstAfterTogether(L), false)
  }

  const liveLoop = () => {
    const L = live.current
    if (!L) return
    if (togetherOver(L)) {
      finishLive()
      return
    }
    const wait = cueLive(L, liveStep(L, false), false)
    showLive(L)
    later(liveLoop, wait / (fastRef.current && !liveRacing(L) ? 2 : 1))
  }

  /** The start of a pusingan: your kampung and Aisyah's, sown together. */
  const startLive = (house) => {
    const theirs = theirOpening.current ?? chooseMove(pits, OPPONENT, level, Math.random, burnt)
    const { live: L, events } = startTogether(pits, burnt, house, theirs)
    live.current = Object.assign(L, { round, aiAt: null })
    setPhase('together')
    setAnimating(true)
    // keep a message the player has only just been shown
    setBanner((b) => (b && Date.now() - b.at < 1800 ? b : null))
    rivalSays('Satu, dua, tiga… mula!')
    const wait = cueLive(L, events, false)
    showLive(L)
    later(liveLoop, wait)
  }

  /** Back in your rumah during the start: take up another kampung at once. */
  const pickLive = (house) => {
    const L = live.current
    if (L.pits[house] === 0) return 'empty'
    sfx.tap()
    cueLive(L, pickTogether(L, PLAYER, house), false)
    showLive(L)
    return 'played'
  }

  // Aisyah picks her opening kampung as soon as a pusingan is ready
  useEffect(() => {
    if (phase === 'opening' && theirOpening.current === null) theirOpening.current = chooseMove(pits, OPPONENT, level, Math.random, burnt)
  }, [phase, pits, burnt, level])

  /**
   * Player taps a house. Returns what happened so the screen can react:
   * 'played' · 'wait' (Aisyah's turn) · 'busy' (seeds still moving)
   * · 'theirs' (Aisyah's row) · 'empty' · 'burnt' · 'over'
   */
  const playHouse = (house) => {
    if (result || phase === 'over') return 'over'
    if (phase === 'between') return 'busy'
    if (house > 6) return 'theirs'
    if (burnt[house]) return 'burnt'
    if (phase === 'opening') {
      if (pits[house] === 0) return 'empty'
      sfx.tap()
      startLive(house)
      return 'played'
    }
    if (phase === 'together') {
      const state = live.current?.state[PLAYER]
      if (state === 'pick') return pickLive(house)
      return state === 'dead' ? 'wait' : 'busy'
    }
    if (turn !== PLAYER || (animating && !movers.includes(PLAYER))) return 'wait'
    if (animating) return 'busy'
    if (pits[house] === 0) return 'empty'
    sfx.tap()
    runMove(PLAYER, house)
    return 'played'
  }

  /**
   * Tap during an animation to jump to the end of the move. In the live
   * start, only once one side's seeds have died: then jump ahead until you
   * have to pick again (or the start is over).
   */
  const skip = () => {
    const L = live.current
    if (L) {
      if (L.state[PLAYER] === 'pick' || liveRacing(L)) return
      clearTimers()
      for (let i = 0; i < 20000 && !togetherOver(L) && L.state[PLAYER] !== 'pick'; i++) cueLive(L, liveStep(L, true), true)
      if (togetherOver(L)) {
        finishLive()
        return
      }
      showLive(L)
      later(liveLoop, 250)
      return
    }
    if (pending.current) pending.current.finish()
  }

  // AI turn
  useEffect(() => {
    if (result || animating || phase !== 'play' || turn !== OPPONENT) return undefined
    const options = legalMoves(pits, OPPONENT, burnt).length
    const id = setTimeout(
      () => {
        const move = chooseMove(pits, OPPONENT, level, Math.random, burnt)
        if (move !== null) runMove(OPPONENT, move)
      },
      options <= 2 ? AI_THINK_QUICK : AI_THINK,
    )
    return () => clearTimeout(id)
  }, [turn, animating, phase, result, pits, burnt, level, runMove])

  const restart = useCallback(() => {
    clearTimers()
    pending.current = null
    theirOpening.current = null
    turnsThisRound.current = 0
    setPits(createBoard())
    setBurnt(createBurnt())
    live.current = null
    setYouPick(false)
    setBothAlive(false)
    setRound(1)
    setPhase('opening')
    setTurn(PLAYER)
    setAnimating(false)
    setHands([null, null])
    setMovers([])
    setFlash(null)
    setBanner(null)
    setSpeech(null)
    setResult(null)
  }, [])

  return {
    pits,
    burnt,
    round,
    phase,
    youPick,
    // seeds moving and you may skip them / hold Laju (not while both hands race)
    canSkip: animating && !bothAlive,
    turn,
    movers,
    say,
    speech,
    rivalSays,
    animating,
    hands,
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
