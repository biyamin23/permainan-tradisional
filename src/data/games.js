/**
 * Game registry. Everything game-related is generated from this list:
 * the game spots in the kampung, their interaction zones, labels and the
 * kids playing there. To add or unlock a game, edit the data here.
 *
 * status:  'available' | 'coming-soon'
 * modes:   which play modes the game will support
 * spot:    where the game is played in the kampung
 *          position [x, z] in metres, radius of the interaction zone, rotationY
 * lines:   what the kids at the spot say when you walk past
 */
export const GAME_STATUS = {
  AVAILABLE: 'available',
  COMING_SOON: 'coming-soon',
}

export const games = [
  {
    id: 'congkak',
    name: 'Congkak',
    emoji: '🐚',
    tagline: 'Kumpul biji paling banyak dalam rumah sendiri.',
    status: GAME_STATUS.AVAILABLE,
    modes: ['solo', 'multiplayer'],
    players: '1–2 pemain',
    accent: '#c8642f',
    spot: { position: [25, -13], radius: 4.6, rotationY: -0.91 },
    lines: ['Jom lawan aku main congkak!', 'Rumah aku dah penuh biji!'],
  },
  {
    id: 'gasing',
    name: 'Gasing',
    emoji: '🌀',
    tagline: 'Pusing gasing paling lama, paling kuat.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#a2492f',
    spot: { position: [8, -6], radius: 4, rotationY: 0.4 },
    lines: ['Gasing aku paling lama berpusing!', 'Tengok ni, pangkah!'],
  },
  {
    id: 'wau',
    name: 'Wau',
    emoji: '🪁',
    tagline: 'Terbangkan wau setinggi langit petang.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#c43d3d',
    spot: { position: [34, -2], radius: 4.6, rotationY: 0 },
    lines: ['Wau bulan aku tinggi, kan?', 'Angin petang ni kuat!'],
  },
  {
    id: 'batu-seremban',
    name: 'Batu Seremban',
    emoji: '🪨',
    tagline: 'Lambung, kaut dan sambut dengan tangkas.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#8a6a3c',
    spot: { position: [-3.8, 15], radius: 3.4, rotationY: 0 },
    lines: ['Buah satu… buah dua…', 'Jangan jatuh, jangan jatuh!'],
  },
  {
    id: 'sepak-raga',
    name: 'Sepak Raga',
    emoji: '🏐',
    tagline: 'Jaga bola rotan jangan jatuh ke tanah.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–6 pemain',
    accent: '#b9852e',
    spot: { position: [15, 4], radius: 4.4, rotationY: 0 },
    lines: ['Hoi, sambut!', 'Jangan bagi jatuh!'],
  },
  {
    id: 'guli',
    name: 'Guli',
    emoji: '🔮',
    tagline: 'Jentik guli tepat masuk ke bulatan.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#2f7f8a',
    spot: { position: [-10, -17], radius: 3.6, rotationY: 0.3 },
    lines: ['Guli siapa paling cantik?', 'Kena! Masuk bulatan!'],
  },
  {
    id: 'galah-panjang',
    name: 'Galah Panjang',
    emoji: '🏃',
    tagline: 'Lepasi barisan penjaga tanpa disentuh.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['multiplayer'],
    players: '6–10 pemain',
    accent: '#4c7a3d',
    spot: { position: [14, -17], radius: 5.2, rotationY: 0 },
    lines: ['Lari, lari! Jangan kena tangkap!', 'Aku jaga garisan ni!'],
  },
  {
    id: 'konda-kondi',
    name: 'Konda Kondi',
    emoji: '🪵',
    tagline: 'Cungkil kayu kecil sejauh yang boleh.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '2–6 pemain',
    accent: '#7a5233',
    spot: { position: [-27, -14], radius: 4.4, rotationY: -Math.PI / 2 },
    lines: ['Tengok kayu aku terbang!', 'Jauhnya!'],
  },
  {
    id: 'teng-teng',
    name: 'Teng-Teng',
    emoji: '👣',
    tagline: 'Lompat petak demi petak, jangan pijak garisan.',
    status: GAME_STATUS.COMING_SOON,
    modes: ['solo', 'multiplayer'],
    players: '1–4 pemain',
    accent: '#d07a3a',
    spot: { position: [8, 32], radius: 4, rotationY: 0 },
    lines: ['Satu, dua, tiga… teng!', 'Jangan pijak garisan!'],
  },
  {
    id: 'tarik-upih',
    name: 'Tarik Upih',
    emoji: '🍃',
    tagline: 'Tarik kawan atas pelepah pinang. Laju!',
    status: GAME_STATUS.COMING_SOON,
    modes: ['multiplayer'],
    players: '2 pemain',
    accent: '#6f8a3a',
    spot: { position: [38, -16], radius: 5.4, rotationY: 0 },
    lines: ['Laju lagi, laju lagi!', 'Giliran aku pula nanti!'],
  },
]

export const getGameById = (id) => games.find((game) => game.id === id)

export const isGameAvailable = (game) => game.status === GAME_STATUS.AVAILABLE

/** The HUD compass points the player to the first playable game. */
export const OBJECTIVE_GAME = games.find(isGameAvailable) ?? games[0]
