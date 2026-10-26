import { Color } from 'three'
import { createStore } from './createStore'

/**
 * Kampung time: always 5 petang (no day/night cycle). The sky keyframes below
 * still describe the whole day, so the debug helper can show other hours.
 */
export const START_HOUR = 17

export const clock = { hour: START_HOUR, daylight: 1, night: 0 }

export const timeStore = createStore({ minute: Math.floor(START_HOUR * 60) })
export const useTimeState = timeStore.useStore

export function resetClock() {
  clock.hour = START_HOUR
  timeStore.setState({ minute: Math.floor(START_HOUR * 60) })
}

/** Set the clock to an hour (debug only). */
export function setClockHour(hour) {
  clock.hour = hour % 24
  timeStore.setState({ minute: Math.floor(clock.hour * 60) })
}

const PERIODS = [
  { until: 5, name: 'Malam', icon: '🌙' },
  { until: 7, name: 'Subuh', icon: '🌄' },
  { until: 12, name: 'Pagi', icon: '🌅' },
  { until: 14, name: 'Tengah hari', icon: '☀️' },
  { until: 19, name: 'Petang', icon: '🌇' },
  { until: 20, name: 'Senja', icon: '🌆' },
  { until: 24, name: 'Malam', icon: '🌙' },
]

export function describeTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  const period = PERIODS.find((p) => hour < p.until) ?? PERIODS[0]
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return { ...period, label: `${h12}:${String(minute).padStart(2, '0')}` }
}

// ------------------------------------------------------------------ sky keyframes
/**
 * Colour and light settings through the day. Values are interpolated between
 * keyframes, wrapping around midnight.
 */
const RAW_KEYFRAMES = [
  { h: 0, fog: '#0d1530', hemiSky: '#33456f', hemiGround: '#0b120c', hemi: 0.32, sun: '#9fb4ff', sunI: 0.45, cloud: '#2a3350', cloudGlow: 0 },
  { h: 5.2, fog: '#141c3a', hemiSky: '#3a4a78', hemiGround: '#0e140e', hemi: 0.35, sun: '#9fb4ff', sunI: 0.45, cloud: '#323b5c', cloudGlow: 0 },
  { h: 6.4, fog: '#c98a8a', hemiSky: '#e8a8a0', hemiGround: '#3a4a2a', hemi: 0.6, sun: '#ff9a6a', sunI: 0.9, cloud: '#ffd2c0', cloudGlow: 0.45 },
  { h: 7.5, fog: '#f2c8a0', hemiSky: '#ffe0c0', hemiGround: '#4d6a33', hemi: 0.85, sun: '#ffc690', sunI: 2.0, cloud: '#fff0e2', cloudGlow: 0.3 },
  { h: 10, fog: '#bcd8ec', hemiSky: '#e9f3ff', hemiGround: '#5a7a3a', hemi: 1.0, sun: '#fff3dc', sunI: 2.7, cloud: '#ffffff', cloudGlow: 0.05 },
  { h: 13, fog: '#c4def0', hemiSky: '#eef6ff', hemiGround: '#5f803c', hemi: 1.05, sun: '#ffffff', sunI: 3.0, cloud: '#ffffff', cloudGlow: 0 },
  { h: 16.5, fog: '#e8d4b0', hemiSky: '#fff0d6', hemiGround: '#55743a', hemi: 1.0, sun: '#ffdcaa', sunI: 2.8, cloud: '#fff6ea', cloudGlow: 0.15 },
  { h: 18.3, fog: '#f0c08d', hemiSky: '#ffe2bd', hemiGround: '#4d6a33', hemi: 0.95, sun: '#ffbd7d', sunI: 2.7, cloud: '#fff3e2', cloudGlow: 0.35 },
  { h: 19.3, fog: '#9a6080', hemiSky: '#d890a0', hemiGround: '#2a3322', hemi: 0.6, sun: '#ff7a50', sunI: 0.9, cloud: '#e8a0a8', cloudGlow: 0.5 },
  { h: 20.3, fog: '#1c2448', hemiSky: '#3a4a7a', hemiGround: '#0e140e', hemi: 0.38, sun: '#a9c1ff', sunI: 0.5, cloud: '#3a4266', cloudGlow: 0 },
  { h: 24, fog: '#0d1530', hemiSky: '#33456f', hemiGround: '#0b120c', hemi: 0.32, sun: '#9fb4ff', sunI: 0.45, cloud: '#2a3350', cloudGlow: 0 },
]

const COLOR_KEYS = ['fog', 'hemiSky', 'hemiGround', 'sun', 'cloud']
const KEYFRAMES = RAW_KEYFRAMES.map((k) => {
  const out = { ...k }
  COLOR_KEYS.forEach((key) => {
    out[key] = new Color(k[key])
  })
  return out
})

const sample = {
  fog: new Color(),
  hemiSky: new Color(),
  hemiGround: new Color(),
  sun: new Color(),
  cloud: new Color(),
  hemi: 1,
  sunI: 1,
  cloudGlow: 0,
}

export const SUNRISE = 6.9
export const SUNSET = 19.3

/** Interpolated sky settings for an hour (returns a shared object). */
export function sampleSky(hour) {
  let i = 0
  while (i < KEYFRAMES.length - 2 && hour >= KEYFRAMES[i + 1].h) i++
  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const t = Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h)))
  const s = t * t * (3 - 2 * t)
  COLOR_KEYS.forEach((key) => sample[key].copy(a[key]).lerp(b[key], s))
  sample.hemi = a.hemi + (b.hemi - a.hemi) * s
  sample.sunI = a.sunI + (b.sunI - a.sunI) * s
  sample.cloudGlow = a.cloudGlow + (b.cloudGlow - a.cloudGlow) * s
  return sample
}

/** 1 in full daylight, 0 at night, smooth through dawn and dusk. */
export function daylightAt(hour) {
  const rise = Math.min(1, Math.max(0, (hour - (SUNRISE - 0.6)) / 1.2))
  const set = Math.min(1, Math.max(0, (SUNSET + 0.6 - hour) / 1.2))
  return Math.min(rise, set)
}
