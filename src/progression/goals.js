import { DAILY_POOL, GAME_IDS, GAME_NAMES, STREAK_MILESTONES, UNLOCKS, WEEKLY_COUNT, WEEKLY_POOL } from './config'
import { levelFromXP } from './rules'

/**
 * Short and medium-term goals: Cabaran Hari Ini (one per game, rotating by
 * date), Cabaran Minggu Ini (three a week), the streak, achievements and
 * cosmetic unlocks. All pure: they read a profile and say what changed.
 */

// ---------------------------------------------------------------- dates
const pad = (n) => String(n).padStart(2, '0')
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export function weekKey(date = new Date()) {
  // weeks start on Monday
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `W${dayKey(d)}`
}
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

const seeded = (key) => {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- daily
/** Today's five objectives (one per game), the same for everyone on that date. */
export function dailyFor(day) {
  const rand = seeded(`daily-${day}`)
  return GAME_IDS.map((gameId) => {
    const pool = DAILY_POOL[gameId]
    const pick = pool[Math.floor(rand() * pool.length)]
    return { gameId, id: pick.id, text: pick.text, done: false }
  })
}
export const dailyCheck = (item, metrics) => Boolean(DAILY_POOL[item.gameId]?.find((p) => p.id === item.id)?.check(metrics))

// ---------------------------------------------------------------- weekly
export function weeklyFor(week) {
  const rand = seeded(`weekly-${week}`)
  const pool = [...WEEKLY_POOL]
  const out = []
  while (out.length < WEEKLY_COUNT && pool.length) {
    const c = pool.splice(Math.floor(rand() * pool.length), 1)[0]
    out.push({ id: c.id, text: c.text, target: c.target, progress: 0, done: false, games: [] })
  }
  return out
}
/** Add a finished game to a weekly item. Returns true if this game completed it. */
export function weeklyAdvance(item, event) {
  if (item.done) return false
  const def = WEEKLY_POOL.find((w) => w.id === item.id)
  if (!def) return false
  if (def.distinctGames) {
    if (!item.games.includes(event.gameId)) item.games = [...item.games, event.gameId]
    item.progress = item.games.length
  } else item.progress += def.count(event)
  if (item.progress >= item.target) {
    item.progress = item.target
    item.done = true
    return true
  }
  return false
}

// ---------------------------------------------------------------- streak
/** Streak after playing on `today`: +1 if you also played yesterday, back to 1 after a gap. */
export function nextStreak(streak, today) {
  if (streak.lastDate === today) return streak
  const gap = streak.lastDate ? daysBetween(streak.lastDate, today) : null
  const current = gap === 1 ? streak.current + 1 : 1
  return { current, longest: Math.max(streak.longest ?? 0, current), lastDate: today }
}
export const streakMilestone = (before, after) => STREAK_MILESTONES.find((m) => before < m && after >= m) ?? null

// ---------------------------------------------------------------- achievements
const mastery = (p, id) => levelFromXP(p.games[id]?.xp ?? 0)
const perGame = (fn) => Object.fromEntries(GAME_IDS.map((id) => [id, fn(id)]))

export const ACHIEVEMENTS = [
  { id: 'first-game', icon: '🎈', name: 'Langkah Pertama', desc: 'Habiskan permainan pertama kamu.', check: (p) => p.totals.played >= 1 },
  ...GAME_IDS.map((id) => ({
    id: `first-win-${id}`,
    icon: '🏅',
    name: `Menang ${GAME_NAMES[id]}`,
    desc: `Menang ${GAME_NAMES[id]} buat kali pertama.`,
    check: (p) => (p.games[id]?.wins ?? 0) >= 1,
  })),
  ...GAME_IDS.map((id) => ({
    id: `mahir-${id}`,
    icon: '⭐',
    name: `Mahir ${GAME_NAMES[id]}`,
    desc: `Capai Mastery Lv. 5 dalam ${GAME_NAMES[id]}.`,
    check: (p) => mastery(p, id) >= 5,
  })),
  { id: 'all-games', icon: '🧺', name: 'Kenal Semua', desc: 'Main kelima-lima permainan.', check: (p) => GAME_IDS.every((id) => (p.games[id]?.played ?? 0) > 0) },
  { id: 'daily5', icon: '🖐️', name: 'Daily 5', desc: 'Main kelima-lima permainan dalam satu hari.', check: (p, e) => Boolean(e?.daily5) },
  { id: 'streak-7', icon: '🔥', name: 'Seminggu Tak Miss', desc: 'Main 7 hari berturut-turut.', check: (p) => p.streak.longest >= 7 },
  { id: 'records-5', icon: '📈', name: 'Pemecah Rekod', desc: 'Pecahkan 5 rekod peribadi.', check: (p) => (p.totals.recordsBroken ?? 0) >= 5 },
  { id: 'tough-win', icon: '💪', name: 'Lawan Sengit', desc: 'Menang perlawanan yang betul-betul mencabar.', check: (p, e) => Boolean(e?.won && e.difficulty >= 0.8) },
  { id: 'congkak-70', icon: '🐚', name: 'Lubuk Guli', desc: 'Menang Congkak dengan 70 guli atau lebih.', check: (p, e) => e?.gameId === 'congkak' && e.won && e.metrics.score >= 70 },
  { id: 'teng-clean', icon: '👣', name: 'Kaki Ringan', desc: 'Menang Teng-Teng tanpa mati sekali pun.', check: (p, e) => e?.gameId === 'ting-ting' && e.won && e.metrics.mistakes === 0 },
  { id: 'lumba-clean', icon: '🚲', name: 'Tak Jatuh Langsung', desc: 'Kalahkan Kamarul tanpa jatuh.', check: (p, e) => e?.gameId === 'lumba-basikal' && e.won && e.metrics.crashes === 0 },
  {
    id: 'lumba-all-tracks',
    icon: '🗺️',
    name: 'Raja Jalan Kampung',
    desc: 'Kalahkan Kamarul di ketiga-tiga litar.',
    check: (p) => ['mudah', 'biasa', 'jaguh'].every((t) => p.games['lumba-basikal']?.trackWins?.[t] > 0),
  },
  { id: 'all-mahir', icon: '🌈', name: 'Serba Boleh', desc: 'Capai Mastery Lv. 5 dalam kelima-lima permainan.', check: (p) => GAME_IDS.every((id) => mastery(p, id) >= 5) },
  { id: 'jaguh-kampung', icon: '👑', name: 'Jaguh Kampung', desc: 'Capai Level 20 keseluruhan.', check: (p) => levelFromXP(p.totalXP) >= 20 },
]

/** Achievements newly earned by this profile (after an event). */
export function newAchievements(profile, event) {
  return ACHIEVEMENTS.filter((a) => !profile.achievements[a.id] && a.check(profile, event))
}

// ---------------------------------------------------------------- unlocks
export function unlockedNow(profile) {
  const overall = levelFromXP(profile.totalXP)
  const masteries = perGame((id) => mastery(profile, id))
  return UNLOCKS.filter((u) => {
    const w = u.when
    if (w.overall !== undefined) return overall >= w.overall
    if (w.game) return masteries[w.game] >= w.mastery
    if (w.streak) return profile.streak.longest >= w.streak
    if (w.achievement) return Boolean(profile.achievements[w.achievement])
    return false
  }).map((u) => u.id)
}
