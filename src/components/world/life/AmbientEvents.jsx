import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RIVERS } from '../../../data/kampungLayout'
import { worldRuntime } from '../../../state/worldRuntime'
import { samplesAlong } from '../Water'
import { between, worldFx } from './worldFx'

/**
 * The kampung's little surprises, all from one place: twice a second each
 * event that is off its cooldown gets a small chance to happen. Most need
 * you nearby (a fish jumping a field away is a fish nobody saw). The events
 * themselves are drawn by whoever listens on worldFx (RiverLife, Animals,
 * Wildlife); this only decides when.
 */

const TICK = 0.5

const riverSamples = RIVERS.map((r) => samplesAlong(r.points, 2))

/** A point on the water within `maxDist` of you, with the current's direction. */
function waterNear(maxDist) {
  const p = worldRuntime.playerPosition
  for (let tries = 0; tries < 10; tries++) {
    const samples = riverSamples[Math.random() < 0.3 ? 0 : 1]
    const s = samples[Math.floor(Math.random() * samples.length)]
    if (Math.hypot(s.x - p.x, s.z - p.z) > maxDist) continue
    const w = between(-1.8, 1.8)
    return { x: s.x - s.dirZ * w, z: s.z + s.dirX * w, dirX: s.dirX, dirZ: s.dirZ }
  }
  return null
}

const EVENTS = [
  {
    id: 'fishJump',
    cooldown: 7,
    chance: 0.1,
    run() {
      const at = waterNear(40)
      if (!at) return false
      worldFx.emit('fishJump', at.x, at.z, at.dirX, at.dirZ)
      return true
    },
  },
  {
    // a water insect touching down: the tiniest ring
    id: 'insect',
    cooldown: 4,
    chance: 0.25,
    run() {
      const at = waterNear(25)
      if (!at) return false
      worldFx.emit('ripple', at.x, at.z, 0.3)
      return true
    },
  },
  { id: 'chickenCross', cooldown: 35, chance: 0.05, run: () => worldFx.emit('chickenCross') !== false },
  { id: 'birdsMove', cooldown: 40, chance: 0.03, run: () => worldFx.emit('birdsMove') !== false },
]

export function AmbientEvents() {
  const state = useMemo(() => Object.fromEntries(EVENTS.map((e) => [e.id, between(0, e.cooldown)])), [])
  const timer = useRef(0)
  useFrame((_, delta) => {
    timer.current += Math.min(delta, 0.1)
    if (timer.current < TICK) return
    timer.current = 0
    for (const e of EVENTS) {
      state[e.id] -= TICK
      if (state[e.id] > 0 || Math.random() > e.chance) continue
      // tried and nothing to do (no water near you…): look again soon
      state[e.id] = e.run() ? e.cooldown * between(0.8, 1.5) : 3
    }
  })
  return null
}
