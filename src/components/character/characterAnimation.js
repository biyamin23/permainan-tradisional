import { MathUtils, Matrix4, Vector3 } from 'three'

/**
 * The animation brain behind PersonModel: no clips, everything procedural, in
 * layers so the kampung people move like characters rather than props.
 *
 *   pose      what the person is doing (idle, stand1, throwBack…), as joint targets
 *   crossfade every channel eases to its target at the pose's own fade rate
 *   locomotion stride cycle driven by distance travelled (feet don't slide)
 *   jump      prep → air → land, from motion.jump (player and teng-teng hops)
 *   balance   one-foot timbang wobble, near-fall arms
 *   life      breathing, weight shift, glances (never quite frozen)
 *   look      head → neck → a little torso towards a target, clamped
 *   legs      two-bone IK keeps planted feet on the ground whatever the hips do
 *
 * motionRef.current (all optional):
 *   speed 0..1, dist (metres walked, drives the stride), run 0..1, bank (lean into turns)
 *   jump { phase: 'prep' | 'air' | 'land', u: 0..1 through the phase, vy, impact 0..1 }
 *   balance -1..1, look (world Vector3 or null), groundY (world height under the feet)
 */

export const FOOT_H = 0.05 // ankle above the sole
const SOLE_CLEARANCE = 0.004 // planted soles rest a hair above the surface (never through it)

const CHANNELS = [
  'rootY', 'pelvisY', 'pelvisRoll', 'pelvisYaw',
  'lean', 'twist', 'side',
  'headX', 'headY', 'headZ',
  'aLx', 'aLz', 'aLe', 'aRx', 'aRz', 'aRe',
  'Lik', 'Lfz', 'Lfy', 'La', 'Lk', 'Lz', 'Lank',
  'Rik', 'Rfz', 'Rfy', 'Ra', 'Rk', 'Rz', 'Rank',
]

const makeChannels = () => Object.fromEntries(CHANNELS.map((c) => [c, 0]))

// how quickly each pose blends in (per second); one-shots are snappier
const FADE = {
  throwBack: 20, aimBack: 9, kick: 18, celebrate: 14, fail: 12, raga: 16,
  sit: 6, sitDangle: 6, sitPlay: 6, sitThink: 6, sitDrink: 6, fish: 6, toss: 8,
  stand1: 16, stand2: 16, balance: 14, bend: 12,
}

const SITTING = new Set(['sit', 'sitDangle', 'fish', 'toss', 'sitPlay', 'sitThink', 'sitDrink'])
// standing poses that breathe, shift weight and can glance about
const LIFE = new Set(['idle', 'wave', 'cheer', 'clap', 'guard', 'stand2', 'holdUp', 'sweep', 'celebrate'])
const LIFE_SITTING = new Set(['sit', 'sitDangle', 'fish', 'sitThink', 'sitDrink', 'toss'])
// poses calm enough to turn the head towards someone
const CAN_LOOK = new Set(['idle', 'wave', 'cheer', 'clap', 'guard', 'stand2', 'sit', 'sitDangle', 'fish', 'sweep', 'holdUp', 'sitDrink', 'sitThink'])
// poses that run the jump / balance layers
const HOPPY = new Set(['idle', 'stand1', 'stand2', 'balance', 'celebrate'])
const ONE_FOOT = new Set(['stand1', 'balance'])

export const isSitting = (pose) => SITTING.has(pose)

// temperaments for idle variety: nobody idles quite like anyone else
const TEMPERAMENTS = ['curious', 'watcher', 'fidget', 'reactor']

export function createRig() {
  const seed = Math.random()
  return {
    seed,
    temperament: TEMPERAMENTS[Math.floor(seed * 4) % 4],
    offset: seed * 37, // de-syncs idle cycles between people
    cur: makeChannels(),
    tgt: makeChannels(),
    started: false,
    walkPhase: seed * 6,
    lastDist: null,
    loco: 0, // smoothed locomotion weight
    locoPelvis: 0,
    lookYaw: 0,
    lookPitch: 0,
    lookW: 0,
    glance: { until: 0, next: 2 + seed * 4, yaw: 0, pitch: 0 },
    react: { next: 5 + seed * 6, t: -9 },
    frame: Math.floor(seed * 3),
  }
}

/** Two-bone leg IK in the leg's sagittal plane. Foot target relative to the hip joint. */
function solveLeg(out, dz, dy, len) {
  const reach = len * 2 * 0.9995
  const d = MathUtils.clamp(Math.hypot(dz, dy), 0.001, reach)
  const phi = Math.atan2(-dz, -dy) // + when the foot is behind
  const alpha = Math.acos(d / (len * 2))
  out.thigh = phi - alpha // knee goes forward
  out.knee = alpha * 2
}
const _leg = { thigh: 0, knee: 0 }

const smooth01 = (x) => {
  const t = MathUtils.clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}
/** 0 → 1 → 0 over [a, b] with a soft rise and fall. */
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI))

function defaults(p, elder) {
  for (const c of CHANNELS) p[c] = 0
  p.aLz = 0.12
  p.aRz = -0.12
  p.aLe = p.aRe = -0.18
  p.Lik = p.Rik = 1
  p.lean = elder ? 0.12 : 0
  p.pelvisY = elder ? -0.015 : -0.008 // knees never locked
  p.fade = 10
}

/** Legs bent at the knee to reach the floor from a seat (feet forward), or dangling. */
function seatLegs(p, ctx, thigh, sitY) {
  const { T } = ctx
  const hipY = ctx.worldY + ctx.b.hip + sitY - ctx.groundY
  const ratio = (hipY - T * Math.cos(thigh) - FOOT_H) / T
  const shin = ratio >= 1 ? 0 : -Math.acos(Math.max(-1, ratio))
  p.La = p.Ra = thigh
  p.Lk = p.Rk = shin - thigh
  p.Lank = p.Rank = -shin
  return ratio >= 1 // dangling
}

/** Pose → joint targets. `ctx.time` is per-person (offset), `ctx.since` the time since the last action. */
function buildPose(p, pose, ctx) {
  const { time, since, b, kind } = ctx
  const s = b.hip / 0.56 // build scale
  const sitY = -(b.hip - b.legR - 0.03)
  defaults(p, ctx.elder)
  p.fade = FADE[pose] ?? 10

  switch (pose) {
    case 'wave':
      p.aRz = -2.5 + Math.sin(time * 9) * 0.3
      p.aRx = 0
      p.aRe = -0.35 + Math.sin(time * 9 + 0.6) * 0.25
      break
    case 'cheer': {
      // bursts of cheering, then catching their breath (not an endless pogo)
      const c = time % 4.6
      const on = smooth01(c / 0.3) * (1 - smooth01((c - 1.7) / 0.4))
      const bounce = Math.abs(Math.sin(time * 5.5))
      p.aLz = MathUtils.lerp(0.25, 2.6 + Math.sin(time * 10) * 0.15, on)
      p.aRz = MathUtils.lerp(-0.25, -2.6 - Math.sin(time * 10) * 0.15, on)
      p.aLx = p.aRx = MathUtils.lerp(-0.25, 0, on)
      p.aLe = p.aRe = MathUtils.lerp(-0.7, -0.25, on)
      p.rootY = bounce * 0.13 * on
      p.pelvisY = -0.03 * (1 - bounce) * on
      p.headX = -0.15 * on
      break
    }
    case 'sit':
    case 'sitDangle':
    case 'fish':
    case 'toss':
    case 'sitPlay':
    case 'sitThink':
    case 'sitDrink': {
      const atTable = pose === 'sitPlay' || pose === 'sitThink' || pose === 'sitDrink'
      p.Lik = p.Rik = 0
      p.rootY = sitY
      p.aLx = p.aRx = -0.35
      p.aLe = p.aRe = -0.45
      if (pose === 'sit' || pose === 'toss') {
        // on the floor, legs out in front, knees a little up
        p.La = p.Ra = -1.5
        p.Lk = p.Rk = 0.18
        p.Lank = p.Rank = -0.2
      } else {
        const dangling = seatLegs(p, ctx, atTable ? -1.45 : -1.35, sitY)
        if (dangling || pose === 'sitDangle') {
          // swinging feet, out of step with each other
          p.Lk += Math.sin(time * 1.7) * 0.22
          p.Rk += Math.sin(time * 1.7 + 2.1) * 0.22
        }
      }
      if (pose === 'fish') {
        p.aLx = p.aRx = -1.05 + Math.sin(time * 0.7) * 0.04
        p.aLz = 0.25
        p.aRz = -0.25
        p.aLe = p.aRe = -0.3
      }
      const t = time
      if (pose === 'sitPlay') {
        // leaning over the dam board, now and then reaching to move a cap
        const ph = t % 5.5
        const reach = bump(ph, 4.2, 5.2)
        p.aLx = -0.95
        p.aRx = -1.0 - reach * 0.45
        p.aRe = -0.5 + reach * 0.35
        p.aLz = 0.18
        p.aRz = -0.1 + reach * 0.15
        p.lean = 0.22 + reach * 0.12
        p.headX = 0.25
      }
      if (pose === 'sitThink') {
        // elbow on the table, hand at the chin, studying the board
        p.aLx = -0.95
        p.aRx = -1.6
        p.aRe = -1.9
        p.aRz = -0.3
        p.lean = 0.2
        p.headX = 0.2 + Math.sin(t * 0.6) * 0.04
      }
      if (pose === 'sitDrink') {
        // sipping kopi: cup up to the mouth every few seconds
        const sip = bump(t % 7, 5, 6.6)
        p.aLx = -0.85
        p.aRx = -0.7 - sip * 0.6
        p.aRe = -0.6 - sip * 1.5
        p.aRz = -0.12 - sip * 0.2
        p.headX = -sip * 0.22
        p.lean = 0.06
      }
      if (pose === 'toss') {
        const k = Math.sin(((time % 1.6) / 1.6) * Math.PI)
        p.aRx = -0.6 - k * 1.0
        p.aRe = -0.4 - k * 0.5
        p.headX = -k * 0.35
        p.lean = 0.15
      }
      break
    }
    case 'crouch': {
      // squatting at the marble ring, flicking now and then
      const flick = since < 0.35 ? Math.sin((since / 0.35) * Math.PI) : 0
      p.pelvisY = -b.hip * 0.42
      p.Lfz = 0.12 * s
      p.Rfz = 0.02 * s
      p.Lz = 0.14
      p.Rz = -0.14
      p.lean = 0.5
      p.aLx = -0.9
      p.aLe = -0.4
      p.aRx = -1.0 - flick * 0.4
      p.aRe = -0.3 + flick * 0.25
      p.headX = 0.15
      break
    }
    case 'kick': {
      const k = since < 0.5 ? Math.sin((since / 0.5) * Math.PI) : 0
      const wind = since < 0.5 ? 1 - since / 0.5 : 0
      p.Rik = 1 - Math.min(1, k * 2)
      p.Ra = -1.35 * k
      p.Rk = 0.9 * wind * k
      p.pelvisY = -0.04 * k
      p.aLz = 0.3 + 0.5 * k
      p.aRz = -0.3 - 0.5 * k
      p.aLx = p.aRx = 0
      p.lean = -0.12 * k
      p.headX = -0.25
      break
    }
    case 'throw': {
      const ph = time % 3.2
      let x = 0
      if (ph < 0.7) x = MathUtils.lerp(0, 1.5, smooth01(ph / 0.7))
      else if (ph < 0.9) x = MathUtils.lerp(1.5, -1.5, (ph - 0.7) / 0.2)
      else if (ph < 1.6) x = MathUtils.lerp(-1.5, 0, smooth01((ph - 0.9) / 0.7))
      p.aRx = x
      p.aRe = x > 0 ? -0.5 : -0.15
      p.lean = ph > 0.7 && ph < 1.2 ? 0.25 : 0.05
      p.twist = x * -0.12
      p.aLx = -0.3
      p.Lfz = 0.12 * s
      p.Rfz = -0.1 * s
      p.pelvisY = -0.03
      p.fade = 16
      break
    }
    case 'holdUp':
      p.aRx = -2.25 + Math.sin(time * 1.3) * 0.08
      p.aRz = -0.15
      p.aRe = -0.15
      p.aLx = -0.5
      p.aLe = -0.6
      p.headX = -0.35
      break
    case 'sweep':
      p.lean = 0.3
      p.aLx = p.aRx = -0.85
      p.aLe = p.aRe = -0.45
      p.aRz = Math.sin(time * 2.4) * 0.35 - 0.1
      p.aLz = Math.sin(time * 2.4) * 0.35 + 0.1
      p.twist = Math.sin(time * 2.4) * 0.12
      p.Lfz = 0.12 * s
      p.Rfz = -0.1 * s
      p.pelvisY = -0.05 * s
      break
    case 'hop': {
      const ph = (time % 0.55) / 0.55
      p.rootY = Math.sin(ph * Math.PI) * 0.28
      p.Lik = p.Rik = 0
      p.La = -0.6
      p.Lk = 1.1
      p.aLz = 0.7
      p.aRz = -0.7
      p.aLx = p.aRx = 0
      break
    }
    case 'pull':
      p.lean = 0.28
      p.aLx = p.aRx = 0.55
      p.aLe = p.aRe = -0.2
      p.Lfz = 0.2 * s
      p.Rfz = -0.12 * s
      p.pelvisY = -0.07 * s
      break
    case 'ride': {
      const pedal = Math.sin(ctx.walkPhase * 1.4)
      p.Lik = p.Rik = 0
      p.La = -1.25 + pedal * 0.4
      p.Ra = -1.25 - pedal * 0.4
      p.Lk = 0.85 - pedal * 0.45
      p.Rk = 0.85 + pedal * 0.45
      p.aLx = p.aRx = -1.1
      p.aLe = p.aRe = -0.25
      p.aLz = 0.15
      p.aRz = -0.15
      p.lean = 0.2
      break
    }
    case 'swing': {
      const strike = bump(time % 2.6, 1.2, 1.5)
      const wind = bump(time % 2.6, 0.3, 1.3)
      p.aLx = p.aRx = -0.7 - strike * 1.3 + wind * 0.35
      p.aLe = p.aRe = -0.35 + strike * 0.3
      p.aLz = 0.2
      p.aRz = -0.2
      p.lean = 0.3 - strike * 0.3
      p.twist = wind * 0.3 - strike * 0.25
      p.Lfz = 0.16 * s
      p.Rfz = -0.14 * s
      p.pelvisY = -0.06 * s
      break
    }
    case 'guard':
      p.aLz = 1.25
      p.aRz = -1.25
      p.aLe = p.aRe = -0.2
      p.aLx = p.aRx = 0
      p.lean = 0.12
      p.Lz = 0.16
      p.Rz = -0.16
      p.pelvisY = -0.07 * s
      break
    case 'raga': {
      // ready stance, and the sepak raga touches (synced by actionRef)
      const kd = kind ?? 'sila'
      const dur = kd === 'lambung' ? 0.7 : 0.45
      const k = since < dur ? Math.sin((since / dur) * Math.PI) : 0
      p.lean = 0.14
      p.aLz = 0.55
      p.aRz = -0.55
      p.aLx = p.aRx = -0.15
      p.aLe = p.aRe = -0.35
      p.Lz = 0.1
      p.Rz = -0.1
      p.pelvisY = -0.05 * s + Math.sin(time * 3) * 0.008
      if (kd === 'sila') {
        p.Rik = 1 - Math.min(1, k * 2.5)
        p.Ra = -0.95 * k
        p.Rk = 0.6 * k
        p.Rz = -0.1 + 0.75 * k
      } else if (kd === 'kuda') {
        p.Rik = 1 - Math.min(1, k * 2.5)
        p.Ra = 0.6 * k
        p.Rk = 1.4 * k
        p.lean = 0.14 + 0.35 * k
        p.headX = 0.25 * k
      } else if (kd === 'lutut') {
        p.Rik = 1 - Math.min(1, k * 2.5)
        p.Ra = -1.55 * k
        p.Rk = 1.5 * k
        p.lean = 0.14 - 0.2 * k
      } else if (kd === 'kepala') {
        p.rootY = 0.22 * k
        p.Lik = p.Rik = 1 - Math.min(1, k * 2.5)
        p.La = p.Ra = -0.25 * k
        p.Lk = p.Rk = 0.5 * k
        p.headX = -0.45 + 0.9 * k
        p.lean = -0.1 * k
      } else if (kd === 'lambung') {
        p.aLx = p.aRx = -0.4 - 2.3 * k
        p.aLz = 0.3
        p.aRz = -0.3
        p.headX = -0.35 * k
        p.pelvisY -= 0.06 * (1 - k)
      }
      break
    }
    // ---- teng-teng
    case 'stand1':
    case 'balance':
      // on the right foot, the left knee up and bent behind
      p.Lik = 0
      p.La = -0.25
      p.Lk = 1.35
      p.Lank = 0.35
      p.Rfz = 0.02 * s
      p.pelvisY = -0.03 * s
      p.pelvisRoll = -0.05
      p.side = 0.07
      p.headZ = -0.06
      p.aLz = 0.5
      p.aRz = -0.5
      p.aLx = p.aRx = -0.15
      p.aLe = p.aRe = -0.35
      p.lean = 0.1
      if (pose === 'balance') {
        // gundu on the head: arms wide, chin up
        p.aLz = 1.3 + Math.sin(time * 3) * 0.06
        p.aRz = -1.3 + Math.sin(time * 3 + 1) * 0.06
        p.aLx = p.aRx = 0
        p.aLe = p.aRe = -0.12
        p.headX = -0.1
        p.lean = 0.04
      }
      break
    case 'stand2':
      p.Lz = 0.14
      p.Rz = -0.14
      p.pelvisY = -0.035 * s
      p.aLz = 0.35
      p.aRz = -0.35
      p.aLx = p.aRx = -0.1
      p.aLe = p.aRe = -0.3
      break
    case 'bend':
      // picking the gundu up on one foot: support knee bends, free leg goes back for balance
      p.Lik = 0
      p.La = 0.55
      p.Lk = 0.55
      p.Lank = 0.3
      p.Rfz = 0.04 * s
      p.pelvisY = -0.14 * s
      p.lean = 0.85
      p.aRx = -1.15
      p.aRe = -0.1
      p.aRz = -0.05
      p.aLz = 0.9
      p.aLx = 0.2
      p.aLe = -0.3
      p.headX = 0.3
      break
    case 'aimBack':
      // back to the court, gundu in hand, looking over the shoulder at the petak
      p.aRx = 0.45
      p.aRe = -0.55
      p.aRz = -0.18
      p.aLx = -0.35
      p.aLz = 0.3
      p.aLe = -0.5
      p.lean = 0.14
      p.twist = -0.22
      p.headY = -0.75
      p.headX = -0.05
      p.pelvisY = -0.06 * s
      p.Lfz = 0.08 * s
      p.Rfz = -0.08 * s
      break
    case 'throwBack': {
      // anticipation → toss back over the shoulder (release ≈ 0.15 s) → follow-through → settle
      const t = since
      let x
      let e
      if (t < 0.15) {
        const u = smooth01(t / 0.15)
        x = MathUtils.lerp(0.45, -2.4, u * u)
        e = MathUtils.lerp(-0.55, -0.15, u)
      } else if (t < 0.4) {
        const u = smooth01((t - 0.15) / 0.25)
        x = MathUtils.lerp(-2.4, -2.95, u)
        e = -0.15
      } else {
        const u = smooth01((t - 0.4) / 0.55)
        x = MathUtils.lerp(-2.95, 0, u)
        e = MathUtils.lerp(-0.15, -0.18, u)
      }
      const drive = bump(t, 0, 0.55)
      p.aRx = x
      p.aRe = e
      p.aRz = -0.18
      p.aLx = -0.35 + drive * 0.3
      p.aLz = 0.3 + drive * 0.2
      p.aLe = -0.5
      p.lean = 0.14 - drive * 0.32
      p.twist = -0.22 + drive * 0.1
      p.headY = -0.75 * (1 - smooth01((t - 0.6) / 0.5))
      p.headX = -drive * 0.25
      p.pelvisY = MathUtils.lerp(-0.06, 0.0, drive) * s
      p.Lfz = 0.08 * s
      p.Rfz = -0.08 * s
      break
    }
    case 'clap': {
      const clapping = time % 4 < 1.6
      p.aLx = p.aRx = clapping ? -1.0 : -0.2
      p.aLe = p.aRe = clapping ? -0.75 : -0.25
      p.aLz = clapping ? 0.3 + Math.sin(time * 18) * 0.2 : 0.2
      p.aRz = clapping ? -0.3 - Math.sin(time * 18) * 0.2 : -0.2
      p.pelvisY += clapping ? Math.sin(time * 9) * 0.008 : 0
      break
    }
    case 'celebrate': {
      // a small, happy fist pump and a little hop, then a pleased bounce
      const t = since
      const pump = bump(t, 0.05, 1.1)
      const hop = bump(t, 0.1, 0.45)
      p.rootY = hop * 0.1
      p.pelvisY = -0.05 * bump(t, 0, 0.12) - 0.04 * bump(t, 0.42, 0.6)
      p.aRx = -0.3 - pump * 1.9
      p.aRe = -0.3 - pump * 1.3
      p.aRz = -0.2
      p.aLz = 0.2 + pump * 0.25
      p.aLe = -0.4
      p.lean = -0.06 * pump
      p.headX = -0.18 * pump
      p.pelvisY += t > 1 && t < 2.2 ? Math.abs(Math.sin(t * 7)) * -0.012 : 0
      break
    }
    case 'fail': {
      const t = since
      if (kind === 'jatuh') {
        // stumble off the foot, arms grab at the air, then steady again
        const st = bump(t, 0, 0.9)
        p.side = -0.3 * st
        p.lean = 0.2 * st
        p.aLz = 0.15 + st * (1.5 + Math.sin(t * 14) * 0.3)
        p.aRz = -0.15 - st * (1.5 + Math.sin(t * 12 + 1) * 0.3)
        p.Lik = 1 - st
        p.La = -0.3 * st
        p.Lk = 0.6 * st
        p.Lz = 0.4 * st
        p.pelvisY = -0.08 * st
      }
      // then the disappointment: head drops, a slow shake, hand to the head
      const down = smooth01((t - (kind === 'jatuh' ? 0.8 : 0.1)) / 0.35) * (1 - smooth01((t - 2.4) / 0.6))
      const shake = bump(t, kind === 'jatuh' ? 1.1 : 0.4, kind === 'jatuh' ? 2.0 : 1.4)
      const hand = bump(t, kind === 'jatuh' ? 1.0 : 0.3, kind === 'jatuh' ? 2.3 : 1.8)
      p.headX += 0.32 * down
      p.headY += Math.sin(t * 9) * 0.2 * shake
      p.lean += 0.1 * down
      p.aLz = MathUtils.lerp(p.aLz, 0.06, down)
      p.aRz = MathUtils.lerp(p.aRz, -0.1, down * (1 - hand))
      p.aRx = -2.3 * hand
      p.aRe = -1.9 * hand
      p.pelvisY += -0.02 * down
      break
    }
    default:
      break
  }
}

/** Stride cycle from distance walked: stance feet move back exactly as fast as the body goes forward. */
function applyLocomotion(p, rig, ctx, w) {
  const { b, motion } = ctx
  const s = b.hip / 0.56
  const run = motion?.run ?? 0
  const beta = MathUtils.lerp(0.56, 0.36, run) // share of the cycle a foot is on the ground
  const cycle = MathUtils.lerp(0.9, 1.6, run) * s
  const A = (beta * cycle) / 2
  const lift = MathUtils.lerp(0.07, 0.15, run) * s
  const reach = ctx.T * 2 * 0.985

  let drop = MathUtils.lerp(0.012, 0.04, run) * s
  let stanceDrop = -1
  const zs = [0, 0]
  for (let i = 0; i < 2; i++) {
    const u = ((rig.walkPhase / (Math.PI * 2) + i * 0.5) % 1 + 1) % 1
    let z
    let y = 0
    if (u < beta) {
      z = A * (1 - (2 * u) / beta)
      const need = b.hip - (Math.sqrt(Math.max(0, reach * reach - z * z)) + FOOT_H)
      stanceDrop = Math.max(stanceDrop, need)
    } else {
      const v = (u - beta) / (1 - beta)
      z = -A + 2 * A * (0.5 - 0.5 * Math.cos(Math.PI * v))
      y = Math.sin(Math.PI * v) * lift
    }
    zs[i] = z
    const k = i === 0 ? 'L' : 'R'
    p[`${k}fz`] = MathUtils.lerp(p[`${k}fz`], z, w)
    p[`${k}fy`] = MathUtils.lerp(p[`${k}fy`], y, w)
    p[`${k}ik`] = MathUtils.lerp(p[`${k}ik`], 1, w)
    p[`${k}z`] = MathUtils.lerp(p[`${k}z`], 0, w)
  }
  // in a run's flight phase both feet are up: the hips rise a touch
  drop = stanceDrop >= 0 ? Math.max(drop, stanceDrop) : drop - 0.03 * run * s
  rig.locoPelvis += (drop - rig.locoPelvis) * (1 - Math.exp(-25 * ctx.dt))

  const [zL, zR] = zs
  const amp = MathUtils.lerp(0.45, 0.85, run)
  const yaw = -0.14 * ((zL - zR) / (2 * A))
  const set = (c, v) => {
    p[c] = MathUtils.lerp(p[c], v, w)
  }
  set('pelvisY', -rig.locoPelvis)
  set('pelvisYaw', yaw)
  set('twist', -yaw * 1.3)
  set('headY', yaw * 0.3)
  set('aLx', (-amp * zR) / A)
  set('aRx', (-amp * zL) / A)
  set('aLe', MathUtils.lerp(-0.35, -1.35, run))
  set('aRe', MathUtils.lerp(-0.35, -1.35, run))
  set('aLz', 0.14)
  set('aRz', -0.14)
  set('lean', MathUtils.lerp(0.06, 0.24, run) + (ctx.elder ? 0.1 : 0))
  set('headX', MathUtils.lerp(0, 0.06, run))
}

/** prep → air → land, on one foot for teng-teng poses, two otherwise. */
function applyJump(p, ctx) {
  const j = ctx.motion?.jump
  if (!j || !j.phase) return
  const s = ctx.b.hip / 0.56
  const oneFoot = ONE_FOOT.has(ctx.pose)
  p.fade = 24
  if (j.phase === 'prep') {
    const e = smooth01(j.u)
    p.pelvisY -= 0.09 * e * s
    p.lean += 0.16 * e
    p.aLx += 0.45 * e
    p.aRx += 0.45 * e
    p.aLe = p.aRe = -0.3
    p.headX += 0.05 * e
  } else if (j.phase === 'air') {
    const fall = smooth01(0.5 - (j.vy ?? 0) * 0.25) // 0 rising → 1 falling
    if (oneFoot) {
      p.Rik = 0
      p.Ra = MathUtils.lerp(0.18, -0.15, fall)
      p.Rk = MathUtils.lerp(0.2, 0.4, fall)
      p.Rank = MathUtils.lerp(0.5, 0.15, fall)
      p.Lk = Math.max(p.Lk, 1.45)
    } else {
      p.Lik = p.Rik = 0
      p.La = MathUtils.lerp(-0.6, -0.28, fall)
      p.Lk = MathUtils.lerp(1.05, 0.5, fall)
      p.Ra = MathUtils.lerp(-0.3, -0.2, fall)
      p.Rk = MathUtils.lerp(0.75, 0.45, fall)
      p.Lank = p.Rank = MathUtils.lerp(0.45, 0.15, fall)
    }
    p.aLx = MathUtils.lerp(-0.75, -0.3, fall)
    p.aRx = MathUtils.lerp(-0.6, -0.3, fall)
    p.aLz = Math.max(p.aLz, MathUtils.lerp(0.35, 0.7, fall))
    p.aRz = Math.min(p.aRz, -MathUtils.lerp(0.35, 0.7, fall))
    p.aLe = p.aRe = -0.4
    p.lean += MathUtils.lerp(-0.02, 0.06, fall)
    p.headX += MathUtils.lerp(-0.05, 0.08, fall) // eyes on the landing spot
  } else if (j.phase === 'land') {
    // knees soak up the landing, then the body comes back up
    const u = j.u
    const c = u < 0.22 ? smooth01(u / 0.22) : 1 - smooth01((u - 0.22) / 0.78)
    const imp = j.impact ?? 0.6
    p.pelvisY -= 0.11 * s * imp * c
    p.lean += 0.2 * imp * c
    p.aLz += 0.3 * imp * c
    p.aRz -= 0.3 * imp * c
    p.aLx -= 0.2 * imp * c
    p.aRx -= 0.2 * imp * c
    p.headX += 0.06 * imp * c
  }
}

/** Timbang / hopping on one foot: lean with the wobble, arms counter it, head stays level. */
function applyBalance(p, ctx) {
  const bal = ctx.motion?.balance ?? 0
  if (!bal) return
  const t = ctx.time
  p.side += -bal * 0.14
  p.pelvisRoll += bal * 0.05
  p.headZ += bal * 0.12 // keep the eyes (and the gundu) level
  p.aLz += -bal * 0.35
  p.aRz += -bal * 0.35
  const near = Math.max(0, Math.abs(bal) - 0.55) / 0.45
  if (near > 0) {
    p.aLz += Math.sin(t * 13) * 0.35 * near + 0.3 * near
    p.aRz += Math.sin(t * 11 + 1) * 0.35 * near - 0.3 * near
    p.aLx += Math.sin(t * 9) * 0.3 * near
    p.aRx += Math.sin(t * 8 + 2) * 0.3 * near
    p.Lz += 0.35 * near * Math.sign(bal)
    p.lean += 0.1 * near
    p.pelvisY -= 0.03 * near
  }
}

/** Breathing, weight shift, small fidgets, occasional reactions: the difference between a prop and a person. */
function applyLife(p, rig, ctx, stillness) {
  const t = ctx.time
  const sitting = SITTING.has(ctx.pose)
  const amp = rig.temperament === 'fidget' ? 1.8 : 1
  p.lean += Math.sin(t * 1.9) * 0.012
  p.headZ += Math.sin(t * 1.3) * 0.03 * stillness
  p.headX += Math.sin(t * 0.9 + 1) * 0.02 * stillness
  p.aLx += Math.sin(t * 0.7 + 0.5) * 0.03 * stillness
  p.aRx += Math.sin(t * 0.8 + 2) * 0.03 * stillness
  if (!sitting) {
    // weight from one foot to the other every few seconds
    const ws = (Math.sin(t * 0.33 * amp) + Math.sin(t * 0.21 + 2) * 0.5) * stillness * amp
    p.pelvisRoll += ws * 0.03
    p.side -= ws * 0.02
    p.pelvisY -= Math.abs(ws) * 0.006
  }
  if (rig.temperament === 'reactor' && ctx.now > rig.react.next) {
    rig.react.t = ctx.now
    rig.react.next = ctx.now + 6 + Math.random() * 8
  }
  const r = bump(ctx.now - rig.react.t, 0, 1.2)
  if (r) {
    // a nod and a small bounce, like they just saw a good shot
    p.headX += Math.sin((ctx.now - rig.react.t) * 10) * 0.12 * r
    if (!sitting) p.pelvisY -= Math.abs(Math.sin((ctx.now - rig.react.t) * 8)) * 0.02 * r
    p.aRz -= 0.25 * r
  }
}

const _inv = new Matrix4()
const _v = new Vector3()

/** Look target (world) → yaw/pitch in the person's frame, or null if it's behind them. */
function lookAngles(out, root, target, headY) {
  _inv.copy(root.matrixWorld).invert()
  _v.copy(target).applyMatrix4(_inv)
  out.yaw = Math.atan2(_v.x, _v.z)
  out.pitch = Math.atan2(_v.y - headY, Math.hypot(_v.x, _v.z))
  out.dist = Math.hypot(_v.x, _v.z)
  return Math.abs(out.yaw) < 2.0
}
const _look = { yaw: 0, pitch: 0, dist: 0 }

/** Look: explicit target, else watch someone nearby, else idle glances. Head first, a little torso. */
function applyLook(p, rig, ctx, root, stillness) {
  const motion = ctx.motion
  let want = 0
  let yaw = 0
  let pitch = 0
  const explicit = motion?.look
  if (explicit && root && lookAngles(_look, root, explicit, ctx.b.headY)) {
    want = 1
    yaw = _look.yaw
    pitch = _look.pitch
  } else if (CAN_LOOK.has(ctx.pose)) {
    if (ctx.watch && root && lookAngles(_look, root, ctx.watch, ctx.b.headY)) {
      const range = rig.temperament === 'watcher' ? 9 : 3.5
      if (_look.dist < range && Math.abs(_look.yaw) < 1.7) {
        want = smooth01((range - _look.dist) / 1.5)
        yaw = _look.yaw
        pitch = _look.pitch
      }
    }
    if (want < 0.5 && stillness > 0.5) {
      const g = rig.glance
      if (ctx.now > g.next) {
        const wide = rig.temperament === 'curious' ? 1 : 0.6
        g.yaw = (Math.random() * 2 - 1) * 0.9 * wide
        g.pitch = (Math.random() - 0.6) * 0.25
        g.until = ctx.now + 1.2 + Math.random() * 1.6
        g.next = g.until + (rig.temperament === 'curious' ? 1.5 : 3.5) + Math.random() * 4
      }
      if (ctx.now < g.until) {
        want = 1
        yaw = g.yaw
        pitch = g.pitch
      }
    }
  }
  const k = 1 - Math.exp(-5 * ctx.dt)
  rig.lookW += (want - rig.lookW) * k
  rig.lookYaw += (MathUtils.clamp(yaw, -1.4, 1.4) * (want > 0 ? 1 : 0) - rig.lookYaw) * k
  rig.lookPitch += (MathUtils.clamp(pitch, -0.6, 0.5) * (want > 0 ? 1 : 0) - rig.lookPitch) * k
  const w = rig.lookW
  const torso = MathUtils.clamp(rig.lookYaw * 0.3, -0.35, 0.35)
  p.twist += torso * w
  p.headY += MathUtils.clamp(rig.lookYaw - torso, -0.95, 0.95) * w
  p.headX += -rig.lookPitch * 0.8 * w
}

/**
 * Advance the rig one frame. Returns the final channel values (rig.cur plus
 * the additive layers) in `out`, and the solved leg angles.
 */
export function animateRig(rig, out, ctx, root) {
  const { motion, dt } = ctx
  const p = rig.tgt
  buildPose(p, ctx.pose, ctx)

  // stride phase: from distance when the controller provides it, else from speed
  const speed = motion?.speed ?? 0
  const run = motion?.run ?? 0
  if (motion?.dist !== undefined) {
    if (rig.lastDist === null) rig.lastDist = motion.dist
    const dd = Math.min(0.5, Math.max(0, motion.dist - rig.lastDist))
    rig.lastDist = motion.dist
    const cycle = MathUtils.lerp(0.9, 1.6, run) * (ctx.b.hip / 0.56)
    rig.walkPhase += (dd / cycle) * Math.PI * 2
  } else {
    rig.walkPhase += dt * (4 + speed * 9)
  }
  ctx.walkPhase = rig.walkPhase

  if (HOPPY.has(ctx.pose)) {
    applyBalance(p, ctx)
    applyJump(p, ctx)
  }

  // crossfade every channel towards the pose
  const cur = rig.cur
  if (!rig.started) {
    for (const c of CHANNELS) cur[c] = p[c]
    rig.started = true
  }
  const k = 1 - Math.exp(-p.fade * dt)
  for (const c of CHANNELS) cur[c] += (p[c] - cur[c]) * k

  for (const c of CHANNELS) out[c] = cur[c]

  // locomotion is blended after the crossfade so the fast stride cycle isn't smeared
  const grounded = !motion?.jump?.phase || motion.jump.phase === 'land'
  const locoWant = ctx.pose === 'idle' && grounded ? smooth01(speed / 0.2) : 0
  rig.loco += (locoWant - rig.loco) * (1 - Math.exp(-10 * dt))
  if (rig.loco > 0.001) applyLocomotion(out, rig, ctx, rig.loco)
  else rig.locoPelvis = 0

  const stillness = 1 - rig.loco
  if (LIFE.has(ctx.pose) || LIFE_SITTING.has(ctx.pose)) applyLife(out, rig, ctx, stillness)
  applyLook(out, rig, ctx, root, stillness)

  // legs: IK for planted feet (whatever the hips do), FK otherwise, blended
  const hipH = ctx.b.hip + out.pelvisY
  for (const side of ['L', 'R']) {
    const ik = MathUtils.clamp(out[`${side}ik`], 0, 1)
    let thigh = out[`${side}a`]
    let knee = out[`${side}k`]
    let ankle = out[`${side}ank`]
    if (ik > 0) {
      solveLeg(_leg, out[`${side}fz`], out[`${side}fy`] + FOOT_H + SOLE_CLEARANCE - hipH, ctx.T)
      thigh = MathUtils.lerp(thigh, _leg.thigh, ik)
      knee = MathUtils.lerp(knee, _leg.knee, ik)
      ankle = MathUtils.lerp(ankle, -(_leg.thigh + _leg.knee), ik)
    }
    out[`${side}thigh`] = thigh
    out[`${side}knee`] = knee
    out[`${side}ankle`] = ankle
    // hip roll tilts the legs; counter it so the feet stay under the body,
    // and roll planted soles back flat against the ground
    out[`${side}abd`] = out[`${side}z`] - out.pelvisRoll
    out[`${side}roll`] = -out[`${side}z`] * ik
  }
  return out
}
