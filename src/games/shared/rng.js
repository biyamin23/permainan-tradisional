/**
 * Seeded randomness. Online, both players' screens must roll the same dice:
 * every match has one seed, and anything random in the rules comes from a
 * generator made from it (same seed → same numbers, in the same order).
 * Drop-in for Math.random: rng() returns a number in [0, 1).
 */

/** mulberry32: small, fast, good enough for games. */
export function seededRandom(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A separate stream from the same seed (e.g. 'starter', 'round-2'), so one use doesn't shift another. */
export function streamFor(seed, label) {
  let h = seed >>> 0
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0
  return seededRandom(h)
}
