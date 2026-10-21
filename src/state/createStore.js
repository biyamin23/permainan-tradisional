import { useSyncExternalStore } from 'react'

/**
 * A tiny reactive store built on React's useSyncExternalStore.
 *
 * Why not plain useState/context? The 3D world lives inside a <Canvas>, which is a
 * separate React renderer. A store like this is readable from both the DOM UI and
 * the Canvas without context bridges, and stays easy to swap for zustand later.
 *
 * Selectors must return primitives or stable references.
 */
export function createStore(initialState) {
  let state = initialState
  const listeners = new Set()

  const getState = () => state

  const setState = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const useStore = (selector = (s) => s) =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    )

  return { getState, setState, subscribe, useStore }
}
