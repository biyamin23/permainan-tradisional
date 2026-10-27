import { difficultyPerformance } from './config'
import { clamp } from './rules'

/**
 * How well a game went, 0..1, and the personal records it can set. Each game
 * defines what "good" means; they all report the same shape:
 *
 *   metrics: { won, draw, score, theirs, seconds, mistakes, … game-specific }
 *
 * performance = result quality, how convincing it was, how clean, and a
 * little credit for the strength of the opposition.
 */

const result = (m) => (m.won ? 1 : m.draw ? 0.5 : 0)
const share = (a, b) => (a + b > 0 ? a / (a + b) : 0.5)

const CALC = {
  // 98 guli: winning matters most, then by how much
  congkak: (m, d) => 0.5 * result(m) + 0.35 * clamp((share(m.score, m.theirs) - 0.3) / 0.4, 0, 1) + 0.15 * difficultyPerformance(d),
  // 12 buah each: winning, then the material you kept against what they kept
  dam: (m, d) => 0.55 * result(m) + 0.3 * clamp(0.5 + (m.score - m.theirs) / 16, 0, 1) + 0.15 * difficultyPerformance(d),
  // points against points
  'sepak-raga': (m, d) => 0.45 * result(m) + 0.4 * clamp((share(m.score, m.theirs) - 0.25) / 0.5, 0, 1) + 0.15 * difficultyPerformance(d),
  // rumah, and how few times you were "mati"
  'ting-ting': (m, d) =>
    0.5 * result(m) + 0.25 * clamp(share(m.score, m.theirs), 0, 1) + 0.1 * clamp(1 - (m.mistakes ?? 0) / 6, 0, 1) + 0.15 * difficultyPerformance(d),
  // finishing first, a good time, few crashes, every checkpoint
  'lumba-basikal': (m, d) =>
    0.4 * result(m) +
    0.25 * clamp(1 - (m.time / m.par - 0.9) / 0.6, 0, 1) +
    0.15 * clamp(1 - (m.crashes * 2 + (m.hits ?? 0)) / 8, 0, 1) +
    0.1 * clamp(m.checkpoints ?? 1, 0, 1) +
    0.1 * difficultyPerformance(d),
}

/** Normalised performance for a finished game. */
export function performanceScore(gameId, metrics, difficulty) {
  const f = CALC[gameId]
  return clamp(f ? f(metrics, difficulty) : result(metrics), 0, 1)
}

/**
 * Personal records each game keeps.
 * key: { label, better: 'higher' | 'lower', value(metrics, game) → number | null (null = not set this game), format }
 */
const secs = (v) => {
  const m = Math.floor(v / 60)
  return `${String(m).padStart(2, '0')}:${(v - m * 60).toFixed(1).padStart(4, '0')}`
}
export const RECORDS = {
  congkak: {
    highestScore: { label: 'Guli paling banyak', better: 'higher', value: (m) => m.score },
    bestWinStreak: { label: 'Menang berturut-turut', better: 'higher', value: (m, g) => g.bestWinStreak },
    fastestWin: { label: 'Menang paling cepat', better: 'lower', value: (m) => (m.won ? m.seconds : null), format: secs },
  },
  dam: {
    highestScore: { label: 'Buah tinggal paling banyak', better: 'higher', value: (m) => (m.won ? m.score : null) },
    bestWinStreak: { label: 'Menang berturut-turut', better: 'higher', value: (m, g) => g.bestWinStreak },
    fastestWin: { label: 'Menang paling cepat', better: 'lower', value: (m) => (m.won ? m.seconds : null), format: secs },
  },
  'sepak-raga': {
    highestScore: { label: 'Mata paling tinggi', better: 'higher', value: (m) => m.score },
    bestWinStreak: { label: 'Menang berturut-turut', better: 'higher', value: (m, g) => g.bestWinStreak },
  },
  'ting-ting': {
    mostHouses: { label: 'Rumah paling banyak', better: 'higher', value: (m) => m.score },
    fewestMistakes: { label: 'Menang dengan mati paling sedikit', better: 'lower', value: (m) => (m.won ? m.mistakes ?? 0 : null) },
    fastestWin: { label: 'Menang paling cepat', better: 'lower', value: (m) => (m.won ? m.seconds : null), format: secs },
  },
  'lumba-basikal': {
    fastestTime: { label: 'Masa terpantas (semua litar)', better: 'lower', value: (m) => m.time, format: secs },
    fewestCrashes: { label: 'Jatuh paling sedikit (menang)', better: 'lower', value: (m) => (m.won ? m.crashes : null) },
    bestWinStreak: { label: 'Kalahkan Kamarul berturut-turut', better: 'higher', value: (m, g) => g.bestWinStreak },
  },
}

/**
 * Compare a game's metrics with the stored records.
 * Returns { records (updated copy), broken: [{ key, label, value, previous }] }.
 * A first value is stored but isn't a "record broken" (nothing to beat yet).
 */
export function updateRecords(gameId, metrics, game) {
  const defs = RECORDS[gameId] ?? {}
  const records = { ...(game.records ?? {}) }
  const broken = []
  for (const [key, def] of Object.entries(defs)) {
    const v = def.value(metrics, game)
    if (v === null || v === undefined || !Number.isFinite(v)) continue
    const prev = records[key]
    if (prev === undefined) {
      records[key] = v
      continue
    }
    const better = def.better === 'higher' ? v > prev : v < prev
    if (better) {
      records[key] = v
      broken.push({ key, label: def.label, value: v, previous: prev, text: def.format ? def.format(v) : String(v) })
    }
  }
  return { records, broken }
}
