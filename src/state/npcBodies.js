import { useEffect } from 'react'
import { createStore } from './createStore'

/**
 * Registry of moving characters that need a physical body (kids, villagers,
 * the cyclist). Each entry points at the character's visual group; a single
 * <NpcColliders/> inside <Physics> gives every entry a kinematic capsule that
 * follows that group's world position, so the player can't walk through them
 * and moving NPCs gently push the player aside.
 */
export const npcBodyStore = createStore({ bodies: [] })

let nextId = 1

export function useNpcBody(ref, { radius = 0.3, halfHeight = 0.45 } = {}) {
  useEffect(() => {
    const entry = { id: nextId++, ref, radius, halfHeight }
    npcBodyStore.setState((s) => ({ bodies: [...s.bodies, entry] }))
    return () => npcBodyStore.setState((s) => ({ bodies: s.bodies.filter((b) => b !== entry) }))
  }, [ref, radius, halfHeight])
}
