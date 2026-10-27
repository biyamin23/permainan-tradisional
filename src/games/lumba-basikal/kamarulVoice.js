import { voice } from '../../audio/engine'

/**
 * Kamarul's recorded lines (public/audio/kamarul) and which race moments
 * they go with. One line at a time (the voice player won't overlap), a
 * cooldown per moment, and a short gap between any two lines so he never
 * chatters. Each line comes with its words for the speech bubble.
 */

const CLIP = (name) => `/audio/kamarul/${name}.mp3`

const WORDS = {
  'berani-lawan': 'Berani lawan Kamarul?',
  jom: 'Jom!',
  'eh-laju-juga': 'Eh, laju juga!',
  'jangan-potong': 'Woi! Jangan potong!',
  tinggal: 'Haa… tinggal!',
  'kejar-la': 'Kejar la!',
  aduh: 'Aduh!',
  bagus: 'Bagus!',
  'kamarul-menang': 'Ha! Kamarul menang!',
  'alah-kalah': 'Alah… kalah pula.',
  'nasib-baik': 'Ha ha! Nasib baik je tu!',
  'nak-lumba-lagi': 'Nak lumba lagi?',
}

// moment → lines, seconds before the same moment may speak again
export const KAMARUL_EVENTS = {
  PRE_RACE: { clips: ['berani-lawan'], cooldown: 60 },
  RACE_START: { clips: ['jom'], cooldown: 60, urgent: true },
  PLAYER_NEAR: { clips: ['eh-laju-juga'], cooldown: 30 },
  PLAYER_OVERTAKE: { clips: ['jangan-potong', 'eh-laju-juga'], cooldown: 14 },
  KAMARUL_OVERTAKE: { clips: ['tinggal', 'kejar-la'], cooldown: 14 },
  PLAYER_CRASH: { clips: ['tinggal'], cooldown: 18 },
  KAMARUL_CRASH: { clips: ['aduh'], cooldown: 8, urgent: true },
  FINAL_STRETCH: { clips: ['kejar-la'], cooldown: 60 },
  FINAL_STRETCH_BEHIND: { clips: ['jangan-potong'], cooldown: 60 },
  KAMARUL_WIN: { clips: ['kamarul-menang'], cooldown: 0, urgent: true },
  KAMARUL_LOSE: { clips: ['alah-kalah', 'nasib-baik', 'bagus'], cooldown: 0, urgent: true },
  REMATCH: { clips: ['nak-lumba-lagi'], cooldown: 0 },
}

const GAP = 3.2 // seconds between any two lines

export function preloadKamarulVoice() {
  voice.preload(Object.keys(WORDS).map(CLIP))
}

/** say(event, now) → the words spoken, or null if he stays quiet this time. */
export function createKamarulVoice() {
  const last = new Map()
  let lastAny = -99
  return {
    say(event, now) {
      const e = KAMARUL_EVENTS[event]
      if (!e) return null
      if (now - (last.get(event) ?? -999) < e.cooldown) return null
      if (!e.urgent && now - lastAny < GAP) return null
      const urls = e.clips.map(CLIP)
      const index = voice.playFromGroup(`kamarul-${event}`, urls)
      if (index < 0) return null // another line still playing, or sound locked
      last.set(event, now)
      lastAny = now
      return WORDS[e.clips[index]]
    },
    reset() {
      last.clear()
      lastAny = -99
    },
  }
}
