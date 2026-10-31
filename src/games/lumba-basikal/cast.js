/** Kamarul: the kampung's jaguh basikal. Confident, a bit cheeky, friendly. */
export const KAMARUL = {
  name: 'Kamarul',
  img: '/avatars/kamarul.webp',
  color: '#2f6fd1',
  // his cycling jersey: blue with yellow and red panels
  look: {
    skin: '#b97a50',
    hair: '#141012',
    hairStyle: 'short',
    top: 'blocks',
    shirt: '#2f6fd1',
    blocks: ['#f2c94c', '#e04a3a'],
    accent: '#2f6fd1',
    bottom: '#2c3550',
    bottomType: 'shorts',
    slipper: '#e04a3a',
    mouth: 'grin',
  },
}

/**
 * Riders who fill the empty seats in a race with friends (Kamarul first).
 * Each wears their own colours so they're easy to tell apart.
 */
const kid = (shirt, blocks, extra = {}) => ({
  skin: '#b97a50',
  hair: '#141012',
  hairStyle: 'short',
  top: 'blocks',
  shirt,
  blocks,
  accent: shirt,
  bottom: '#2c3550',
  bottomType: 'shorts',
  slipper: blocks[1],
  ...extra,
})
export const RIVALS = [
  KAMARUL,
  { name: 'Amru', color: '#e0782f', look: kid('#e0782f', ['#ffe08a', '#7a3b12'], { skin: '#c48a5c' }) },
  { name: 'Sameer', color: '#2e9e5b', look: kid('#2e9e5b', ['#d8f0c0', '#14532d'], { skin: '#9a6440', hair: '#2a1a12' }) },
  { name: 'Mei Ling', color: '#d14f8f', look: kid('#d14f8f', ['#ffd1e6', '#6b1d44'], { skin: '#e2b58c', hairStyle: 'pigtails', bottomType: 'kain' }) },
  { name: 'Raju', color: '#7b4fd1', look: kid('#7b4fd1', ['#e2d4ff', '#2e1a66'], { skin: '#7a4a2c' }) },
  { name: 'Siti', color: '#c9a227', look: kid('#c9a227', ['#fff2b3', '#6b5410'], { skin: '#c48558', hairStyle: 'pigtails', bottomType: 'kain' }) },
  { name: 'Ah Kau', color: '#2f8fb0', look: kid('#2f8fb0', ['#cdeefa', '#0f3d4d'], { skin: '#e8c19a' }) },
]

/** A colour per seat, for friends' shirts and their dots on the progress line. */
export const SEAT_COLORS = ['#2f4fb5', '#e04a3a', '#2e9e5b', '#c9a227', '#7b4fd1', '#e0782f', '#d14f8f', '#2f8fb0']
