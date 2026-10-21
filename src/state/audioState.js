import { createStore } from './createStore'

/**
 * Sound preference, remembered per browser.
 * all  = sound effects + ambience + music
 * sfx  = sound effects + ambience, no music
 * off  = silent
 */
export const SOUND_MODES = ['all', 'sfx', 'off']
const STORAGE_KEY = 'ptm-sound-mode'

function loadMode() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return SOUND_MODES.includes(saved) ? saved : 'all'
  } catch {
    return 'all'
  }
}

export const audioStore = createStore({ mode: typeof window === 'undefined' ? 'all' : loadMode() })

export const useAudioState = audioStore.useStore

export function setSoundMode(mode) {
  audioStore.setState({ mode })
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // storage unavailable (private mode) — keep the in-memory value
  }
}

export function cycleSoundMode() {
  const { mode } = audioStore.getState()
  const next = SOUND_MODES[(SOUND_MODES.indexOf(mode) + 1) % SOUND_MODES.length]
  setSoundMode(next)
  return next
}
