/**
 * A tiny message bus between the living parts of the kampung: a kid skims a
 * stone and the river shows the ripples, Pak Abu gets a bite and the water
 * splashes, without either knowing how the other is drawn. Handlers are
 * registered by the components that draw the effect (RiverLife…); emitting
 * with no handler does nothing.
 */
const handlers = new Map()

export const worldFx = {
  on(name, fn) {
    handlers.set(name, fn)
    return () => {
      if (handlers.get(name) === fn) handlers.delete(name)
    }
  },
  /** Returns what the handler returned (false: it had nothing to do). */
  emit(name, ...args) {
    return handlers.get(name)?.(...args)
  },
}

/** Pick from a weighted { key: weight } table, skipping `not`. */
export function weightedPick(table, random = Math.random, not = null) {
  const entries = Object.entries(table).filter(([k]) => k !== not)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = random() * total
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[entries.length - 1]?.[0] ?? not
}

export const between = (min, max, random = Math.random) => min + random() * (max - min)
