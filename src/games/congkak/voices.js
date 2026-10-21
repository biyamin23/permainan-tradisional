/**
 * Aisyah's recorded voice lines (public/audio/aisyah). When you try to jump
 * the queue on her turn she says one of these, shuffled so you hear all five
 * before any repeats. `text` is what her speech bubble shows with the clip.
 */
const SECONDS = [3.3, 3.4, 4.8, 3.3, 3.4]

export const SABAR_LINES = SECONDS.map((seconds, i) => ({
  src: `/audio/aisyah/sabar-${i + 1}.mp3`,
  seconds,
  text: 'Sabar la, tunggu giliran awak!',
}))
