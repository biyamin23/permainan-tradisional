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
import { flipBoard, flipPos, replay, sideOfSeat } from './online'

// One steady pace for every move, however long the relay chain.
// Holding the Laju button doubles it while held (tap the board to skip to the end).
export const STEP_MS = 380
const AI_THINK = 1100
const AI_THINK_QUICK = 550 // only one or two kampung to choose from
const AI_PICK_TICKS = 2 // in the live start, Aisyah picks again this many seeds after reaching her rumah
const MAX_TURNS = 300 // a pusingan that somehow never ends is called after this (same in online.js)
const READY_EVERY_MS = 1500 // online: say again that you've picked, until the start begins

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
 *
 * Online (`net` from useNetMatch), the other side is your friend (`them`):
 * your goes are recorded as you make them and theirs are played as they
 * arrive (online.js has the record). At the start of a pusingan you both pick
 * a kampung; the host (seat 0) then runs the simultaneous start, the friend's
 * picks go to the host, and every tick the host sends the board, which the
 * friend's screen follows. The host records the end of it.
 */
export function useCongkakMatch({ level, net = null, them = 'Aisyah' }) {
  const online = Boolean(net)
  const seat = net?.seat ?? 0
  const isHost = online && seat === 0
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
  const rivalSays = useCallback((text) => {
    if (!online) setSpeech({ text, key: Math.random() })
  }, [online])

  const announceCapture = useCallback(
    (e, quiet = false) => {
      setFlash({ pits: [e.pit, e.opposite, e.store], key: Math.random() })
      if (e.side === PLAYER) {
        say(`Tembak! +${e.count} guli untuk kamu`, 'good')
        rivalSays('Alamak, habis biji aku!')
      } else {
        say(`${them} tembak! ${e.count} guli masuk rumah dia`, 'bad')
        rivalSays(`Tembak! ${e.count} biji kamu aku ambil.`)
      }
      if (!quiet) sfx.capture()
    },
    [say, rivalSays, them],
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
        const who = nr.conceded.length === 2 ? 'Kedua-dua pihak' : nr.conceded[0] === PLAYER ? 'Kamu' : them
        say(`${who} tak cukup guli untuk mengisi kampung. Permainan tamat!`, 'info')
        later(() => finishMatch(nr.pits, burntNow, roundNow), 1600)
        return
      }
      const newly = [PLAYER, OPPONENT].map((s) => burntCount(nr.burnt, s) - burntCount(burntNow, s))
      const burntLine = newly.some((n) => n > 0) ? ` Terbakar: kamu ${newly[0]}, ${them} ${newly[1]}.` : ''
      say(`Pusingan ${roundNow + 1}! Isi semula kampung.${burntLine}`, 'info')
      later(() => {
        setPits(nr.pits)
        setBurnt(nr.burnt)
        setRound(roundNow + 1)
        if (newly[0] > 0) rivalSays(`Kampung kamu terbakar ${newly[0]}!`)
        else if (newly[1] > 0) rivalSays('Alamak, kampung aku terbakar…')
        theirOpening.current = null
        turnsThisRound.current = 0
        setMyOpening(null)
        setFriendReady(false)
        friendOpening.current = null
        setPhase('opening')
        setTurn(PLAYER)
      }, 1800)
    },
    [say, rivalSays, finishMatch, them],
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
        if (wanted === PLAYER) say(`Kampung kamu kosong. Giliran ${them}.`, 'them')
        else say(`Kampung ${them} kosong. Giliran kamu lagi!`, 'good')
      } else if (carriesOn) {
        if (side === PLAYER) say('Masuk rumah! Kamu main lagi.', 'good')
        else {
          say(`${them} masuk rumah, dia main lagi.`, 'them')
          rivalSays('Masuk rumah! Aku main lagi.')
        }
      }
    },
    [say, rivalSays, endRound, them],
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
      if (net && side === PLAYER) net.send({ type: 'move', house: flipPos(seat, house) })
      const roundNow = round
      const burntNow = burnt
      animate(pits, outcome.events, () => {
        setPits(outcome.pits)
        advance(outcome.pits, burntNow, roundNow, side, outcome.extraTurn)
      })
    },
    [pits, burnt, round, animate, advance, net, seat],
  )

  // ---- the start of a pusingan, played live: both hands sow at once, and a
  // side back in its rumah picks up another kampung straight away
  const live = useRef(null) // engine live state + { round, aiAt }
  const [youPick, setYouPick] = useState(false) // you're back in your rumah mid-start: pick again now
  // while both hands are still alive the race is on: no skipping, no Laju
  const [bothAlive, setBothAlive] = useState(false)
  // in the start: whose seeds have died ([you, them])
  const [dead, setDead] = useState([false, false])
  const liveRacing = (L) => !L.state.includes('dead')
  const levelRef = useRef(level)
  levelRef.current = level
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  // online: the kampung you picked to start with, whether your friend has picked,
  // their pick (host), the start as last seen from the host (friend)
  const [myOpening, setMyOpening] = useState(null)
  const [friendReady, setFriendReady] = useState(false)
  const friendOpening = useRef(null)
  const follow = useRef(null) // { round, t, state }
  const now = useRef({})
  now.current = { pits, burnt, round, phase, myOpening, result }

  /** Host: send the live board (as the host sees it, which is how it's stored). */
  const sendLive = (L, events) => {
    if (!isHost) return
    net.signal('snap', {
      round: L.round,
      t: L.t,
      pits: L.pits,
      hands: L.hands.map((h) => (h ? { pos: h.pos, hand: h.hand } : null)),
      state: L.state,
      events,
    })
  }

  /** Put the live board on screen: seeds, both hands, whether you can pick. */
  const showLive = useCallback((L) => {
    setPits(L.pits.slice())
    setHands(L.hands.map((h, side) => (h ? { pit: h.pos, count: h.hand, side, tick: `${L.t}-${side}` } : null)))
    setMovers([PLAYER, OPPONENT].filter((s) => L.hands[s]))
    setYouPick(L.state[PLAYER] === 'pick')
    setBothAlive(liveRacing(L))
    setDead([L.state[PLAYER] === 'dead', L.state[OPPONENT] === 'dead'])
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

  /** One tick; Aisyah picks up another kampung a moment after reaching her rumah (online: your friend's pick, if one came). */
  const liveStep = (L, quiet) => {
    const events = tickTogether(L)
    if (online) {
      const h = L.remotePick
      L.remotePick = null
      if (L.state[OPPONENT] === 'pick' && h != null && h >= 8 && h <= 14 && !L.burnt[h] && L.pits[h] > 0) {
        events.push(...pickTogether(L, OPPONENT, h))
      }
      return events
    }
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
    if (isHost) {
      sendLive(L, [])
      net.send({ type: 'together', round: L.round, pits: L.pits, first: firstAfterTogether(L) })
    }
    advanceRef.current(L.pits, L.burnt, L.round, 1 - firstAfterTogether(L), false)
  }

  const liveLoop = () => {
    const L = live.current
    if (!L) return
    if (togetherOver(L)) {
      finishLive()
      return
    }
    const events = liveStep(L, false)
    const wait = cueLive(L, events, false)
    showLive(L)
    sendLive(L, events)
    later(liveLoop, wait / (fastRef.current && !liveRacing(L) && !online ? 2 : 1))
  }

  /** The start of a pusingan: your kampung and Aisyah's (or your friend's), sown together. */
  const startLive = (house, theirHouse = null) => {
    const theirs = theirHouse ?? theirOpening.current ?? chooseMove(pits, OPPONENT, level, Math.random, burnt)
    const { live: L, events } = startTogether(pits, burnt, house, theirs)
    live.current = Object.assign(L, { round, aiAt: null, remotePick: null })
    setPhase('together')
    setAnimating(true)
    // keep a message the player has only just been shown
    setBanner((b) => (b && Date.now() - b.at < 1800 ? b : null))
    rivalSays('Satu, dua, tiga… mula!')
    const wait = cueLive(L, events, false)
    showLive(L)
    sendLive(L, events)
    later(liveLoop, wait)
  }

  /** Back in your rumah during the start: take up another kampung at once. */
  const pickLive = (house) => {
    const L = live.current
    if (L.pits[house] === 0) return 'empty'
    sfx.tap()
    const events = pickTogether(L, PLAYER, house)
    cueLive(L, events, false)
    showLive(L)
    sendLive(L, events)
    return 'played'
  }

  // ---- online: the friend's screen follows the host's live start

  /** The host's live board, turned round for this screen. */
  const followLive = (snap) => {
    const f = follow.current
    if (f && f.round === snap.round && snap.t < f.t) return // an old one, arriving late
    const state = [snap.state[1], snap.state[0]]
    follow.current = { round: snap.round, t: snap.t, state }
    const flipSide = (s) => sideOfSeat(seat, s)
    const events = snap.events.map((e) => ({
      ...e,
      side: flipSide(e.side),
      pit: e.pit != null ? flipPos(seat, e.pit) : e.pit,
      opposite: e.opposite != null ? flipPos(seat, e.opposite) : e.opposite,
      store: e.store != null ? flipPos(seat, e.store) : e.store,
    }))
    if (now.current.phase !== 'together') {
      setPhase('together')
      setAnimating(true)
      setBanner((b) => (b && Date.now() - b.at < 1800 ? b : null))
    }
    cueLive({ state }, events, false)
    setPits(flipBoard(seat, snap.pits))
    const hands = [snap.hands[1], snap.hands[0]]
    setHands(hands.map((h, side) => (h ? { pit: flipPos(seat, h.pos), count: h.hand, side, tick: `${snap.t}-${side}` } : null)))
    setMovers([PLAYER, OPPONENT].filter((s) => hands[s]))
    setYouPick(state[PLAYER] === 'pick')
    setBothAlive(!state.includes('dead'))
    setDead([state[PLAYER] === 'dead', state[OPPONENT] === 'dead'])
  }

  /** The host recorded the end of the start: carry on from the board it ended with. */
  const endFollow = (move) => {
    follow.current = null
    setHands([null, null])
    setMovers([])
    setYouPick(false)
    setBothAlive(false)
    setAnimating(false)
    const board = flipBoard(seat, move.pits)
    setPits(board)
    setPhase('play')
    advanceRef.current(board, now.current.burnt, move.round, 1 - sideOfSeat(seat, move.first), false)
  }

  /** Host: both of you have picked: go. */
  const tryStart = () => {
    const c = now.current
    if (!isHost || c.phase !== 'opening' || c.myOpening === null || friendOpening.current === null) return
    const h = friendOpening.current
    if (h < 8 || h > 14 || c.burnt[h] || c.pits[h] === 0) return
    startLive(c.myOpening, h)
  }

  // live messages from your friend
  useEffect(() => {
    if (!net) return undefined
    return net.onSignal((name, data) => {
      const c = now.current
      if (name === 'ready' && data.round === c.round && c.phase === 'opening') {
        setFriendReady(true)
        if (isHost) {
          friendOpening.current = flipPos(seat, data.house)
          tryStart()
        }
      } else if (name === 'pick' && isHost && live.current && data.round === live.current.round) {
        live.current.remotePick = flipPos(seat, data.house)
      } else if (name === 'snap' && !isHost && data.round === c.round && (c.phase === 'opening' || c.phase === 'together')) {
        followLive(data)
      } else if (name === 'reset' && !isHost && data.round === c.round && c.phase === 'together') {
        // the host reloaded during the start: start this pusingan again
        follow.current = null
        rebuild()
      }
    })
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // until the start begins, keep telling your friend you've picked (a message can get lost)
  useEffect(() => {
    if (!net || phase !== 'opening' || myOpening === null) return undefined
    const sendReady = () => net.signal('ready', { round, house: flipPos(seat, myOpening) })
    sendReady()
    tryStart()
    const id = setInterval(sendReady, READY_EVERY_MS)
    return () => clearInterval(id)
  }, [net, phase, myOpening, round, seat]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- online: the record (rebuild after a reload, then your friend's goes as they come)
  const played = useRef(0)
  const rebuilt = useRef(false)

  const rebuild = () => {
    let state
    try {
      state = replay(net.moves, seat)
    } catch (e) {
      console.warn('[congkak] record', e.message)
      return
    }
    played.current = net.moves.length
    clearTimers()
    pending.current = null
    live.current = null
    follow.current = null
    turnsThisRound.current = state.turns
    setPits(state.pits)
    setBurnt(state.burnt)
    setRound(state.round)
    setHands([null, null])
    setMovers([])
    setYouPick(false)
    setBothAlive(false)
    setAnimating(false)
    setMyOpening(null)
    setFriendReady(false)
    friendOpening.current = null
    if (state.phase === 'over') {
      setPhase('over')
      setResult(state.result)
    } else {
      setPhase(state.phase)
      if (state.turn !== null) setTurn(state.turn)
    }
    // the host may have been in the middle of the start: tell the friend to begin it again
    if (isHost && state.phase === 'opening') net.signal('reset', { round: state.round })
  }

  const netMoves = net?.moves
  const netLoaded = net?.loaded
  useEffect(() => {
    if (!netLoaded || rebuilt.current) return
    rebuilt.current = true
    rebuild()
  }, [netLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!net || !rebuilt.current || result) return
    const entry = netMoves[played.current]
    if (!entry) return
    if (entry.seat === seat) {
      played.current += 1 // one of ours: already played here
      return
    }
    const { move } = entry
    if (move.type === 'together') {
      if (phase !== 'opening' && phase !== 'together') return
      played.current += 1
      endFollow(move)
    } else if (move.type === 'move') {
      if (phase !== 'play' || turn !== OPPONENT || animating) return
      played.current += 1
      const house = flipPos(seat, move.house)
      if (house < 8 || house > 14 || burnt[house] || pits[house] === 0) {
        console.warn('[congkak] friend sent a move that is not legal here', entry.seq)
        return
      }
      runMove(OPPONENT, house)
      // more of their goes already waiting: don't fall behind, show this one finished
      if (netMoves.length > played.current) pending.current?.finish()
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // Aisyah picks her opening kampung as soon as a pusingan is ready
  useEffect(() => {
    if (online) return
    if (phase === 'opening' && theirOpening.current === null) theirOpening.current = chooseMove(pits, OPPONENT, level, Math.random, burnt)
  }, [online, phase, pits, burnt, level])

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
      if (online) {
        // online you both pick first; the start begins when both have
        if (myOpening !== null) return 'busy'
        setMyOpening(house)
        return 'played'
      }
      startLive(house)
      return 'played'
    }
    if (phase === 'together') {
      if (online && !isHost) {
        const f = follow.current
        const state = f?.state[PLAYER]
        if (state !== 'pick') return state === 'dead' ? 'wait' : 'busy'
        if (pits[house] === 0) return 'empty'
        sfx.tap()
        f.state[PLAYER] = 'sent'
        setYouPick(false)
        net.signal('pick', { round: f.round, house: flipPos(seat, house) })
        return 'played'
      }
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
    if (online) return // online there's no skipping: both of you see every go
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
    if (online || result || animating || phase !== 'play' || turn !== OPPONENT) return undefined
    const options = legalMoves(pits, OPPONENT, burnt).length
    const id = setTimeout(
      () => {
        const move = chooseMove(pits, OPPONENT, level, Math.random, burnt)
        if (move !== null) runMove(OPPONENT, move)
      },
      options <= 2 ? AI_THINK_QUICK : AI_THINK,
    )
    return () => clearTimeout(id)
  }, [online, turn, animating, phase, result, pits, burnt, level, runMove])

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
    // seeds moving and you may hold Laju (not while both hands race; online, not in the start at all)
    canFast: animating && !bothAlive && !(online && phase === 'together'),
    // tap the board to jump to the end of a move: never online (both screens play every go in full)
    canSkip: animating && !bothAlive && !online,
    // online: the kampung you picked to start with (waiting for your friend), and whether they've picked
    myOpening,
    friendReady,
    dead,
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
