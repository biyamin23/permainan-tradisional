import { raceSfx, setMusicPace, sfx } from '../../audio/engine'
import { makeKamarulAI, thinkKamarul } from './kamarulAI'
import { createKamarulVoice } from './kamarulVoice'
import { checkProgress, makeRacer, placeObstacles, progressOf, separate, stepRacer, updateObstacles } from './raceSim'

/**
 * One race from the starting grid to the result:
 *
 *   pre (both on the line, Kamarul has a word) → count (3, 2, 1, JOM!)
 *   → race (checkpoints, final stretch) → finish (winner crosses, the other
 *   comes in, reactions) → done
 *
 * Owns the sim, Kamarul's brain and voice; the screen reads `race` every
 * frame and gets the moments worth showing through `onEvent`.
 */

const PRE_SECONDS = 3.4
const COUNT_SECONDS = 3
const WAIT_FOR_LOSER = 9 // after the winner crosses, how long the other gets to come in
const AFTER_BOTH = 3.2 // celebration before the result screen

export function createRace({ track, playerBike, kamarulBike, kamarulLevel, onEvent }) {
  const obstacles = placeObstacles(track, track.def.obstacles)
  const you = makeRacer(track, playerBike, 1.1, 'you')
  const kamarul = makeRacer(track, kamarulBike, -1.1, 'kamarul')
  const ai = makeKamarulAI(track, kamarulLevel)
  const voice = createKamarulVoice()
  const race = {
    track,
    obstacles,
    you,
    kamarul,
    ai,
    phase: 'pre',
    phaseT: 0,
    time: 0, // race clock (starts at JOM!)
    clock: 0, // everything else (moving obstacles, camera)
    paused: false,
    holdPre: false, // the tutorial is open: wait on the line
    count: 3,
    winner: null,
    nearT: 0,
    leader: null,
    finishedAt: 0,
  }

  const say = (event) => {
    const words = voice.say(event, race.clock)
    if (words) onEvent({ type: 'say', words })
  }
  const setPhase = (p) => {
    race.phase = p
    race.phaseT = 0
  }

  race.step = (dt, input) => {
    if (race.paused) return
    race.clock += dt
    race.phaseT += dt
    updateObstacles(track, obstacles, race.clock)
    const racing = race.phase === 'race' || race.phase === 'finish'

    if (race.phase === 'pre') {
      if (race.phaseT > 0.6 && race.phaseT < 1) say('PRE_RACE')
      if (race.phaseT > PRE_SECONDS && !race.holdPre) {
        setPhase('count')
        race.count = 3
        raceSfx.count()
        onEvent({ type: 'count', n: 3 })
      }
    } else if (race.phase === 'count') {
      const n = 3 - Math.floor(race.phaseT / (COUNT_SECONDS / 3))
      if (n !== race.count) {
        race.count = n
        if (n > 0) {
          raceSfx.count()
          onEvent({ type: 'count', n })
        } else {
          raceSfx.go()
          raceSfx.bell()
          onEvent({ type: 'count', n: 0 })
          setPhase('race')
          say('RACE_START')
        }
      }
    }

    // ----- ride
    const yourInput = racing && !you.finished ? input : IDLE
    stepRacer(track, you, yourInput, dt, obstacles, race.clock)
    const kInput = thinkKamarul(ai, track, kamarul, you, obstacles, race.time, dt, racing)
    stepRacer(track, kamarul, kInput, dt, obstacles, race.clock)
    const contact = separate(you, kamarul, ai.state === 'BUMP' ? kamarul : null)
    if (contact && race.clock - (race.lastBump ?? -9) > 1.2) {
      race.lastBump = race.clock
      raceSfx.knock(contact === 'shove')
    }
    if (racing) race.time += dt
    if (racing) {
      checkProgress(track, you, race.time)
      checkProgress(track, kamarul, race.time)
    }

    // ----- moments
    for (const e of you.events) {
      if (e === 'hit' || e === 'stun' || e === 'fall') {
        raceSfx.knock(e !== 'hit')
        if (you.lastHit === 'ayam') raceSfx.chicken()
        if (you.lastHit === 'motosikal') raceSfx.horn()
        onEvent({ type: 'hit', who: 'you', big: e !== 'hit', fall: e === 'fall', what: you.lastHit })
        if (e !== 'hit') say('PLAYER_CRASH')
      }
      if (e === 'shoved') {
        onEvent({ type: 'shoved' })
        say('KAMARUL_BUMP')
      }
      if (e === 'splash') raceSfx.splash()
      if (e === 'checkpoint') {
        raceSfx.checkpoint()
        onEvent({ type: 'checkpoint', n: you.nextCp, of: track.checkpoints.length })
      }
      if (e === 'final') {
        setMusicPace(1.3)
        onEvent({ type: 'final' })
        say(progressOf(track, kamarul) > progressOf(track, you) ? 'FINAL_STRETCH' : 'FINAL_STRETCH_BEHIND')
      }
    }
    for (const e of kamarul.events) {
      if (e === 'hit' || e === 'stun' || e === 'fall') {
        if (kamarul.lastHit === 'ayam') raceSfx.chicken()
        say('KAMARUL_CRASH')
        onEvent({ type: 'hit', who: 'kamarul', big: e !== 'hit', fall: e === 'fall', what: kamarul.lastHit })
      }
    }

    if (race.phase === 'race') {
      // who leads, and changes of lead
      const gap = progressOf(track, you) - progressOf(track, kamarul)
      const leader = gap > 1.2 ? 'you' : gap < -1.2 ? 'kamarul' : race.leader
      if (leader !== race.leader && race.leader !== null && race.time > 4) {
        onEvent({ type: 'lead', who: leader })
        say(leader === 'you' ? 'PLAYER_OVERTAKE' : 'KAMARUL_OVERTAKE')
      }
      race.leader = leader
      // you sitting right on his wheel
      if (gap < 0 && gap > -4) race.nearT += dt
      else race.nearT = 0
      if (race.nearT > 2.5) say('PLAYER_NEAR')

      // first across the line
      const first = you.finished ? you : kamarul.finished ? kamarul : null
      if (first) {
        race.winner = first.name
        race.finishedAt = race.time
        setPhase('finish')
        sfx.extraTurn()
        onEvent({ type: 'winner', who: first.name })
        if (first === kamarul) say('KAMARUL_WIN')
        else say('KAMARUL_LOSE')
      }
    } else if (race.phase === 'finish') {
      const both = you.finished && kamarul.finished
      if (!both && race.phaseT > WAIT_FOR_LOSER) {
        // too far back to wait for: time them in at their pace
        for (const r of [you, kamarul]) {
          if (r.finished) continue
          r.finished = true
          r.finishTime = race.time + Math.max(0, track.L - progressOf(track, r)) / Math.max(4, r.speed)
        }
      }
      if (you.finished && kamarul.finished && race.bothAt === undefined) {
        race.bothAt = race.phaseT
        onEvent({ type: 'both' })
      }
      if (race.bothAt !== undefined && race.phaseT - race.bothAt > AFTER_BOTH) {
        setPhase('done')
        setMusicPace(1)
        onEvent({ type: 'done' })
      }
    }
  }

  race.sayRematch = () => {
    const words = voice.say('REMATCH', race.clock + 100)
    if (words) onEvent({ type: 'say', words })
  }
  race.dispose = () => setMusicPace(1)
  return race
}

const IDLE = { throttle: 0, brake: 0, steer: 0, boost: false }
