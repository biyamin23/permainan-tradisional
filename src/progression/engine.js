import { createStore } from '../state/createStore'
import { tuningFor } from './adapters'
import { GAME_IDS, GAME_UNLOCKS, MIGRATION_XP, SKILL, XP } from './config'
import { dailyCheck, dailyFor, dayKey, newAchievements, nextStreak, streakMilestone, unlockedNow, weekKey, weeklyAdvance, weeklyFor } from './goals'
import { RECORDS, performanceScore, updateRecords } from './performance'
import { clamp, levelProgress, masteryTitle, nextDifficulty, overallTitle, startingDifficulty, tierOf, updateSkill } from './rules'

/**
 * The progression engine: the one place XP, mastery, skill, recent form,
 * difficulty, records, challenges, streak, achievements and unlocks are
 * worked out. Games only call:
 *
 *   const session = startGame(gameId)           // difficulty + the game's tuning for this match
 *   const reward = completeGame(session, metrics) // once per match (idempotent by sessionId)
 *
 * The profile lives on the device (localStorage) and is copied to the
 * account by cloud/progress.js, which listens for `onProgress`.
 */

const KEY = 'ptm-progress-v1'
const OLD_RECORDS = {
  congkak: 'ptm-congkak-records',
  dam: 'ptm-dam-records',
  'sepak-raga': 'ptm-sepak-raga-records',
  'ting-ting': 'ptm-teng-teng-records',
  'lumba-basikal': 'ptm-lumba-basikal-records',
}

const freshGame = (gameId) => ({
  gameId,
  xp: 0,
  skill: SKILL.initial,
  results: [], // last 10: { sessionId, at, won, performance, difficulty, xp }
  difficulty: startingDifficulty(gameId),
  flowOffset: 0,
  played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  winStreak: 0,
  bestWinStreak: 0,
  records: {},
  lastPlayedAt: null,
})

export function freshProfile() {
  const now = new Date().toISOString()
  return {
    version: 1,
    totalXP: 0,
    games: Object.fromEntries(GAME_IDS.map((id) => [id, freshGame(id)])),
    streak: { current: 0, longest: 0, lastDate: null },
    days: {}, // day → { counts: { gameId: n }, daily5: bool }
    daily: { day: null, items: [] },
    weekly: { week: null, items: [] },
    achievements: {}, // id → ISO date
    unlocks: [],
    equipped: { title: null, frame: 'frame-kayu' },
    totals: { played: 0, wins: 0, seconds: 0, recordsBroken: 0 },
    sessions: [], // recent session ids (duplicate guard)
    migrated: false,
    createdAt: now,
    updatedAt: now,
  }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && raw.version === 1) {
      const base = freshProfile()
      return { ...base, ...raw, games: Object.fromEntries(GAME_IDS.map((id) => [id, { ...freshGame(id), ...(raw.games?.[id] ?? {}) }])) }
    }
  } catch {
    /* fall through */
  }
  return freshProfile()
}

function save(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    /* storage unavailable: progress lasts this visit */
  }
}

/** One-off: records kept before progression existed become starting XP and stats. */
function migrate(profile) {
  if (profile.migrated) return profile
  const p = structuredClone(profile)
  for (const id of GAME_IDS) {
    let old = null
    try {
      old = JSON.parse(localStorage.getItem(OLD_RECORDS[id]) || 'null')
    } catch {
      old = null
    }
    if (!old) continue
    const g = p.games[id]
    const wins = old.wins ?? 0
    const losses = old.losses ?? 0
    const draws = old.draws ?? 0
    const played = wins + losses + draws
    if (!played) continue
    const xp = Math.min(MIGRATION_XP.cap, wins * MIGRATION_XP.win + losses * MIGRATION_XP.loss + draws * MIGRATION_XP.draw)
    g.xp = Math.max(g.xp, xp)
    g.played = Math.max(g.played, played)
    g.wins = Math.max(g.wins, wins)
    g.losses = Math.max(g.losses, losses)
    g.draws = Math.max(g.draws, draws)
    // a winning record starts a little above a new player, a losing one a little below
    g.skill = clamp(SKILL.initial + ((wins - losses) / Math.max(4, played)) * 200, 250, 650)
    g.difficulty = startingDifficulty(id, g.xp, g.skill)
    if (id === 'lumba-basikal' && old.tracks) g.trackWins = Object.fromEntries(Object.entries(old.tracks).map(([t, r]) => [t, r.wins ?? 0]))
    p.totalXP += xp
    p.totals.played += played
    p.totals.wins += wins
  }
  p.migrated = true
  p.unlocks = unlockedNow(p)
  return p
}

export const progressStore = createStore({ profile: migrate(load()) })
save(progressStore.getState().profile)
export const useProgress = progressStore.useStore

const listeners = new Set()
/** Cloud sync (or anything else) hears about every completed game and profile change. */
export const onProgress = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function commit(profile, event = null) {
  profile.updatedAt = new Date().toISOString()
  save(profile)
  progressStore.setState({ profile })
  listeners.forEach((fn) => fn({ profile, event }))
}

/** Replace the profile (after merging with the account's copy). */
export function replaceProfile(profile, silent = false) {
  save(profile)
  progressStore.setState({ profile })
  if (!silent) listeners.forEach((fn) => fn({ profile, event: null }))
}

// ---------------------------------------------------------------- reading
export const getProfile = () => progressStore.getState().profile

/** Mastery summary for a game: { level, title, xp, fraction (to next level) }. */
export function masteryOf(profile, gameId) {
  const xp = profile.games[gameId]?.xp ?? 0
  const { level, fraction } = levelProgress(xp)
  return { level, title: masteryTitle(level), xp, fraction }
}

export function overallOf(profile) {
  const xp = profile.totalXP
  const { level, fraction } = levelProgress(xp)
  return { level, title: overallTitle(level), xp, fraction }
}

/** Is a game-specific unlock (e.g. a litar) open? */
export function gameUnlocked(profile, gameId, id) {
  const rule = GAME_UNLOCKS[gameId]?.find((u) => u.id === id)
  return !rule || masteryOf(profile, gameId).level >= rule.mastery
}

/** Today's and this week's challenges, rolled over when the date moves on. */
export function currentGoals(profile = getProfile()) {
  const day = dayKey()
  const week = weekKey()
  const daily = profile.daily.day === day ? profile.daily : { day, items: dailyFor(day) }
  const weekly = profile.weekly.week === week ? profile.weekly : { week, items: weeklyFor(week) }
  return { daily, weekly, today: profile.days[day] ?? { counts: {}, daily5: false } }
}

// ---------------------------------------------------------------- a match
let override = null
/** Dev only: force the difficulty of the next matches (null = adaptive). */
export const setDifficultyOverride = (d) => {
  override = d
}

/** Start a match: the difficulty (fixed for the whole match) and the game's tuning. */
export function startGame(gameId) {
  const g = getProfile().games[gameId] ?? freshGame(gameId)
  const difficulty = override ?? g.difficulty
  return {
    sessionId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    gameId,
    difficulty,
    tier: tierOf(difficulty),
    tuning: tuningFor(gameId, difficulty),
    startedAt: Date.now(),
    reward: null,
  }
}

/**
 * Finish a match. metrics: { won, draw, score, theirs, seconds?, mistakes?, … }.
 * Safe to call twice: the second call returns the first reward.
 */
export function completeGame(session, metrics) {
  if (session.reward) return session.reward
  const before = getProfile()
  if (before.sessions.includes(session.sessionId)) return null
  const p = structuredClone(before)
  const gameId = session.gameId
  const g = p.games[gameId]
  const d = session.difficulty
  const seconds = metrics.seconds ?? Math.round((Date.now() - session.startedAt) / 1000)
  const m = { ...metrics, seconds }
  const won = Boolean(m.won)
  const draw = !won && Boolean(m.draw)
  const today = dayKey()

  const masteryBefore = masteryOf(before, gameId)
  const overallBefore = overallOf(before)

  // ----- statistics
  g.played += 1
  if (won) {
    g.wins += 1
    g.winStreak += 1
    g.bestWinStreak = Math.max(g.bestWinStreak, g.winStreak)
  } else {
    if (draw) g.draws += 1
    else g.losses += 1
    g.winStreak = 0
  }
  if (gameId === 'lumba-basikal' && won && m.trackId) g.trackWins = { ...(g.trackWins ?? {}), [m.trackId]: (g.trackWins?.[m.trackId] ?? 0) + 1 }
  g.lastPlayedAt = new Date().toISOString()
  p.totals.played += 1
  p.totals.wins += won ? 1 : 0
  p.totals.seconds += seconds

  // ----- performance and records
  const performance = performanceScore(gameId, m, d)
  const rec = updateRecords(gameId, m, g)
  g.records = rec.records
  p.totals.recordsBroken = (p.totals.recordsBroken ?? 0) + rec.broken.length

  // ----- XP: the match itself (softly reduced for many repeats today), then bonuses
  const dayStats = p.days[today] ?? { counts: {}, daily5: false }
  const repeats = dayStats.counts[gameId] ?? 0
  const repeat = Math.max(XP.repeat.floor, 1 - XP.repeat.step * repeats)
  const parts = []
  const add = (label, xp, game = true) => {
    if (xp > 0) parts.push({ label, xp: Math.round(xp), game })
  }
  add('Main', XP.play * repeat)
  add('Prestasi', performance * XP.performance * repeat)
  if (won) add('Menang', XP.win * repeat)
  add('Cabaran lawan', d * XP.difficulty * repeat)
  if (rec.broken.length) add('Rekod baru', XP.record)

  // ----- today: counts, the daily challenge for this game, Daily 5
  dayStats.counts = { ...dayStats.counts, [gameId]: repeats + 1 }
  const goals = currentGoals(p)
  p.daily = { ...goals.daily, items: goals.daily.items.map((i) => ({ ...i })) }
  const challengesDone = []
  for (const item of p.daily.items) {
    if (item.gameId === gameId && !item.done && dailyCheck(item, m)) {
      item.done = true
      challengesDone.push(item.text)
      add('Cabaran hari ini', XP.challenge, false)
    }
  }
  let daily5 = false
  if (!dayStats.daily5 && GAME_IDS.every((id) => (dayStats.counts[id] ?? 0) > 0)) {
    dayStats.daily5 = true
    daily5 = true
    add('Daily 5', XP.daily5, false)
  }
  p.days = { ...Object.fromEntries(Object.entries(p.days).filter(([k]) => k >= dayKey(new Date(Date.now() - 14 * 86400000)))), [today]: dayStats }

  // ----- this week
  p.weekly = { ...goals.weekly, items: goals.weekly.items.map((i) => ({ ...i })) }
  const event = { gameId, won, difficulty: d, performance, metrics: m, recordsBroken: rec.broken.length, daily5 }
  const weeklyDone = []
  for (const item of p.weekly.items) {
    if (weeklyAdvance(item, event)) {
      weeklyDone.push(item.text)
      add('Cabaran minggu ini', XP.weekly, false)
    }
  }

  // ----- streak
  const streakBefore = p.streak.current
  p.streak = nextStreak(p.streak, today)
  const milestone = streakMilestone(streakBefore, p.streak.current)

  // ----- XP into the game and overall
  let gameXP = parts.filter((x) => x.game).reduce((a, x) => a + x.xp, 0)
  let totalXP = parts.reduce((a, x) => a + x.xp, 0)
  if (totalXP > XP.maxPerGame) {
    const k = XP.maxPerGame / totalXP
    gameXP = Math.floor(gameXP * k)
    totalXP = XP.maxPerGame
  }
  g.xp += gameXP
  p.totalXP += totalXP

  // ----- skill, recent form, next difficulty
  const skillBefore = g.skill
  g.skill = updateSkill(g.skill, performance)
  g.results = [...g.results, { sessionId: session.sessionId, at: new Date().toISOString(), won, performance, difficulty: d, xp: gameXP }].slice(-10)
  const next = nextDifficulty(gameId, g)
  g.difficulty = next.difficulty
  g.flowOffset = next.flowOffset

  // ----- achievements and unlocks
  const earned = newAchievements(p, event)
  for (const a of earned) {
    p.achievements[a.id] = new Date().toISOString()
    p.totalXP += XP.achievement
    totalXP += XP.achievement
  }
  const unlocksBefore = new Set(p.unlocks)
  p.unlocks = unlockedNow(p)
  const newUnlocks = p.unlocks.filter((u) => !unlocksBefore.has(u))

  p.sessions = [...p.sessions, session.sessionId].slice(-60)

  const reward = {
    sessionId: session.sessionId,
    gameId,
    won,
    draw,
    xp: totalXP,
    gameXP,
    parts,
    repeat,
    performance,
    mastery: { before: masteryBefore, after: masteryOf(p, gameId) },
    overall: { before: overallBefore, after: overallOf(p) },
    records: rec.broken,
    achievements: earned.map(({ id, icon, name, desc }) => ({ id, icon, name, desc })),
    unlocks: newUnlocks,
    challenges: challengesDone,
    weekly: weeklyDone,
    daily5,
    streak: { current: p.streak.current, milestone },
    debug: { difficulty: d, nextDifficulty: g.difficulty, skillBefore, skill: g.skill },
  }
  session.reward = reward
  commit(p, {
    sessionId: session.sessionId,
    gameId,
    won,
    performance: Math.round(performance * 1000) / 1000,
    difficulty: Math.round(d * 1000) / 1000,
    xp: totalXP,
    gameXP,
  })
  return reward
}

/** Choose a title or frame you've unlocked (cosmetic). */
export function equip(kind, id) {
  const p = structuredClone(getProfile())
  if (id !== null && !p.unlocks.includes(id)) return
  p.equipped = { ...p.equipped, [kind]: id }
  commit(p)
}

// ---------------------------------------------------------------- dev tools
export const devTools = {
  reset() {
    commit({ ...freshProfile(), migrated: true })
  },
  addXP(gameId, xp) {
    const p = structuredClone(getProfile())
    p.games[gameId].xp += xp
    p.totalXP += xp
    p.unlocks = unlockedNow(p)
    commit(p)
  },
  /** Pretend a player of some level: skill and history set, difficulty recomputed. */
  simulate(gameId, kind) {
    const p = structuredClone(getProfile())
    const presets = {
      new: { xp: 0, skill: SKILL.initial, perf: [] },
      low: { xp: 300, skill: 250, perf: [0.2, 0.3, 0.15, 0.25] },
      average: { xp: 900, skill: 480, perf: [0.5, 0.6, 0.45, 0.55] },
      skilled: { xp: 3000, skill: 780, perf: [0.85, 0.9, 0.8, 0.88] },
    }
    const s = presets[kind]
    const g = { ...freshGame(gameId), xp: s.xp, skill: s.skill, played: s.perf.length }
    g.results = s.perf.map((perf, i) => ({ sessionId: `sim-${i}`, at: new Date().toISOString(), won: perf > 0.5, performance: perf, difficulty: 0.5, xp: 0 }))
    g.difficulty = startingDifficulty(gameId, s.xp, s.skill)
    for (let i = 0; i < 6; i++) Object.assign(g, nextDifficulty(gameId, g))
    p.games[gameId] = g
    commit(p)
  },
  /** Play out n quick results (win or lose) through the real engine. */
  results(gameId, n, won) {
    for (let i = 0; i < n; i++) {
      const s = startGame(gameId)
      completeGame(s, won ? { won: true, score: 60, theirs: 38, time: 70, par: 80, crashes: 0, mistakes: 0, checkpoints: 1 } : { won: false, score: 30, theirs: 68, time: 110, par: 80, crashes: 2, mistakes: 3, checkpoints: 1 })
    }
  },
}

// ---------------------------------------------------------------- merging (device ⇄ account)
/**
 * Combine this device's profile with the account's copy without losing
 * anything: XP and counts take the bigger, records the better, achievements
 * and sessions the union; skill/form/difficulty come from whichever copy of
 * that game has played more.
 */
export function mergeProfiles(a, b) {
  if (!b || b.version !== 1) return a
  const out = structuredClone(a)
  out.totalXP = Math.max(a.totalXP, b.totalXP)
  for (const id of GAME_IDS) {
    const ga = a.games[id] ?? freshGame(id)
    const gb = { ...freshGame(id), ...(b.games?.[id] ?? {}) }
    const base = gb.played > ga.played || (gb.played === ga.played && gb.xp > ga.xp) ? gb : ga
    const g = structuredClone(base)
    for (const k of ['xp', 'played', 'wins', 'losses', 'draws', 'bestWinStreak']) g[k] = Math.max(ga[k] ?? 0, gb[k] ?? 0)
    const records = { ...(ga.records ?? {}) }
    for (const [k, v] of Object.entries(gb.records ?? {})) {
      const def = RECORDS[id]?.[k]
      if (records[k] === undefined || !def) records[k] = records[k] ?? v
      else records[k] = def.better === 'higher' ? Math.max(records[k], v) : Math.min(records[k], v)
    }
    g.records = records
    if (ga.trackWins || gb.trackWins) {
      g.trackWins = { ...(ga.trackWins ?? {}) }
      for (const [t, n] of Object.entries(gb.trackWins ?? {})) g.trackWins[t] = Math.max(g.trackWins[t] ?? 0, n)
    }
    out.games[id] = g
  }
  const sa = a.streak
  const sb = b.streak ?? sa
  out.streak = (sb.lastDate ?? '') > (sa.lastDate ?? '') ? { ...sb } : { ...sa }
  out.streak.longest = Math.max(sa.longest ?? 0, sb.longest ?? 0)
  out.achievements = { ...(b.achievements ?? {}), ...a.achievements }
  for (const [k, v] of Object.entries(b.achievements ?? {})) if (out.achievements[k] > v) out.achievements[k] = v
  // the same day/week: keep the copy with more done; otherwise the newer one
  const doneCount = (x) => (x?.items ?? []).filter((i) => i.done).length
  const pick = (x, y, key) => {
    if (!y?.[key]) return x
    if (y[key] === x?.[key]) return doneCount(y) > doneCount(x) ? y : x
    return y[key] > (x?.[key] ?? '') ? y : x
  }
  out.daily = structuredClone(pick(a.daily, b.daily, 'day'))
  out.weekly = structuredClone(pick(a.weekly, b.weekly, 'week'))
  out.days = { ...(b.days ?? {}), ...a.days }
  for (const [day, d] of Object.entries(b.days ?? {})) {
    if (!a.days[day]) continue
    const counts = { ...a.days[day].counts }
    for (const [gid, n] of Object.entries(d.counts ?? {})) counts[gid] = Math.max(counts[gid] ?? 0, n)
    out.days[day] = { counts, daily5: a.days[day].daily5 || d.daily5 }
  }
  out.totals = Object.fromEntries(Object.keys(a.totals).map((k) => [k, Math.max(a.totals[k] ?? 0, b.totals?.[k] ?? 0)]))
  out.sessions = [...new Set([...(b.sessions ?? []), ...a.sessions])].slice(-60)
  out.migrated = true
  out.unlocks = unlockedNow(out)
  return out
}
