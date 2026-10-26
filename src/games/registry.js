import { lazy } from 'react'

/**
 * Game id → component that runs the game. When a game's gameplay is built,
 * register it here; games without an entry show a friendly placeholder.
 * Every game component receives { game, mode, onExit }.
 *
 * Each game is its own chunk, downloaded only when needed (and prefetched
 * quietly once the kampung has loaded, so opening it is instant).
 */
const LOADERS = {
  congkak: () => import('./congkak/CongkakGame').then((m) => ({ default: m.CongkakGame })),
  dam: () => import('./dam/DamGame').then((m) => ({ default: m.DamGame })),
  'sepak-raga': () => import('./sepak-raga/SepakRagaGame').then((m) => ({ default: m.SepakRagaGame })),
  'ting-ting': () => import('./teng-teng/TengTengGame').then((m) => ({ default: m.TengTengGame })),
}

// pictures a game shows straight away, warmed up with its code
const PRELOAD_IMAGES = {
  congkak: ['/avatars/aisyah.webp', '/avatars/pemain-lelaki.webp', '/avatars/pemain-perempuan.webp', '/osom/batu.webp', '/osom/burung.webp', '/osom/air.webp'],
  dam: ['/avatars/pak-tam.webp', '/dam/kedai-kopi.webp', '/osom/batu.webp', '/osom/burung.webp', '/osom/air.webp'],
  'ting-ting': ['/avatars/rukiah.webp', '/teng/gundu-genting.webp', '/teng/gundu-batu.webp', '/teng/gundu-tin.webp', '/osom/batu.webp', '/osom/burung.webp', '/osom/air.webp'],
  'sepak-raga': ['/avatars/pak-nyaa.webp', '/avatars/pak-dil.webp', '/avatars/pok-pa.webp', '/avatars/pak-mi.webp', '/avatars/pak-ming.webp'],
}

export const GAME_COMPONENTS = Object.fromEntries(Object.entries(LOADERS).map(([id, load]) => [id, lazy(load)]))

/** Fetch every game's code and first pictures in the background. */
export function prefetchGames() {
  for (const [id, load] of Object.entries(LOADERS)) {
    load()
    for (const src of PRELOAD_IMAGES[id] ?? []) {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
    }
  }
}
