/**
 * Game registry. The game selection UI is generated entirely from this list:
 * to add or unlock a game, edit the data here — no UI changes needed.
 *
 * status: 'available' | 'coming-soon'
 * modes:  which play modes the game will support
 */
export const GAME_STATUS = {
  AVAILABLE: 'available',
  COMING_SOON: 'coming-soon',
}

export const games = [
  {
    id: 'congkak',
    name: 'Congkak',
    tagline: 'Kumpul biji paling banyak dalam rumah sendiri.',
    status: GAME_STATUS.AVAILABLE,
    modes: ['solo', 'multiplayer'],
    players: '1–2 pemain',
    accent: '#c8642f',
    comingNote: 'Congkak — permainan akan dibina dalam fasa seterusnya.',
  },
  {
    id: 'gasing',
    name: 'Gasing',
    tagline: 'Pusing gasing paling lama, paling kuat.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#a2492f',
  },
  {
    id: 'wau',
    name: 'Wau',
    tagline: 'Terbangkan wau setinggi langit petang.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#c43d3d',
  },
  {
    id: 'batu-seremban',
    name: 'Batu Seremban',
    tagline: 'Lambung, kaut dan sambut dengan tangkas.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#8a6a3c',
  },
  {
    id: 'sepak-raga',
    name: 'Sepak Raga',
    tagline: 'Jaga bola rotan jangan jatuh ke tanah.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–6 pemain',
    accent: '#b9852e',
  },
  {
    id: 'guli',
    name: 'Guli',
    tagline: 'Jentik guli tepat masuk ke bulatan.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#2f7f8a',
  },
  {
    id: 'galah-panjang',
    name: 'Galah Panjang',
    tagline: 'Lepasi barisan penjaga tanpa disentuh.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['multiplayer'],
    players: '6–10 pemain',
    accent: '#4c7a3d',
  },
  {
    id: 'konda-kondi',
    name: 'Konda Kondi',
    tagline: 'Cungkil kayu kecil sejauh yang boleh.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '2–6 pemain',
    accent: '#7a5233',
  },
  {
    id: 'teng-teng',
    name: 'Teng-Teng',
    tagline: 'Lompat petak demi petak, jangan pijak garisan.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#d07a3a',
  },
  {
    id: 'tarik-upih',
    name: 'Tarik Upih',
    tagline: 'Tarik kawan atas pelepah pinang. Laju!',
    status: GAME_STATUS.COMING_SOON,
    modes: ['multiplayer'],
    players: '2 pemain',
    accent: '#6f8a3a',
  },
]

export const getGameById = (id) => games.find((game) => game.id === id)

export const isGameAvailable = (game) => game.status === GAME_STATUS.AVAILABLE
