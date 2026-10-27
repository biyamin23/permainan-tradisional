import { DIFFICULTY, LEVEL_CURVE, MASTERY_TITLES, OVERALL_TITLES, RECENT_DEFAULT, RECENT_WEIGHTS, SKILL } from './config'

/**
 * The progression maths: pure functions, no state. XP → level, skill rating,
 * recent form and the adaptive difficulty. Tested in isolation.
 */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1)
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------- levels
/** Level for an amount of XP (1-based, never infinite in practice: the curve flattens). */
export function levelFromXP(xp) {
  const { base, exponent } = LEVEL_CURVE
  return Math.floor(Math.pow(Math.max(0, xp) / base, 1 / exponent)) + 1
}

/** XP at which `level` starts. */
export function xpForLevel(level) {
  const { base, exponent } = LEVEL_CURVE
  return level <= 1 ? 0 : Math.ceil(base * Math.pow(level - 1, exponent))
}

/** { level, into, needed, fraction } for a progress bar. */
export function levelProgress(xp) {
  const level = levelFromXP(xp)
  const start = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, into: xp - start, needed: next - start, fraction: clamp((xp - start) / (next - start), 0, 1) }
}

const titleFrom = (list, level) => list.reduce((t, row) => (level >= row.level ? row.title : t), list[0].title)
export const overallTitle = (level) => titleFrom(OVERALL_TITLES, level)
export const masteryTitle = (level) => titleFrom(MASTERY_TITLES, level)

// ---------------------------------------------------------------- skill
/** The performance a player of this skill is expected to put in (0..1). */
export const expectedPerformance = (skill) => 1 / (1 + Math.exp(-(skill - SKILL.centre) / SKILL.spread))

/** Skill after a game: up when you beat expectations, down when you don't, small steps. */
export function updateSkill(skill, performance) {
  const delta = clamp(SKILL.k * (clamp(performance, 0, 1) - expectedPerformance(skill)), -SKILL.maxStep, SKILL.maxStep)
  return clamp(skill + delta, SKILL.min, SKILL.max)
}

// ---------------------------------------------------------------- recent form
/** Weighted recent performance, most recent first; weights renormalised for short histories. */
export function recentPerformance(results) {
  const recent = results.slice(-RECENT_WEIGHTS.length).reverse()
  if (!recent.length) return RECENT_DEFAULT
  let sum = 0
  let weight = 0
  recent.forEach((r, i) => {
    sum += clamp(r.performance, 0, 1) * RECENT_WEIGHTS[i]
    weight += RECENT_WEIGHTS[i]
  })
  return sum / weight
}

// ---------------------------------------------------------------- difficulty
export const limitsFor = (gameId) => DIFFICULTY.perGame[gameId] ?? { min: DIFFICULTY.min, max: DIFFICULTY.max }

/** Where XP, skill and form say the difficulty should sit (before smoothing). */
export function targetDifficulty({ xp, skill, recent }) {
  const w = DIFFICULTY.weights
  const xpD = 1 - Math.exp(-Math.max(0, xp) / DIFFICULTY.xpScale) // diminishing returns, never runaway
  const skillD = clamp(skill / SKILL.max, 0, 1)
  return (xpD * w.xp + skillD * w.skill + clamp(recent, 0, 1) * w.recent) / (w.xp + w.skill + w.recent)
}

/**
 * Next game's difficulty for one game, after a result.
 * game: { xp, skill, results, difficulty, flowOffset } (already updated with the new result)
 * Returns { difficulty, flowOffset }.
 */
export function nextDifficulty(gameId, game) {
  const { min, max } = limitsFor(gameId)
  const f = DIFFICULTY.flow
  const target = targetDifficulty({ xp: game.xp, skill: game.skill, recent: recentPerformance(game.results) })

  // flow: consecutive evidence only; one odd result doesn't move it
  const last = game.results.slice(-2).map((r) => r.performance)
  let offset = (game.flowOffset ?? 0) * f.fade
  if (last.length === 2 && last.every((p) => p >= f.strong)) offset += f.nudge
  else if (last.length === 2 && last.every((p) => p < f.weak)) offset -= f.nudge
  offset = clamp(offset, -f.maxOffset, f.maxOffset)

  const old = game.difficulty ?? clamp(target, min, max)
  const smoothed = old * (1 - DIFFICULTY.smoothing) + (target + offset) * DIFFICULTY.smoothing
  const step = clamp(smoothed - old, -DIFFICULTY.maxStep, DIFFICULTY.maxStep)
  return { difficulty: clamp(old + step, min, max), flowOffset: offset }
}

/** The very first difficulty for a game you've never played. */
export function startingDifficulty(gameId, xp = 0, skill = SKILL.initial) {
  const { min, max } = limitsFor(gameId)
  return clamp(targetDifficulty({ xp, skill, recent: RECENT_DEFAULT }), min, max)
}

/** Internal band 1..5 (never shown to players). */
export const tierOf = (d) => 1 + DIFFICULTY.tiers.filter((t) => d >= t).length
