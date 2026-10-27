import { progressOf } from './raceSim'

/**
 * KamarulRaceAI: the kampung's jaguh basikal. He rides his own racing line
 * (cutting to the inside of bends, wide on the way in), slows for corners,
 * goes round you when you're in his way, sits in front of you when you're
 * close behind, dodges what he sees on the road, pecut-s in the final
 * stretch, takes shortcuts when he's good enough, and now and then makes a
 * small mistake. He presses the same virtual keys you do.
 *
 * He also plays rough: side by side with you, he leans in and himpit-s you
 * (BUMP) to shove you off his line, more often the harder the litar.
 *
 * States: START → ACCELERATE → FOLLOW_ROUTE ⇄ OVERTAKE / DEFEND / BUMP /
 *         AVOID_OBSTACLE / RECOVER → FINAL_STRETCH → FINISH → CELEBRATE | LOSE
 */

export function makeKamarulAI(track, level) {
  // his racing line: lateral offset per sample, inside of each bend, eased in early
  const n = track.n
  const line = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let c = 0
    for (let k = 4; k <= 16; k++) c += track.curv[track.wrap(i + k)]
    c /= 13
    const room = track.width[i] / 2 - 0.7
    line[i] = Math.max(-room, Math.min(room, c * 26 * room))
  }
  // smooth it so he doesn't zig-zag
  const smooth = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = -6; k <= 6; k++) s += line[track.wrap(i + k)]
    smooth[i] = s / 13
  }
  return {
    level,
    line: smooth,
    state: 'START',
    stateT: 0,
    offset: 0, // extra lateral offset from the line (overtaking, dodging, mistakes)
    offsetTarget: 0,
    mistake: 0,
    mistakeT: 0,
    goAt: null,
    bumpT: 0, // > 0 while he's leaning into you
    bumpCooldown: 3,
    shoves: 0, // this race; capped by level so it stays rough, not a wrestling match
    seen: {}, // obstacle:lap → whether he noticed it in time
    takeShortcut: track.shortcuts.map(() => Math.random() < level.shortcut),
    input: { throttle: 0, brake: 0, steer: 0, boost: false },
  }
}

const angleDiff = (a, b) => {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

const setState = (ai, s) => {
  if (ai.state !== s) {
    ai.state = s
    ai.stateT = 0
  }
}

/** Decide this frame's keys. `me` is Kamarul's racer, `you` the player's. */
export function thinkKamarul(ai, track, me, you, obstacles, time, dt, racing) {
  const lv = ai.level
  const inp = ai.input
  ai.stateT += dt
  inp.boost = false

  if (!racing) {
    inp.throttle = 0
    inp.brake = 1
    inp.steer = 0
    return inp
  }
  if (me.finished) {
    setState(ai, you.finished && you.finishTime < me.finishTime ? 'LOSE' : 'CELEBRATE')
    inp.throttle = 0
    inp.steer = 0
    return inp
  }
  // reaction time off the line
  if (ai.goAt === null) ai.goAt = time + lv.reaction * (0.7 + Math.random() * 0.6)
  if (time < ai.goAt) {
    inp.throttle = 0
    return inp
  }

  const myProg = progressOf(track, me)
  const yourProg = progressOf(track, you)
  const gap = yourProg - myProg // + = you are ahead
  const latGap = you.lat - me.lat

  // ----- himpit: side by side, he leans in to shove you off his line
  ai.bumpCooldown -= dt
  ai.bumpT -= dt
  const alongside = Math.abs(gap) < 2.4 && Math.abs(latGap) < 2.6 && you.fallT <= 0 && me.fallT <= 0 && !you.finished
  const maxShoves = Math.round(1 + lv.aggression * 4)
  if (alongside && ai.shoves < maxShoves && ai.bumpT <= 0 && ai.bumpCooldown <= 0 && Math.random() < lv.aggression * dt * 2.5) {
    ai.shoves++
    ai.bumpT = 1.1 + Math.random() * 0.6
    ai.bumpCooldown = 4 + Math.random() * 4 - lv.aggression * 1.5
  }
  // one good shove is enough; then back to racing
  if (you.events.includes('shoved') || you.fallT > 0) ai.bumpT = Math.min(ai.bumpT, 0)
  if (!alongside) ai.bumpT = Math.min(ai.bumpT, 0.2)

  // ----- choose a state
  if (me.stun > 0 || me.fallT > 0 || (ai.state === 'RECOVER' && ai.stateT < 0.7)) setState(ai, 'RECOVER')
  else if (ai.bumpT > 0) setState(ai, 'BUMP')
  else {
    // something in the road comes first, even with the line in sight
    const threat = obstacleAhead(ai, track, me, obstacles)
    if (threat) {
      setState(ai, 'AVOID_OBSTACLE')
      ai.offsetTarget = threat.side - ai.line[me.i]
    } else if (me.final) setState(ai, 'FINAL_STRETCH')
    else if (me.speed < me.bike.maxSpeed * 0.55 && ai.state !== 'OVERTAKE') setState(ai, 'ACCELERATE')
    else if (gap > 0 && gap < 7 && Math.abs(latGap) < 1.4) setState(ai, 'OVERTAKE')
    else if (gap < 0 && gap > -6 && lv.catchUp >= 1) setState(ai, 'DEFEND')
    else setState(ai, 'FOLLOW_ROUTE')
  }

  // ----- lateral plan
  const half = track.width[me.i] / 2 - 0.6
  if (ai.state === 'OVERTAKE') {
    // go round on whichever side has more road
    const side = you.lat > 0 ? -1 : 1
    ai.offsetTarget = side * Math.min(half, 1.6) - ai.line[me.i] + you.lat * 0.3
  } else if (ai.state === 'DEFEND') {
    // drift towards your line, not perfectly
    ai.offsetTarget = (you.lat - ai.line[me.i]) * 0.6
  } else if (ai.state === 'BUMP') {
    // aim just past your line so the bikes meet
    ai.offsetTarget = you.lat + Math.sign(latGap || 1) * 0.15 - ai.line[me.i]
  } else if (ai.state !== 'AVOID_OBSTACLE') ai.offsetTarget = 0

  // small mistakes: running wide or a look over the shoulder
  ai.mistakeT -= dt
  if (ai.mistakeT <= 0 && Math.random() < lv.mistakes * dt * 10) {
    ai.mistake = Math.random() < 0.5 ? (Math.random() < 0.5 ? -1.4 : 1.4) : 0
    ai.mistakeT = 1 + Math.random()
    ai.lookBack = ai.mistake === 0
  }
  const wide = ai.mistakeT > 0 ? ai.mistake : 0
  const quick = ai.state === 'BUMP' || ai.state === 'AVOID_OBSTACLE'
  ai.offset += (ai.offsetTarget + wide - ai.offset) * (1 - Math.exp(-(quick ? 4.5 : 1.8) * dt))

  // ----- steer at a point ahead on his line (or along a shortcut)
  const look = Math.round((3 + me.speed * 0.55) / track.ds)
  let tx
  let tz
  const sc = shortcutFor(ai, track, me)
  if (sc) {
    // aim along the path
    const ax = me.x - sc.ax
    const az = me.z - sc.az
    const along = Math.min(sc.len, Math.max(0, ax * sc.dx + az * sc.dz) + look * track.ds)
    tx = sc.ax + sc.dx * along
    tz = sc.az + sc.dz * along
  } else {
    const j = track.wrap(me.i + look)
    const lat = Math.max(-half, Math.min(half, ai.line[j] + ai.offset))
    const p = track.point(j, lat, _t)
    tx = p.x
    tz = p.z
  }
  const want = Math.atan2(tx - me.x, tz - me.z)
  const d = angleDiff(want, me.heading)
  inp.steer = Math.max(-1, Math.min(1, -d * 2.4))

  // ----- speed: as fast as the next bends allow, with a bit of rubber band
  let bend = 0
  for (let k = 2; k < 22; k++) bend = Math.max(bend, Math.abs(track.curv[track.wrap(me.i + Math.round((k * (1 + me.speed * 0.12)) / track.ds))]))
  const cornerSpeed = Math.sqrt(lv.corner / Math.max(bend, 0.004))
  let pace = lv.pace
  if (gap < -30) pace *= 2 - lv.catchUp - 0.06 // far ahead: ease off
  else if (gap > 25) pace *= lv.catchUp + 0.04 // far behind: dig in
  if (ai.lookBack && ai.mistakeT > 0) pace *= 0.86
  let target = Math.min(me.bike.maxSpeed * pace * (me.boosting ? 1.2 : 1), cornerSpeed)
  // leaning in: match your speed so he stays alongside
  if (ai.state === 'BUMP' && gap > -0.5) target = Math.min(target, Math.max(you.speed + 0.6, 2))
  // swerving round a lubang or batu: ease off enough to make the line
  if (ai.state === 'AVOID_OBSTACLE') target *= 0.86
  inp.throttle = me.speed < target - 0.2 ? 1 : me.speed < target ? 0.5 : 0
  inp.brake = me.speed > target + 0.9 ? Math.min(1, (me.speed - target) / 3) : 0
  if (ai.state === 'RECOVER') inp.throttle = ai.stateT > 0.35 ? 1 : 0

  // ----- pecut on the straights in the final stretch (and sometimes before)
  const straight = bend < 0.025
  if (straight && me.boost > 0.3 && (ai.state === 'FINAL_STRETCH' ? Math.random() < lv.boost + 0.2 : ai.state === 'OVERTAKE' && Math.random() < lv.boost * dt * 3))
    inp.boost = true
  if (me.boosting && me.boost > 0.05 && straight) inp.boost = true
  return inp
}

const _t = { x: 0, z: 0 }

/** A shortcut he means to take, once he's near its start. */
function shortcutFor(ai, track, me) {
  for (let k = 0; k < track.shortcuts.length; k++) {
    if (!ai.takeShortcut[k]) continue
    const sc = track.shortcuts[k]
    const into = track.wrap(me.i - sc.i0)
    // from a few metres before it until he's across
    if (me.onShortcut === k || into < 12 || into > track.n - 4) return sc
  }
  return null
}

/** Anything in his lane within ~12 m: which way to go round it. */
function obstacleAhead(ai, track, me, obstacles) {
  for (const o of obstacles) {
    const ahead = track.wrap(o.i - me.i)
    if (ahead <= 0 || ahead > 18 / track.ds) continue
    // does he spot this one in time? (decided once each time he comes up to it)
    const seenKey = `${o.k}:${me.lap}`
    if (!(seenKey in ai.seen)) ai.seen[seenKey] = Math.random() < (ai.level.avoid ?? 0.9)
    if (!ai.seen[seenKey]) continue
    if (o.type === 'motosikal' || o.type === 'orang') {
      if (!o.moving) continue
    }
    const oLat = o.lat ?? 0
    if (Math.abs(oLat - me.lat) > o.radius + 0.9) continue
    const half = track.width[me.i] / 2 - 0.6
    // go round on the side with more road
    const left = oLat - o.radius - 1.0
    const right = oLat + o.radius + 1.0
    const side = -half <= left && (oLat > 0 || right > half) ? left : Math.min(half, right)
    return { side }
  }
  return null
}
