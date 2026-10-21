import { sfx } from '../audio/engine'
import { createStore } from './createStore'

/** Which interaction zone the player is currently standing in (if any). */
export const interactionStore = createStore({ activeZoneId: null })

export const useInteractionState = interactionStore.useStore

/** Short message bubbles shown at the bottom of the screen. */
export const toastStore = createStore({ message: null, key: 0 })

export const useToastState = toastStore.useStore

export function showToast(message) {
  sfx.pop()
  toastStore.setState((s) => ({ message, key: s.key + 1 }))
}

export function clearToast() {
  toastStore.setState({ message: null })
}
