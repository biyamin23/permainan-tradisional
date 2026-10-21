import { audioStore } from '../state/audioState'

/**
 * Procedural audio, synthesised with the Web Audio API — no sound files.
 *
 * Buses: sfx (UI + footsteps), ambience (wind, birds, crickets, water…) and
 * music (a gentle pentatonic tune with a kompang-like drum). Everything is a
 * safe no-op until the first user gesture unlocks the AudioContext.
 */

let ctx = null
let master = null
let sfxBus = null
let ambBus = null
let musicBus = null
let noiseBuffer = null

const MUSIC_LEVEL = { landing: 0.5, kampung: 0.32 }
let musicScene = 'landing'

// ------------------------------------------------------------------ setup
function createNoiseBuffer(context) {
  const length = context.sampleRate * 2
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function makeGain(value, destination) {
  const g = ctx.createGain()
  g.gain.value = value
  g.connect(destination)
  return g
}

function applyMode(mode) {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(mode === 'off' ? 0 : 1, t, 0.08)
  musicBus.gain.setTargetAtTime(mode === 'all' ? MUSIC_LEVEL[musicScene] : 0, t, 0.3)
  if (mode === 'all') music.start()
}

/** Create/resume the AudioContext. Must be called from a user gesture the first time. */
export function initAudio() {
  if (typeof window === 'undefined') return null
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -16
  compressor.ratio.value = 3
  compressor.connect(ctx.destination)
  master = makeGain(1, compressor)
  sfxBus = makeGain(0.9, master)
  ambBus = makeGain(0.85, master)
  musicBus = makeGain(0, master)
  noiseBuffer = createNoiseBuffer(ctx)

  // iOS unlock: play one silent buffer inside the gesture
  const silent = ctx.createBufferSource()
  silent.buffer = ctx.createBuffer(1, 1, 22050)
  silent.connect(ctx.destination)
  silent.start(0)

  applyMode(audioStore.getState().mode)
  audioStore.subscribe(() => applyMode(audioStore.getState().mode))
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend()
    else ctx.resume()
  })
  return ctx
}

/** Unlock audio on the first tap/click/key anywhere. */
export function installAudioUnlock() {
  const unlock = () => {
    initAudio()
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('touchend', unlock, true)
    }
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
  window.addEventListener('touchend', unlock, true)
}

const ready = () => ctx && ctx.state === 'running'

// ------------------------------------------------------------------ voices
function panNode(pan, destination) {
  if (!pan || !ctx.createStereoPanner) return destination
  const p = ctx.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(destination)
  return p
}

function tone({
  freq,
  freqEnd,
  type = 'sine',
  at = 0,
  attack = 0.005,
  decay = 0.2,
  gain = 0.1,
  bus = sfxBus,
  pan = 0,
  filter,
}) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  let out = g
  if (filter) {
    const f = ctx.createBiquadFilter()
    f.type = filter.type ?? 'lowpass'
    f.frequency.value = filter.freq
    f.Q.value = filter.q ?? 0.7
    g.connect(f)
    out = f
  }
  out.connect(panNode(pan, bus))
  osc.connect(g)
  osc.start(t)
  osc.stop(t + attack + decay + 0.05)
}

function noise({ at = 0, dur = 0.1, gain = 0.05, type = 'lowpass', freq = 1000, freqEnd, q = 0.7, bus = sfxBus, pan = 0, attack = 0.004 }) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(panNode(pan, bus))
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

// ------------------------------------------------------------------ sound effects
export const sfx = {
  tap() {
    if (!ready()) return
    tone({ freq: 660, freqEnd: 990, type: 'triangle', decay: 0.06, gain: 0.07 })
  },
  select() {
    if (!ready()) return
    tone({ freq: 784, decay: 0.22, gain: 0.08 })
    tone({ freq: 1175, at: 0.08, decay: 0.3, gain: 0.07 })
  },
  open() {
    if (!ready()) return
    noise({ dur: 0.28, gain: 0.04, type: 'bandpass', freq: 400, freqEnd: 1800, q: 1.2 })
    tone({ freq: 523, at: 0.05, decay: 0.25, gain: 0.05 })
  },
  close() {
    if (!ready()) return
    tone({ freq: 700, freqEnd: 420, type: 'triangle', decay: 0.12, gain: 0.06 })
  },
  locked() {
    if (!ready()) return
    tone({ freq: 330, freqEnd: 250, type: 'triangle', decay: 0.12, gain: 0.07 })
    tone({ freq: 262, freqEnd: 200, type: 'triangle', at: 0.13, decay: 0.16, gain: 0.07 })
  },
  prompt() {
    if (!ready()) return
    tone({ freq: 1320, decay: 0.08, gain: 0.025 })
  },
  pop() {
    if (!ready()) return
    tone({ freq: 520, freqEnd: 820, decay: 0.1, gain: 0.05 })
  },
  talk() {
    if (!ready()) return
    for (let i = 0; i < 4; i++) {
      tone({ freq: 420 + Math.random() * 380, type: 'triangle', at: i * 0.07, decay: 0.05, gain: 0.04 })
    }
  },
  // ---- congkak
  seedDrop(step = 0) {
    if (!ready()) return
    const f = 1500 + ((step * 137) % 600)
    tone({ freq: f, freqEnd: f * 0.8, type: 'sine', decay: 0.05, gain: 0.05 })
    noise({ dur: 0.025, gain: 0.025, type: 'bandpass', freq: 3000, q: 2 })
  },
  seedPickup() {
    if (!ready()) return
    for (let i = 0; i < 4; i++) {
      noise({ at: i * 0.025, dur: 0.03, gain: 0.03, type: 'bandpass', freq: 2200 + Math.random() * 1200, q: 3 })
    }
  },
  capture() {
    if (!ready()) return
    ;[659, 784, 988, 1319].forEach((f, i) => tone({ freq: f, at: i * 0.06, decay: 0.25, gain: 0.06 }))
    for (let i = 0; i < 8; i++) {
      tone({ freq: 1600 + Math.random() * 900, at: 0.1 + i * 0.03, decay: 0.04, gain: 0.03 })
    }
  },
  extraTurn() {
    if (!ready()) return
    tone({ freq: 880, decay: 0.15, gain: 0.06 })
    tone({ freq: 1320, at: 0.1, decay: 0.3, gain: 0.06 })
  },
  win() {
    if (!ready()) return
    ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.12, decay: 0.35, gain: 0.08 }))
  },
  lose() {
    if (!ready()) return
    ;[523, 466, 392, 349].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.18, decay: 0.4, gain: 0.07 }))
  },
  draw() {
    if (!ready()) return
    ;[523, 659, 523].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.15, decay: 0.3, gain: 0.07 }))
  },
  footstep(surface = 'grass', running = false) {
    if (!ready()) return
    const level = running ? 1.25 : 1
    if (surface === 'wood') {
      noise({ dur: 0.07, gain: 0.1 * level, type: 'bandpass', freq: 520 + Math.random() * 80, q: 3 })
      tone({ freq: 150 + Math.random() * 20, decay: 0.06, gain: 0.05 * level })
    } else if (surface === 'dirt') {
      noise({ dur: 0.06, gain: 0.07 * level, type: 'lowpass', freq: 1400 + Math.random() * 400, q: 0.8 })
    } else {
      noise({ dur: 0.07, gain: 0.05 * level, type: 'lowpass', freq: 700 + Math.random() * 300, q: 0.6 })
    }
  },
}

// ------------------------------------------------------------------ ambience
const ambience = {
  running: false,
  timers: [],
  sources: [],
  streamGain: null,
  near: { stream: 99, pond: 99, chickens: 99, bike: 99, bikeMoving: false, night: 0 },
  lastBell: -99,
}

function loopNoise(filterType, freq, q, gainValue) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = filterType
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.value = gainValue
  src.connect(f).connect(g).connect(ambBus)
  src.start()
  ambience.sources.push(src)
  return g
}

function schedule(fn, min, max) {
  const run = () => {
    if (!ambience.running) return
    fn()
    ambience.timers.push(setTimeout(run, (min + Math.random() * (max - min)) * 1000))
  }
  ambience.timers.push(setTimeout(run, Math.random() * max * 1000))
}

function birdChirp() {
  if (!ready() || Math.random() < ambience.near.night) return
  const pan = Math.random() * 1.6 - 0.8
  const notes = 2 + Math.floor(Math.random() * 4)
  const base = 2300 + Math.random() * 1800
  for (let i = 0; i < notes; i++) {
    const f = base * (1 + (Math.random() - 0.3) * 0.25)
    tone({ freq: f, freqEnd: f * 1.35, at: i * 0.09, decay: 0.06, gain: 0.018, bus: ambBus, pan })
  }
}

function crickets() {
  if (!ready()) return
  // crickets sing mostly after dusk
  if (Math.random() > 0.35 + ambience.near.night * 0.65) return
  const pan = Math.random() * 1.8 - 0.9
  const f = 4200 + Math.random() * 500
  for (let i = 0; i < 3; i++) {
    tone({ freq: f, at: i * 0.055, attack: 0.004, decay: 0.025, gain: 0.008, bus: ambBus, pan })
  }
}

function frog() {
  if (!ready() || ambience.near.pond > 16) return
  const level = Math.max(0, 1 - ambience.near.pond / 16) * (0.35 + ambience.near.night * 0.65)
  const pan = Math.random() * 1.2 - 0.6
  for (let i = 0; i < 2; i++) {
    tone({ freq: 190, freqEnd: 150, type: 'square', at: i * 0.16, decay: 0.09, gain: 0.03 * level, bus: ambBus, pan, filter: { freq: 900 } })
  }
}

function cluck() {
  if (!ready() || ambience.near.chickens > 14) return
  const level = Math.max(0.15, 1 - ambience.near.chickens / 14)
  const pulses = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < pulses; i++) {
    tone({
      freq: 560,
      freqEnd: 430,
      type: 'sawtooth',
      at: i * 0.13,
      decay: 0.06,
      gain: 0.035 * level,
      bus: ambBus,
      filter: { type: 'bandpass', freq: 1300, q: 2 },
    })
  }
  if (Math.random() > 0.6) {
    tone({ freq: 760, freqEnd: 520, type: 'sawtooth', at: pulses * 0.13, decay: 0.2, gain: 0.03 * level, bus: ambBus, filter: { type: 'bandpass', freq: 1400, q: 2 } })
  }
}

function bell() {
  if (!ready()) return
  for (const at of [0, 0.2]) {
    tone({ freq: 2350, at, decay: 0.9, gain: 0.035, bus: ambBus })
    tone({ freq: 3520, at, decay: 0.6, gain: 0.02, bus: ambBus })
    tone({ freq: 4700, at, decay: 0.4, gain: 0.012, bus: ambBus })
  }
}

export function startAmbience() {
  if (!ctx || ambience.running) return
  ambience.running = true
  // soft evening wind with a slow swell
  const wind = loopNoise('lowpass', 380, 0.5, 0.05)
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.07
  lfoGain.gain.value = 0.03
  lfo.connect(lfoGain).connect(wind.gain)
  lfo.start()
  ambience.sources.push(lfo)
  // stream water, volume follows distance
  ambience.streamGain = loopNoise('bandpass', 1100, 0.45, 0)
  schedule(birdChirp, 1.4, 5)
  schedule(crickets, 0.5, 1.4)
  schedule(frog, 2, 5)
  schedule(cluck, 1.5, 4)
  musicScene = 'kampung'
  applyMode(audioStore.getState().mode)
}

export function stopAmbience() {
  ambience.running = false
  ambience.timers.forEach(clearTimeout)
  ambience.timers = []
  ambience.sources.forEach((s) => {
    try {
      s.stop()
    } catch {
      // already stopped
    }
  })
  ambience.sources = []
  ambience.streamGain = null
  musicScene = 'landing'
  if (ctx) applyMode(audioStore.getState().mode)
}

/** Called a few times per second with distances from the player. */
export function updateAmbience(near) {
  Object.assign(ambience.near, near)
  if (!ctx || !ambience.running) return
  if (ambience.streamGain) {
    const level = Math.max(0, 1 - near.stream / 24) ** 2 * 0.2
    ambience.streamGain.gain.setTargetAtTime(level, ctx.currentTime, 0.4)
  }
  if (near.bikeMoving && near.bike < 11 && ctx.currentTime - ambience.lastBell > 9) {
    ambience.lastBell = ctx.currentTime
    bell()
  }
}

// ------------------------------------------------------------------ music
const BPM = 84
const EIGHTH = 60 / BPM / 2
// D major pentatonic, two octaves
const SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880]
const BASS = [146.83, 123.47, 98, 110] // D – B – G – A
const DRUM = ['D', '', 's', '', 'D', 's', 's', '']

function pluck(freq, at, gain = 0.05) {
  tone({ freq, type: 'triangle', at, attack: 0.004, decay: 0.55, gain, bus: musicBus, filter: { freq: 2400 } })
  tone({ freq: freq * 2, at, attack: 0.004, decay: 0.25, gain: gain * 0.25, bus: musicBus })
}

const music = {
  running: false,
  step: 0,
  nextTime: 0,
  timer: null,
  phrase: [],
  degree: 3,
  start() {
    if (!ctx || this.running) return
    this.running = true
    this.nextTime = ctx.currentTime + 0.1
    this.timer = setInterval(() => this.tick(), 90)
  },
  makePhrase() {
    const phrase = []
    for (let i = 0; i < 16; i++) {
      if (Math.random() < 0.32 && i % 4 !== 0) {
        phrase.push(null)
        continue
      }
      this.degree = Math.max(0, Math.min(SCALE.length - 1, this.degree + Math.round((Math.random() - 0.5) * 3)))
      phrase.push(this.degree)
    }
    return phrase
  },
  tick() {
    if (!ctx) return
    if (audioStore.getState().mode !== 'all') return
    // after a pause (tab hidden, music switched off) restart cleanly instead of catching up
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05
    while (this.nextTime < ctx.currentTime + 0.3) {
      const at = this.nextTime - ctx.currentTime
      const bar = Math.floor(this.step / 8)
      const inBar = this.step % 8
      // a phrase is two bars; every phrase is played twice for a hummable feel
      if (this.step % 32 === 0) this.phrase = this.makePhrase()
      const note = this.phrase[this.step % 16]
      if (note !== null && note !== undefined) pluck(SCALE[note], at, inBar % 2 === 0 ? 0.05 : 0.035)
      if (inBar === 0 || inBar === 4) {
        tone({ freq: BASS[bar % 4], type: 'sine', at, attack: 0.01, decay: 0.7, gain: 0.07, bus: musicBus })
      }
      const hit = DRUM[inBar]
      if (hit === 'D') tone({ freq: 120, freqEnd: 62, at, attack: 0.003, decay: 0.18, gain: 0.08, bus: musicBus })
      if (hit === 's') noise({ at, dur: 0.05, gain: 0.025, type: 'bandpass', freq: 3200, q: 1.2, bus: musicBus })
      this.step += 1
      this.nextTime += EIGHTH
    }
  },
}
