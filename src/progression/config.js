/**
 * Every number the progression system uses, in one place. Tune here, not in
 * the games. (See progression/README in engine.js for how they fit together.)
 */

/** The five games, by the ids the rest of the app already uses. */
export const GAME_IDS = ['congkak', 'dam', 'sepak-raga', 'ting-ting', 'lumba-basikal']

export const GAME_NAMES = {
  congkak: 'Congkak',
  dam: 'Dam Haji',
  'sepak-raga': 'Sepak Raga',
  'ting-ting': 'Teng-Teng',
  'lumba-basikal': 'Lumba Basikal',
}

// ---------------------------------------------------------------- levels
/** Level from XP: level = floor((xp / BASE) ^ (1 / EXP)) + 1 (same curve overall and per game). */
export const LEVEL_CURVE = { base: 100, exponent: 1.35 }

/** Overall titles (status only), from this level up. */
export const OVERALL_TITLES = [
  { level: 1, title: 'Budak Baru' },
  { level: 5, title: 'Murid Kampung' },
  { level: 10, title: 'Mahir' },
  { level: 20, title: 'Jaguh Kampung' },
  { level: 30, title: 'Legenda Kampung' },
]

/** Mastery titles per game (status only, never a difficulty setting). */
export const MASTERY_TITLES = [
  { level: 1, title: 'Mula' },
  { level: 5, title: 'Mahir' },
  { level: 10, title: 'Hebat' },
  { level: 20, title: 'Jaguh' },
  { level: 30, title: 'Legenda' },
]

// ---------------------------------------------------------------- XP rewards
export const XP = {
  play: 20, // finishing a game at all
  performance: 30, // × performanceScore (0..1)
  win: 30,
  difficulty: 20, // × difficultyScore: a harder game is worth more
  record: 25, // personal record broken (once per game)
  challenge: 50, // each daily challenge
  weekly: 120, // each weekly challenge
  daily5: 150, // all five games played in one day
  achievement: 25, // each new achievement
  /** Repeats of the same game today: × max(floor, 1 - step × gamesToday). Records/challenges aren't reduced. */
  repeat: { step: 0.05, floor: 0.5 },
  /** Sanity cap for one game (also enforced by the database). */
  maxPerGame: 700,
}

// ---------------------------------------------------------------- skill
export const SKILL = {
  initial: 400,
  min: 0,
  max: 1000,
  centre: 500, // skill at which you're expected to perform at 0.5
  spread: 150,
  k: 40, // how far one game moves it
  maxStep: 20, // never more than this per game
}

// ---------------------------------------------------------------- recent form
/** Weights for the last games, most recent first (renormalised when there are fewer). */
export const RECENT_WEIGHTS = [0.4, 0.2, 0.12, 0.08, 0.06, 0.04, 0.03, 0.03, 0.02, 0.02]
export const RECENT_DEFAULT = 0.35 // before the first game: lean gentle

// ---------------------------------------------------------------- difficulty
export const DIFFICULTY = {
  min: 0.1,
  max: 0.95,
  xpScale: 1500, // xpDifficulty = 1 - exp(-xp / xpScale)
  weights: { xp: 0.5, skill: 0.3, recent: 0.2 },
  smoothing: 0.25, // new = old × (1 - s) + target × s
  maxStep: 0.08, // per game
  /**
   * Flow: two strong games in a row nudge it up, two weak ones nudge it down.
   * The nudges add up in an offset (so a player who keeps losing does get an
   * easier game, whatever their XP), which slowly fades when results are mixed.
   */
  flow: { strong: 0.8, weak: 0.4, nudge: 0.04, maxOffset: 0.3, fade: 0.9 },
  /** Internal tiers (never shown to players). */
  tiers: [0.25, 0.45, 0.65, 0.8], // tier 1 below 0.25 … tier 5 from 0.8
  /** Hard limits per game: the hardest any player can ever meet. */
  perGame: {
    congkak: { min: 0.1, max: 0.92 },
    dam: { min: 0.1, max: 0.92 },
    'sepak-raga': { min: 0.1, max: 0.85 }, // a reaction game: demanding, still human
    'ting-ting': { min: 0.1, max: 0.85 },
    'lumba-basikal': { min: 0.1, max: 0.92 },
  },
}

// ---------------------------------------------------------------- performance
/** How much winning against a harder opponent counts: 0.5 + d × 0.5. */
export const difficultyPerformance = (d) => 0.5 + d * 0.5

// ---------------------------------------------------------------- daily / weekly
export const DAILY_TARGET = 5

/** One daily objective per game, picked by date from these. */
export const DAILY_POOL = {
  congkak: [
    { id: 'win', text: 'Menang 1 perlawanan Congkak.', check: (m) => m.won },
    { id: 'score50', text: 'Kumpul 50 guli atau lebih dalam rumah.', check: (m) => m.score >= 50 },
    { id: 'margin10', text: 'Menang dengan beza 10 guli.', check: (m) => m.won && m.margin >= 10 },
  ],
  dam: [
    { id: 'win', text: 'Menang 1 perlawanan Dam Haji.', check: (m) => m.won },
    { id: 'keep', text: 'Menang tanpa kehilangan lebih daripada 4 buah.', check: (m) => m.won && m.lost <= 4 },
    { id: 'king', text: 'Habiskan perlawanan dengan 6 buah atau lebih.', check: (m) => m.score >= 6 },
  ],
  'sepak-raga': [
    { id: 'score', text: 'Capai 20 mata.', check: (m) => m.score >= 20 },
    { id: 'win', text: 'Menang 1 perlawanan Sepak Raga.', check: (m) => m.won },
    { id: 'score30', text: 'Capai 30 mata.', check: (m) => m.score >= 30 },
  ],
  'ting-ting': [
    { id: 'clean', text: 'Habiskan tanpa mati sekali pun.', check: (m) => m.mistakes === 0 },
    { id: 'win', text: 'Menang 1 perlawanan Teng-Teng.', check: (m) => m.won },
    { id: 'house', text: 'Dapat sekurang-kurangnya 1 rumah.', check: (m) => m.score >= 1 },
  ],
  'lumba-basikal': [
    { id: 'beat', text: 'Kalahkan Kamarul.', check: (m) => m.won },
    { id: 'clean', text: 'Habiskan perlumbaan tanpa jatuh.', check: (m) => m.crashes === 0 },
    { id: 'fast', text: 'Habiskan bawah masa sasaran litar.', check: (m) => m.underPar },
  ],
}

/** Weekly challenges (3 a week, picked by week). `count` adds to progress after each game. */
export const WEEKLY_POOL = [
  { id: 'win5', text: 'Menang 5 permainan.', target: 5, count: (e) => (e.won ? 1 : 0) },
  { id: 'all5', text: 'Main semua 5 permainan.', target: 5, distinctGames: true },
  { id: 'kamarul3', text: 'Kalahkan Kamarul 3 kali.', target: 3, count: (e) => (e.gameId === 'lumba-basikal' && e.won ? 1 : 0) },
  { id: 'raga100', text: 'Kumpul 100 mata sepak raga.', target: 100, count: (e) => (e.gameId === 'sepak-raga' ? e.metrics.score ?? 0 : 0) },
  { id: 'congkak3', text: 'Menang 3 permainan Congkak.', target: 3, count: (e) => (e.gameId === 'congkak' && e.won ? 1 : 0) },
  { id: 'play10', text: 'Main 10 permainan.', target: 10, count: () => 1 },
  { id: 'teng3', text: 'Menang 3 permainan Teng-Teng.', target: 3, count: (e) => (e.gameId === 'ting-ting' && e.won ? 1 : 0) },
  { id: 'dam3', text: 'Menang 3 permainan Dam Haji.', target: 3, count: (e) => (e.gameId === 'dam' && e.won ? 1 : 0) },
  { id: 'records3', text: 'Pecahkan 3 rekod peribadi.', target: 3, count: (e) => e.recordsBroken },
]
export const WEEKLY_COUNT = 3

/** Streak milestones (days in a row with at least one finished game). Rewards are cosmetic. */
export const STREAK_MILESTONES = [3, 7, 14, 30]

// ---------------------------------------------------------------- unlocks (cosmetic only)
/**
 * kind: title (gelaran beside your name) | frame (avatar ring) | badge
 * when: what unlocks it (overall level, a game's mastery, a streak, an achievement)
 */
export const UNLOCKS = [
  { id: 'frame-kayu', kind: 'frame', name: 'Bingkai Kayu', color: '#8a5d36', when: { overall: 1 } },
  { id: 'frame-padi', kind: 'frame', name: 'Bingkai Padi', color: '#8db05a', when: { overall: 3 } },
  { id: 'title-murid', kind: 'title', name: 'Murid Kampung', when: { overall: 5 } },
  { id: 'frame-senja', kind: 'frame', name: 'Bingkai Senja', color: '#e2622b', when: { overall: 8 } },
  { id: 'title-mahir', kind: 'title', name: 'Mahir Permainan', when: { overall: 10 } },
  { id: 'frame-emas', kind: 'frame', name: 'Bingkai Emas', color: '#f2c14e', when: { overall: 15 } },
  { id: 'title-jaguh', kind: 'title', name: 'Jaguh Kampung', when: { overall: 20 } },
  { id: 'title-legenda', kind: 'title', name: 'Legenda Kampung', when: { overall: 30 } },
  { id: 'title-raja-congkak', kind: 'title', name: 'Raja Congkak', when: { game: 'congkak', mastery: 10 } },
  { id: 'title-pakcik-dam', kind: 'title', name: 'Otai Dam Haji', when: { game: 'dam', mastery: 10 } },
  { id: 'title-kaki-raga', kind: 'title', name: 'Kaki Raga', when: { game: 'sepak-raga', mastery: 10 } },
  { id: 'title-ratu-teng', kind: 'title', name: 'Juara Teng-Teng', when: { game: 'ting-ting', mastery: 10 } },
  { id: 'title-pelumba', kind: 'title', name: 'Pelumba Kampung', when: { game: 'lumba-basikal', mastery: 10 } },
  { id: 'badge-streak-7', kind: 'badge', name: 'Seminggu Berturut', icon: '🔥', when: { streak: 7 } },
  { id: 'badge-streak-30', kind: 'badge', name: 'Sebulan Berturut', icon: '🏮', when: { streak: 30 } },
  { id: 'badge-daily5', kind: 'badge', name: 'Daily 5', icon: '🖐️', when: { achievement: 'daily5' } },
  { id: 'frame-pelangi', kind: 'frame', name: 'Bingkai Pelangi', color: 'conic-gradient(#e8645a, #f2c14e, #5fb35a, #4fb6c9, #e9779a, #e8645a)', when: { achievement: 'all-mahir' } },
]

/**
 * Game-specific unlocks the games themselves use (litar, …): game → [{ id, mastery }].
 * Lumba Basikal's litar open as you get better at it.
 */
export const GAME_UNLOCKS = {
  'lumba-basikal': [
    { id: 'mudah', mastery: 1 },
    { id: 'biasa', mastery: 2 },
    { id: 'jaguh', mastery: 3 },
  ],
}

// ---------------------------------------------------------------- earlier records
/** One-off seed XP from records kept before progression existed (so regulars aren't reset to zero). */
export const MIGRATION_XP = { win: 60, loss: 35, draw: 45, cap: 2500 }
