import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import {
  AI,
  COURT_LENGTH,
  SIZE,
  START_GAP,
  THEM,
  TIMING,
  WHY,
  YOU,
  centreOf,
  claimHouse,
  finishRound,
  freePetak,
  jitter,
  judgeThrow,
  newGame,
  nextTurn,
  petak,
  reachOf,
  route,
  throwLanding,
} from './engine'

/**
 * Runs a 1-lawan-1 game of teng-teng. The live state sits in a ref (`s`)
 * that the 3D view reads every frame; bump() re-renders the buttons.
 *
 * A turn: throw (or timbang, or the rumah throw) → hop the route → pick the
 * gundu up on the way back → next petak. A foul hands the turn over.
 */

export const now = () => performance.now() / 1000
export const START_Z = 0.3 // where you stand, behind the start line
const HOP_TIME = 0.3 // a hop in the air
const AI_PAUSE = 0.18

/** Where a foot lands for a move (between the two petak for a pair). */
export function standPoint(move) {
  const pts = move.land.map((id) => centreOf(id))
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
}

/**
 * Your timing ring pulses PULSES times: it starts wide, closes on the target,
 * opens again, closes again… Press while it's closed (green) on any pulse; if
 * all pulses pass, it's a foul.
 */
export const PULSES = 3
export function makeRing(kind, toClose, w) {
  return { kind, start: now(), half: toClose, w }
}
/** The closing moment nearest to time t. */
export function ringClose(ring, t = now()) {
  const k = Math.min(PULSES - 1, Math.max(0, Math.round(((t - ring.start) / ring.half - 1) / 2)))
  return ring.start + ring.half * (2 * k + 1)
}
/** Ring size: 3.2× wide at the start of a pulse, 1× when closed. */
export const ringScale = (ring, t = now()) => 1 + 2.2 * Math.abs(1 - (((t - ring.start) / ring.half) % 2))
const ringLife = (ring) => ring.half * (2 * PULSES - 1) + ring.w

export function useTengMatch({ level, starter, goal }) {
  const [, setV] = useState(0)
  const bump = useCallback(() => setV((v) => v + 1), [])
  const timers = useRef(new Set())
  const r = useRef(null)
  if (!r.current) {
    r.current = {
      level,
      game: { ...newGame(goal), turn: starter },
      phase: 'start', // start | aim | fly | hop | timbang | catch | dead | done
      plan: null, // { moves, turnAt, pickAt }
      step: -1, // index of the move just completed (-1 = at the start line)
      ring: null, // { kind, start, half, w } your timing ring (see makeRing)
      aim: null, // { t0, blind } while you hold the throw button
      gunduAt: null, // petak the gundu lies in (this turn)
      gunduFly: null, // { from, to, start, dur }
      gunduOnHead: false,
      balance: 0, // timbang: -1..1, falls off past ±1
      body: [
        { pos: [0, START_Z], face: Math.PI, pose: 'idle', hop: null, act: { t: -99 } },
        { pos: [1.2, -1.2], face: -Math.PI / 2, pose: 'idle', hop: null, act: { t: -99 } },
      ],
      banner: null,
      speech: null,
      clockNow: () => 0,
    }
  }
  const s = r.current

  // ?debug: expose for automated checks
  if (typeof window !== 'undefined' && window.location.search.includes('debug')) window.__teng = r

  const later = useCallback((sec, fn) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, sec * 1000)
    timers.current.add(id)
    return id
  }, [])
  const clearAll = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current.clear()
  }, [])
  useEffect(() => clearAll, [clearAll])

  // timers belong to the turn that set them: a skipped/ended turn's leftovers do nothing
  const soon = (sec, fn) => {
    const id = s.turnId
    return later(sec, () => {
      if (id === s.turnId) fn()
    })
  }

  const banner = (text, tone = 'info') => {
    s.banner = { text, tone, key: `${Math.random()}` }
    bump()
  }
  const say = (text) => {
    s.speech = { text, key: `${Math.random()}` }
    bump()
  }

  const fx = useRef({}).current
  const who = () => s.game.turn
  const pl = () => s.game.players[who()]
  const isYou = () => who() === YOU
  const me = () => s.body[who()]
  const other = () => s.body[1 - who()]
  /** One-shot reaction on the current player ('celebrate', 'fail'), timed on the 3D clock. */
  const react = (pose, kind) => {
    const body = me()
    body.pose = pose
    body.act.t = s.clockNow()
    body.act.kind = kind
  }

  // ------------------------------------------------------------ the turn
  fx.startTurn = () => {
    s.turnId = (s.turnId ?? 0) + 1
    const g = s.game
    if (g.winner !== null || g.over) return fx.finish()
    s.gunduAt = null
    s.gunduFly = null
    s.gunduOnHead = false
    s.plan = null
    s.step = -1
    s.ring = null
    // the player walks to the start line, back to the court; the other waits at the side
    Object.assign(me(), { pos: [0, START_Z], face: 0, pose: 'idle', hop: null })
    Object.assign(other(), { pos: [1.25, -1.1], face: -Math.PI / 2, pose: 'idle', hop: null })
    const stage = pl().stage
    const name = isYou() ? 'Giliran kamu' : 'Giliran Rukiah'
    banner(
      stage === 'timbang' ? `${name}: timbang!` : stage === 'rumah' ? `${name}: cari rumah!` : `${name}: petak ${pl().target}`,
      isYou() ? 'you' : 'them',
    )
    if (stage === 'timbang') {
      soon(1.2, fx.startTimbang)
      return
    }
    s.phase = 'aim'
    bump()
    if (!isYou()) soon(1.1, fx.aiThrow)
  }

  /** Throw the gundu `reach` metres from the start line (and a little sideways). */
  fx.throwTo = (reach, side) => {
    const body = me()
    body.pose = 'throwBack'
    body.act.t = s.clockNow()
    sfx.pop()
    const landingPoint = [side, -reach]
    s.gunduFly = { from: [body.pos[0] - 0.22, 1.55, body.pos[1] - 0.05], to: [landingPoint[0], 0.01, landingPoint[1]], start: now() + 0.15, dur: 0.75 }
    s.phase = 'fly'
    s.aim = null
    bump()
    soon(0.95, () => {
      sfx.seedDrop(2)
      const landing = throwLanding(reach, side)
      const verdict = judgeThrow(s.game, who(), landing)
      if (!verdict.ok) return fx.dead(verdict.why)
      if (pl().stage === 'rumah') {
        s.game = claimHouse(s.game, who(), verdict.id)
        s.gunduFly = null
        sfx.capture()
        react('celebrate')
        banner(isYou() ? `Rumah baru! Petak ${verdict.id} milik kamu.` : `Rukiah dapat rumah di petak ${verdict.id}.`, isYou() ? 'good' : 'them')
        if (!isYou()) say('Rukiah: Yeay, rumah aku!')
        soon(1.8, () => {
          s.game = nextTurn(s.game)
          fx.startTurn()
        })
        return
      }
      s.gunduAt = verdict.id
      fx.startRoute(route(s.game, who(), s.gunduAt))
    })
  }

  fx.aiThrow = () => {
    const a = AI[s.level]
    const stage = pl().stage
    let target
    if (stage === 'rumah') {
      // aim for a free petak (blind, so it's rougher)
      const free = freePetak(s.game)
      target = free[Math.floor(Math.random() * free.length)]
    } else target = pl().target
    const blind = stage === 'rumah' ? 1.6 : 1
    const [cx] = centreOf(target)
    fx.throwTo(reachOf(target) + jitter(Math.random, a.aim * SIZE * 2.2 * blind), cx + jitter(Math.random, a.aim * SIZE * blind))
  }

  // ------------------------------------------------------------ hopping
  fx.startRoute = (plan) => {
    s.plan = plan
    s.step = -1
    s.picked = false
    s.phase = 'hop'
    const body = me()
    body.face = Math.PI // facing up the court
    bump()
    fx.nextMove()
  }

  /** Set up the next move: your timing ring, or the AI's hop. */
  fx.nextMove = () => {
    const { moves, pickAt } = s.plan
    // just landed on the pick-up spot: bend for the gundu first
    if (s.step === pickAt && s.gunduAt !== null && !s.picked) return fx.askPick()
    const i = s.step + 1
    if (i >= moves.length) return fx.exitCourt()
    if (isYou()) {
      const beat = TIMING[s.level].beat
      s.ring = makeRing(moves[i].kind, beat, TIMING[s.level].w)
      s.ring.missId = soon(ringLife(s.ring), () => fx.youFoul('pijak'))
      bump()
    } else {
      soon(AI_PAUSE + 0.32, () => {
        if (Math.random() > AI[s.level].hop) return fx.dead(Math.random() < 0.5 ? 'pijak' : 'kaki-salah')
        fx.hop(i)
      })
    }
  }

  fx.hop = (i) => {
    const move = s.plan.moves[i]
    const body = me()
    const to = standPoint(move)
    const turnAround = i === s.plan.turnAt + 1
    body.hop = { from: body.pos.slice(), to, start: now(), dur: move.kind === 'langkau' ? HOP_TIME * 1.35 : HOP_TIME, high: move.kind === 'langkau' ? 0.42 : 0.26 }
    body.pose = (move.foot ?? move.kind) === 'dua' ? 'stand2' : 'stand1'
    if (turnAround) body.face = 0
    s.step = i
    soon(body.hop.dur, () => {
      body.pos = to
      body.hop = null
      sfx.footstep('dirt')
      if (i === s.plan.turnAt) body.face = 0 // turn round on the kepala
      if (s.phase === 'hop' || s.phase === 'timbang') (s.phase === 'timbang' ? fx.nextTimbangMove : fx.nextMove)()
    })
    bump()
  }

  fx.askPick = () => {
    if (isYou()) {
      const beat = TIMING[s.level].beat * 1.15
      s.ring = makeRing('ambil', beat, TIMING[s.level].w * 1.2)
      s.ring.missId = soon(ringLife(s.ring), () => fx.youFoul('ambil'))
      bump()
    } else {
      soon(0.5, () => {
        if (Math.random() > AI[s.level].pick) return fx.dead('ambil')
        fx.pickUp()
      })
    }
  }

  fx.pickUp = () => {
    const body = me()
    body.pose = 'bend'
    s.picked = true
    sfx.seedPickup()
    soon(0.45, () => {
      s.gunduAt = null
      body.pose = 'stand1'
      bump()
      fx.nextMove()
    })
    bump()
  }

  fx.exitCourt = () => {
    const body = me()
    body.hop = { from: body.pos.slice(), to: [0, START_Z], start: now(), dur: HOP_TIME, high: 0.22 }
    s.ring = null
    soon(HOP_TIME, () => {
      body.pos = [0, START_Z]
      body.hop = null
      react('celebrate')
      s.picked = false
      const stage = pl().stage
      s.game = finishRound(s.game, who())
      sfx.extraTurn()
      if (stage === 'petak') banner(isYou() ? `Cantik! Seterusnya petak ${pl().stage === 'timbang' ? '– timbang!' : pl().target}` : 'Rukiah lepas satu petak.', isYou() ? 'good' : 'them')
      // a clean round: keep going (same turn)
      soon(1.3, () => {
        body.pose = 'idle'
        if (pl().stage === 'timbang') return fx.startTimbang()
        s.phase = 'aim'
        s.gunduAt = null
        body.face = 0
        bump()
        if (!isYou()) soon(0.9, fx.aiThrow)
      })
    })
    bump()
  }

  // ------------------------------------------------------------ timbang
  fx.startTimbang = () => {
    s.phase = 'timbang'
    s.gunduOnHead = true
    s.balance = 0
    s.gunduAt = null
    s.plan = route(s.game, who(), null)
    s.plan.pickAt = null
    s.step = -1
    me().face = Math.PI
    me().pose = 'balance'
    banner(isYou() ? 'Timbang! Gundu atas kepala, jaga imbangan.' : 'Rukiah timbang…', isYou() ? 'you' : 'them')
    bump()
    soon(1.2, fx.nextTimbangMove)
  }

  fx.nextTimbangMove = () => {
    const i = s.step + 1
    if (i >= s.plan.moves.length) return fx.startCatch()
    if (!isYou() && i === Math.floor(s.plan.moves.length / 2) && Math.random() > Math.sqrt(AI[s.level].timbang)) return fx.dead('jatuh')
    soon(0.3, () => {
      if (s.phase !== 'timbang') return
      fx.hop(i)
      me().pose = 'balance'
    })
  }

  fx.startCatch = () => {
    s.phase = 'catch'
    me().pose = 'bend'
    if (isYou()) {
      const beat = 0.75
      s.ring = makeRing('sambut', beat, TIMING[s.level].w * 1.1)
      s.ring.missId = soon(ringLife(s.ring), () => fx.youFoul('sambut'))
      bump()
    } else {
      soon(0.7, () => {
        if (Math.random() > Math.sqrt(AI[s.level].timbang)) return fx.dead('sambut')
        fx.caught()
      })
    }
  }

  fx.caught = () => {
    s.gunduOnHead = false
    s.game = finishRound(s.game, who())
    sfx.extraTurn()
    banner(isYou() ? 'Timbang lulus! Sekarang baling cari rumah.' : 'Rukiah lulus timbang.', isYou() ? 'good' : 'them')
    react('celebrate')
    soon(1.2, () => {
      Object.assign(me(), { pos: [0, START_Z], face: 0, pose: 'idle', hop: null })
      s.phase = 'aim'
      bump()
      if (!isYou()) soon(1, fx.aiThrow)
    })
  }

  // ------------------------------------------------------------ fouls and the end
  fx.youFoul = (why) => {
    if (s.ring) window.clearTimeout(s.ring.missId)
    s.ring = null
    fx.dead(why)
  }

  fx.dead = (why) => {
    s.phase = 'dead'
    s.ring = null
    s.gunduOnHead = false
    s.picked = false
    me().hop = null
    react('fail', why)
    sfx.locked()
    banner(`Mati! ${WHY[why] ?? ''}`, isYou() ? 'bad' : 'them')
    if (!isYou()) say('Rukiah: Alaa…')
    soon(2, () => {
      s.game = nextTurn(s.game)
      s.gunduFly = null
      fx.startTurn()
    })
  }

  fx.finish = () => {
    s.phase = 'done'
    s.ring = null
    const w = s.game.winner
    s.result = { winner: w, houses: [0, 1].map((p) => Object.values(s.game.houses).filter((h) => h === p).length) }
    if (w === YOU) sfx.win()
    else if (w === THEM) sfx.lose()
    else sfx.draw()
    bump()
  }

  // timbang balance: drifts and grows unless you correct it
  useEffect(() => {
    let last = now()
    const id = window.setInterval(() => {
      const t = now()
      const dt = Math.min(0.1, t - last)
      last = t
      if (s.phase !== 'timbang' || !isYou()) return
      const drift = { mudah: 0.55, biasa: 0.75, pakar: 1 }[s.level]
      s.balance += (s.balance * 1.1 + (Math.random() - 0.5) * 2.2) * drift * dt
      if (Math.abs(s.balance) >= 1) fx.dead('jatuh')
      bump()
    }, 50)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    later(0.6, fx.startTurn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------ your input
  /** Hold the throw button: the aim marker runs up and down the court. */
  const holdThrow = useCallback(() => {
    if (s.phase !== 'aim' || !isYou() || s.aim) return
    s.aim = { t0: now(), blind: pl().stage === 'rumah' }
    bump()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Release: throw where the marker is (plus a little wobble). */
  const releaseThrow = useCallback(() => {
    if (s.phase !== 'aim' || !isYou() || !s.aim) return
    const reach = aimReach(s.aim.t0, AIM_LAP[s.level])
    const noise = TIMING[s.level].aimNoise * (s.aim.blind ? 1.5 : 1)
    // sideways the gundu goes towards the petak you're aiming for (a pair's left or right);
    // the blind rumah throw could go anywhere across the court
    const side = s.aim.blind ? (Math.random() - 0.5) * SIZE * 1.1 : centreOf(pl().target)[0]
    fx.throwTo(reach + jitter(Math.random, noise * SIZE), side + jitter(Math.random, noise * SIZE * 0.5))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Tap a hop button ('sebelah' | 'dua' | 'langkau'), 'ambil' or 'sambut'. */
  const press = useCallback((kind) => {
    const ring = s.ring
    if (!ring || !isYou()) return 'wait'
    const d = now() - ringClose(ring)
    // a press well before the first close is ignored (finger slipped early)
    if (now() - ring.start < ring.half - 0.55) return 'early'
    window.clearTimeout(ring.missId)
    s.ring = null
    if (Math.abs(d) > ring.w) {
      fx.youFoul(ring.kind === 'ambil' ? 'ambil' : ring.kind === 'sambut' ? 'sambut' : 'pijak')
      return 'miss'
    }
    if (ring.kind === 'ambil') {
      if (kind !== 'ambil') return fx.youFoul('ambil')
      return fx.pickUp()
    }
    if (ring.kind === 'sambut') {
      if (kind !== 'sambut') return fx.youFoul('sambut')
      return fx.caught()
    }
    if (kind !== ring.kind) {
      // explain what the petak needed
      const move = s.plan.moves[s.step + 1]
      const why = ring.kind === 'langkau' ? (s.gunduAt && petak(s.gunduAt).row < move.row ? 'pijak-gundu' : 'pijak-rumah') : 'kaki-salah'
      return fx.youFoul(why)
    }
    s.lastGood = { perfect: Math.abs(d) < 0.06, key: Math.random() }
    fx.hop(s.step + 1)
    return 'ok'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Timbang: lean left / right to keep the gundu on your head. */
  const lean = useCallback((dir) => {
    if (s.phase !== 'timbang') return
    s.balance -= dir * 0.32
    bump()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Skip the rest of Rukiah's turn: play it out instantly. */
  const skip = useCallback(() => {
    if (isYou() || s.phase === 'done' || s.phase === 'dead') return
    clearAll()
    const a = AI[s.level]
    let g = s.game
    let alive = true
    let rounds = 0
    let houseLine = ''
    while (alive && g.winner === null && !g.over && rounds < 12) {
      const p = g.players[THEM]
      if (p.stage === 'petak') {
        const okThrow = Math.random() < 0.82 + (0.13 - a.aim) * 0.8
        const hops = route(g, THEM, p.target).moves.length
        alive = okThrow && Math.random() < a.hop ** hops * a.pick
        if (alive) g = finishRound(g, THEM)
      } else if (p.stage === 'timbang') {
        alive = Math.random() < a.timbang
        if (alive) g = finishRound(g, THEM)
      } else {
        const free = freePetak(g)
        alive = Math.random() < 0.7
        if (alive) {
          const id = free[Math.floor(Math.random() * free.length)]
          g = claimHouse(g, THEM, id)
          houseLine = ` Rukiah dapat rumah di petak ${id}!`
          alive = false // the turn ends after a rumah
          g = nextTurn(g)
          s.game = g
          banner(`Rukiah habis bermain.${houseLine}`, 'them')
          return later(1.4, fx.startTurn)
        }
      }
      rounds++
    }
    s.game = nextTurn(g)
    banner(`Rukiah mati.${houseLine}`, 'them')
    later(1.2, fx.startTurn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (typeof window !== 'undefined' && window.location.search.includes('debug')) window.__tengApi = { holdThrow, releaseThrow, press, lean, skip }
  return { r, s, holdThrow, releaseThrow, press, lean, skip }
}

/** Seconds for the aim marker to run up the court and back. */
export const AIM_LAP = { mudah: 3.2, biasa: 2.6, pakar: 2.0 }

/** The power meter's range: from the bottom of petak 1 to the top of petak 9. */
export const AIM_MIN = START_GAP
export const AIM_MAX = COURT_LENGTH

/** Power 0..1 while holding: min to max, then back down to min. */
export function aimPower(t0, lap = 2.6) {
  const p = ((now() - t0) / lap) % 1
  return p < 0.5 ? p * 2 : 2 - p * 2
}

/** Distance from the start line the gundu would go at that power. */
export const reachForPower = (u) => AIM_MIN + u * (AIM_MAX - AIM_MIN)
export const powerForReach = (reach) => (reach - AIM_MIN) / (AIM_MAX - AIM_MIN)

/** Aim distance while holding. */
export function aimReach(t0, lap = 2.6) {
  return reachForPower(aimPower(t0, lap))
}
