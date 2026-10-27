/**
 * Arcade bicycle physics, shared by you and Kamarul (he just presses his
 * own virtual keys). Plain numbers, no physics engine: speed builds up when
 * you pedal and fades when you stop, steering is gentler the faster you go,
 * the road edge slows you on the grass and the longkang/pagar keeps you on
 * the litar. Knocks wobble you and cost speed; a big one stuns you briefly.
 */

const BOOST_SECONDS = 2.6 // a full meter
const BOOST_RECOVER = 11 // seconds to refill from empty
const VERGE = 1.7 // grass beside the road before the longkang
export const RIDER_RADIUS = 0.38
const START_BACK = 7 // metres behind the line on the grid

const angleDiff = (a, b) => {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function makeRacer(track, bike, lat, name) {
  const i = track.wrap(-Math.round(START_BACK / track.ds))
  const r = {
    name,
    bike,
    i,
    lap: -1, // the grid is just before the line
    lat,
    x: 0,
    z: 0,
    y: 0,
    pitch: 0,
    heading: Math.atan2(track.tx[i], track.tz[i]),
    speed: 0,
    steer: 0,
    lean: 0,
    boost: 1,
    boosting: false,
    stun: 0,
    wobble: 0,
    wobblePhase: 0,
    hitCooldown: 0,
    nextCp: 0,
    finished: false,
    finishTime: 0,
    surface: 'road',
    onShortcut: -1,
    distance: 0, // metres ridden (spins the wheels)
    crank: 0,
    events: [], // 'hit' | 'stun' | 'splash' | 'checkpoint' | 'final' | 'finish'
  }
  const p = track.point(i, lat, { x: 0, z: 0 })
  r.x = p.x
  r.z = p.z
  return r
}

/** Laps done + where on the loop: the race is won at track.L. */
export const progressOf = (track, r) => r.lap * track.L + r.i * track.ds

const _proj = { i: 0, lat: 0 }

/**
 * One step. input = { throttle 0..1, brake 0..1, steer -1..1 (+ = right), boost }
 */
export function stepRacer(track, r, input, dt, obstacles, time) {
  const b = r.bike
  r.events.length = 0
  r.hitCooldown = Math.max(0, r.hitCooldown - dt)
  let throttle = input.throttle
  let brake = input.brake
  let steerIn = input.steer
  if (r.stun > 0) {
    r.stun -= dt
    throttle = 0
    brake = 0.4
    steerIn = 0
  }
  if (r.finished) {
    throttle = 0
    brake = r.speed > 2.5 ? 0.35 : 0.1
  }

  // ----- boost meter
  const wantBoost = input.boost && r.boost > 0.02 && r.speed > 1.5 && throttle > 0
  r.boosting = wantBoost
  if (wantBoost) r.boost = Math.max(0, r.boost - dt / BOOST_SECONDS)
  else r.boost = Math.min(1, r.boost + dt / BOOST_RECOVER)

  // ----- speed: pedal, coast, brake, ground
  const grip = r.surface === 'road' ? 1 : r.surface === 'shortcut' ? 0.86 : r.surface === 'mud' ? 0.62 : 0.7
  const slope = r.pitch // + uphill
  const top = b.maxSpeed * grip * (r.boosting ? 1.22 : 1)
  const accel = b.acceleration * (r.boosting ? 1.7 : 1)
  if (throttle > 0 && r.speed < top) {
    const room = 1 - (r.speed / top) ** 2
    r.speed += accel * throttle * Math.max(0.08, room) * dt
  } else if (r.speed > top) {
    r.speed -= (r.speed - top) * 1.6 * dt // too fast for the grass/mud: scrub off
  }
  // rolling + air drag when not pedalling; brake on top
  r.speed -= (throttle > 0 ? 0 : 0.35 + r.speed * 0.07) * dt
  r.speed -= b.braking * brake * dt
  r.speed -= slope * 9.8 * 0.55 * dt // hills
  r.speed = Math.max(0, r.speed)

  // ----- steering: sharp when slow, gentle when fast
  r.steer += (steerIn - r.steer) * (1 - Math.exp(-7 * dt))
  const turnRate = (0.9 + b.handling * 1.6) / (1 + r.speed * 0.16)
  const rolling = Math.min(1, r.speed / 1.2)
  r.wobblePhase += dt * 11
  const wob = r.wobble * Math.sin(r.wobblePhase)
  r.heading -= (r.steer * turnRate * rolling + wob * 0.9) * dt
  r.wobble *= Math.exp(-2.6 * dt)

  // ----- move
  r.x += Math.sin(r.heading) * r.speed * dt
  r.z += Math.cos(r.heading) * r.speed * dt
  r.distance += r.speed * dt

  // ----- where on the litar
  const prevI = r.i
  track.project(r.x, r.z, r.i, 14, _proj)
  r.surface = 'road'
  let half = track.width[_proj.i] / 2
  let lat = _proj.lat
  let i = _proj.i
  r.onShortcut = -1
  for (let k = 0; k < track.shortcuts.length; k++) {
    const sc = track.shortcuts[k]
    // on the path? (only when near its stretch of road)
    const ax = r.x - sc.ax
    const az = r.z - sc.az
    const along = ax * sc.dx + az * sc.dz
    const side = -ax * sc.dz + az * sc.dx
    if (along < -1 || along > sc.len + 1 || Math.abs(side) > sc.half + 0.4) continue
    if (Math.abs(lat) < half) continue // still on the main road
    r.onShortcut = k
    r.surface = sc.mud ? 'mud' : 'shortcut'
    i = track.wrap(Math.round(sc.i0 + (sc.i1 - sc.i0) * Math.min(1, Math.max(0, along / sc.len))))
    // keep inside the path's own edges
    if (Math.abs(side) > sc.half) {
      const push = Math.sign(side) * (Math.abs(side) - sc.half)
      r.x -= -sc.dz * push
      r.z -= sc.dx * push
      bump(r, 0.15)
    }
  }
  if (r.onShortcut < 0) {
    const off = Math.abs(lat) - half
    // on a jambatan the rails keep you on; beside it is the stream
    const verge = track.bridgeAt[i] >= 0 ? 0.25 : VERGE
    if (off > 0) r.surface = track.bridgeAt[i] >= 0 ? 'mud' : 'grass'
    if (off > verge) {
      // the longkang / pagar: slide back along it
      const back = Math.sign(lat) * (off - verge)
      r.x -= -track.tz[i] * back
      r.z -= track.tx[i] * back
      const along = Math.atan2(track.tx[i], track.tz[i])
      const d = angleDiff(r.heading, along)
      const into = Math.sign(lat) * -Math.sin(d) // heading into the edge
      if (into > 0.02) {
        // slide along it: turn parallel, scrub a little speed (a hard hit knocks you)
        if (into > 0.35 && r.speed > 3 && r.hitCooldown <= 0) knock(r, 'edge', 0.35)
        // (riding the wrong way along it stays the wrong way)
        r.heading -= angleDiff(r.heading, Math.abs(d) > Math.PI / 2 ? along + Math.PI : along)
        r.speed *= 1 - Math.min(0.6, into * 3) * dt * 4
      }
    }
  }
  // mud patches
  for (const m of track.mud) {
    const dx = r.x - m.x
    const dz = r.z - m.z
    const ca = Math.cos(m.angle)
    const sa = Math.sin(m.angle)
    if (Math.abs(dx * sa + dz * ca) < m.len / 2 && Math.abs(dx * ca - dz * sa) < m.w / 2) {
      if (r.surface !== 'mud') r.events.push('splash')
      r.surface = 'mud'
    }
  }
  // laps: crossing sample 0 forwards (or backwards)
  if (prevI > track.n * 0.8 && i < track.n * 0.2) r.lap++
  else if (prevI < track.n * 0.2 && i > track.n * 0.8) r.lap--
  r.i = i
  r.lat = lat

  // height and slope (bridges, bukit)
  const y = track.heightAt(i, lat)
  const ahead = track.heightAt(i + 2, lat)
  const behind = track.heightAt(i - 2, lat)
  r.pitch = Math.atan2(ahead - behind, 4 * track.ds) * Math.cos(angleDiff(r.heading, Math.atan2(track.tx[i], track.tz[i])))
  r.y = y

  // ----- obstacles
  for (const o of obstacles) {
    const dx = r.x - o.x
    const dz = r.z - o.z
    const reach = o.radius + RIDER_RADIUS
    if (dx * dx + dz * dz > reach * reach) continue
    if (o.zone) {
      // lopak: splash and drag, no knock
      if (!o.touching?.has(r)) {
        o.touching = o.touching ?? new Set()
        o.touching.add(r)
        r.events.push('splash')
        r.speed *= 0.82
        r.wobble = Math.max(r.wobble, 0.12 * (1 - b.stability * 0.6))
      }
      continue
    }
    if (r.hitCooldown > 0 || o.down > time) continue
    o.down = time + (o.respawn ?? 3)
    o.hitAt = time
    o.hitDir = Math.sign(-dx * Math.cos(r.heading) + dz * Math.sin(r.heading)) || 1
    knock(r, o.type, o.force)
  }
  for (const o of obstacles) if (o.zone && o.touching?.has(r) && (r.x - o.x) ** 2 + (r.z - o.z) ** 2 > (o.radius + RIDER_RADIUS + 0.5) ** 2) o.touching.delete(r)

  // ----- lean into turns (more at speed), plus the wobble
  const lateralAccel = r.steer * turnRate * rolling * r.speed
  const leanTarget = Math.max(-0.5, Math.min(0.5, lateralAccel * 0.085)) + wob * 0.35
  r.lean += (leanTarget - r.lean) * (1 - Math.exp(-6 * dt))

  // pedals turn with the back wheel (about 2.4 wheel turns per pedal turn); coasting they rest
  if (throttle > 0) r.crank += (r.speed / Math.max(0.2, b.wheelR ?? 0.3) / 2.4) * dt
}

function bump(r, amount) {
  r.wobble = Math.max(r.wobble, amount)
}

/** A knock: wobble and lose speed; a big one (motosikal, orang) stuns briefly. */
function knock(r, type, force = 0.5) {
  const soften = 1 - r.bike.stability * 0.55
  r.hitCooldown = 0.8
  if (force >= 0.9) {
    r.stun = 1.1
    r.speed *= 0.18
    r.wobble = 0.9
    r.events.push('stun')
  } else {
    r.speed *= 1 - force * 0.75 * soften - 0.08
    r.wobble = Math.max(r.wobble, force * 1.1 * soften + 0.15)
    r.events.push('hit')
  }
  r.lastHit = type
}

/** Two bikes touching: nudge apart, a little wobble for both. */
export function separate(a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const d = Math.hypot(dx, dz)
  const min = RIDER_RADIUS * 2
  if (d >= min || d === 0) return false
  const push = (min - d) / 2
  a.x -= (dx / d) * push
  a.z -= (dz / d) * push
  b.x += (dx / d) * push
  b.z += (dz / d) * push
  a.wobble = Math.max(a.wobble, 0.25)
  b.wobble = Math.max(b.wobble, 0.25)
  a.speed *= 0.97
  b.speed *= 0.97
  return true
}

/** Checkpoints in order, then the line. Returns the events this step. */
export function checkProgress(track, r, time) {
  if (r.finished) return
  const prog = progressOf(track, r)
  if (r.nextCp < track.checkpoints.length && prog >= track.checkpoints[r.nextCp] && prog < track.checkpoints[r.nextCp] + 60) {
    r.nextCp++
    r.events.push('checkpoint')
  }
  if (!r.final && r.nextCp === track.checkpoints.length && prog >= track.finalStretch) {
    r.final = true
    r.events.push('final')
  }
  if (r.nextCp === track.checkpoints.length && prog >= track.L) {
    r.finished = true
    r.finishTime = time
    r.events.push('finish')
  }
}

/** Obstacles placed in the world (moving ones are updated each frame). */
export function placeObstacles(track, defs) {
  const p = { x: 0, z: 0 }
  return defs.map((o, k) => {
    const i = Math.round(o.at * track.n)
    const base = { type: o.type, i, k, lat: o.lat ?? 0, down: -1, hitAt: -9, angle: Math.atan2(track.tx[i], track.tz[i]) }
    track.point(i, o.lat ?? 0, p)
    switch (o.type) {
      case 'lopak':
        return { ...base, x: p.x, z: p.z, radius: 0.85, zone: true }
      case 'ayam':
        return { ...base, x: p.x, z: p.z, homeLat: o.lat ?? 0, radius: 0.25, force: 0.35, respawn: 4 }
      case 'batu':
        return { ...base, x: p.x, z: p.z, radius: 0.3, force: 0.55, respawn: 1.5 }
      case 'ranting':
        return { ...base, x: p.x, z: p.z, radius: 0.45, force: 0.3, respawn: 1.5 }
      case 'motosikal':
        // crosses the road now and then (a lorong to a house)
        return { ...base, x: p.x, z: p.z, radius: 0.7, force: 1, respawn: 3, period: 9 + k, cross: track.width[i] / 2 + 5 }
      case 'orang':
        return { ...base, x: p.x, z: p.z, radius: 0.4, force: 0.95, respawn: 3, period: 14 + k, cross: track.width[i] / 2 + 3 }
      default:
        return { ...base, x: p.x, z: p.z, radius: 0.3, force: 0.4 }
    }
  })
}

const _p = { x: 0, z: 0 }
/** Move the moving obstacles: motosikal and orang cross, ayam wander and scatter. */
export function updateObstacles(track, obstacles, time) {
  for (const o of obstacles) {
    if (o.type === 'motosikal' || o.type === 'orang') {
      // out on one side, crossing, out on the other side, back again
      const u = (time + o.k * 3.1) % o.period
      const crossT = o.type === 'motosikal' ? 2.2 : 5.5
      const t = Math.min(1, Math.max(0, (u - (o.period / 2 - crossT / 2)) / crossT))
      const dir = Math.floor((time + o.k * 3.1) / o.period) % 2 ? 1 : -1
      const lat = (t * 2 - 1) * o.cross * dir
      o.moving = t > 0 && t < 1
      o.dir = dir
      track.point(o.i, lat, _p)
      o.x = _p.x
      o.z = _p.z
      o.lat = lat
    } else if (o.type === 'ayam') {
      const scatter = Math.max(0, 1 - (time - o.hitAt) / 1.2)
      const wander = Math.sin(time * 0.7 + o.k) * 0.6
      const lat = o.homeLat + wander + (o.hitDir ?? 1) * scatter * 2.2
      track.point(o.i + Math.round(Math.sin(time * 0.4 + o.k * 2) * 1.5), lat, _p)
      o.x = _p.x
      o.z = _p.z
      o.flap = scatter
      o.lat = lat
    }
  }
}
