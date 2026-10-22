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
}

// pictures a game shows straight away, warmed up with its code
const PRELOAD_IMAGES = {
  congkak: ['/congkak/aisyah.webp', '/congkak/pemain-lelaki.webp', '/congkak/pemain-perempuan.webp'],
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
