/**
 * Progression checks (run: npm run test:progression). Plain asserts, no framework:
 * the curve, skill, recent form, difficulty boundaries and adaptation, and the
 * engine's XP rules (repeats, Daily 5, duplicates, XP never going down).
 */

// a stand-in for the browser's storage, before the engine loads
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
}

const { levelFromXP, xpForLevel, updateSkill, recentPerformance, nextDifficulty, startingDifficulty, targetDifficulty, tierOf } = await import('./rules')
const { tuningFor } = await import('./adapters')
const { completeGame, startGame, devTools, getProfile, masteryOf } = await import('./engine')
const { GAME_IDS, DIFFICULTY } = await import('./config')

let failed = 0
const check = (name, ok, extra = '') => {
  if (!ok) failed++
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${extra ? `  (${extra})` : ''}`)
}
const fmt = (v) => v.toFixed(2)

console.log('\n— levels')
check('0 XP is level 1', levelFromXP(0) === 1)
check('100 XP is level 2', levelFromXP(100) === 2)
check('levels line up with their start XP', [2, 5, 10, 20, 30].every((l) => levelFromXP(xpForLevel(l)) === l && levelFromXP(xpForLevel(l) - 1) === l - 1))
console.log('     level at 1k/5k/10k/50k XP:', [1000, 5000, 10000, 50000].map(levelFromXP).join(' / '))

console.log('\n— skill')
check('skill rises on a strong game', updateSkill(400, 0.9) > 400)
check('skill falls on a weak game', updateSkill(400, 0.05) < 400)
check('skill moves at most 20 a game', Math.abs(updateSkill(400, 1) - 400) <= 20 && Math.abs(updateSkill(900, 0) - 900) <= 20)
check('skill stays in 0..1000', updateSkill(995, 1) <= 1000 && updateSkill(5, 0) >= 0)

console.log('\n— recent form')
check('no games: gentle default', recentPerformance([]) === 0.35)
const rp = recentPerformance([0, 0, 0, 0, 1].map((p) => ({ performance: p })))
check('the latest game weighs most', rp > 0.4 && rp < 0.5, fmt(rp))

console.log('\n— difficulty boundaries (XP alone, average skill and form)')
for (const xp of [0, 100, 500, 1000, 5000, 10000, 50000]) {
  const t = targetDifficulty({ xp, skill: 500, recent: 0.5 })
  check(`XP ${xp}: target ${fmt(t)} within 0.1..0.95`, t >= 0.1 && t <= 0.95)
}
for (const id of GAME_IDS) {
  const d = startingDifficulty(id)
  check(`new player starts gentle in ${id}`, d <= 0.25, fmt(d))
}

const run = (seq, start = { xp: 0, skill: 400 }) => {
  const g = { xp: start.xp, skill: start.skill, results: [], difficulty: startingDifficulty('congkak', start.xp, start.skill), flowOffset: 0 }
  const path = [g.difficulty]
  for (const perf of seq) {
    g.xp += 60 + perf * 50
    g.skill = updateSkill(g.skill, perf)
    g.results = [...g.results, { performance: perf }].slice(-10)
    Object.assign(g, nextDifficulty('congkak', g))
    path.push(g.difficulty)
  }
  return path
}
const steps = (path) => Math.max(...path.slice(1).map((d, i) => Math.abs(d - path[i])))

console.log('\n— adaptation (Congkak)')
const wins = run(Array(10).fill(0.92))
check('10 strong wins: difficulty climbs', wins.at(-1) > wins[0] + 0.15, wins.map(fmt).join('→'))
check('…never more than 0.08 a game', steps(wins) <= 0.0801)
const losses = run(Array(10).fill(0.1), { xp: 3000, skill: 650 })
check('10 heavy losses (experienced player): difficulty eases', losses.at(-1) < losses[0] - 0.1, losses.map(fmt).join('→'))
const mixed = run(Array(10).fill(0).map((_, i) => (i % 2 ? 0.8 : 0.35)), { xp: 1500, skill: 500 })
const spread = Math.max(...mixed.slice(3)) - Math.min(...mixed.slice(3))
check('alternating results: stays steady', spread < 0.1, mixed.map(fmt).join('→'))
const longLoser = run(Array(40).fill(0.12), { xp: 20000, skill: 300 })
check('a veteran who keeps losing is not stuck at a high difficulty', longLoser.at(-1) < 0.5, fmt(longLoser.at(-1)))
const maxed = run(Array(60).fill(1), { xp: 50000, skill: 1000 })
check('the ceiling holds (Congkak max 0.92)', Math.max(...maxed) <= DIFFICULTY.perGame.congkak.max + 1e-9, fmt(Math.max(...maxed)))
check('example: one win from 0.55 moves only a little', (() => {
  const g = { xp: 1200, skill: 720, results: [0.7, 0.6, 0.8].map((p) => ({ performance: p })), difficulty: 0.55, flowOffset: 0 }
  g.results.push({ performance: 0.85 })
  const d = nextDifficulty('congkak', g).difficulty
  return d > 0.55 && d - 0.55 <= 0.08
})())

console.log('\n— tiers (internal)')
check('tiers 1..5', [0.1, 0.3, 0.5, 0.7, 0.9].map(tierOf).join('') === '12345')

console.log('\n— adapters stay humanly possible at the ceiling')
const raga = tuningFor('sepak-raga', 1)
check('Sepak Raga timing window never under 0.11 s', raga.timing >= 0.11, raga.timing.toFixed(3))
const teng = tuningFor('ting-ting', 1)
check('Teng-Teng window never under 0.11 s', teng.timing.w >= 0.11, teng.timing.w.toFixed(3))
const k = tuningFor('lumba-basikal', 1)
check('Kamarul at most 5% over his bike', k.pace <= 1.05, k.pace.toFixed(2))
check('Dam AI depth ≤ 7', tuningFor('dam', 1).depth <= 7)
check('Congkak AI still slips sometimes, even at the top', tuningFor('congkak', 1).mistake > 0)

console.log('\n— engine')
devTools.reset()
const s1 = startGame('congkak')
const r1 = completeGame(s1, { won: true, score: 60, theirs: 38 })
check('a win earns XP', r1.xp > 50, `+${r1.xp}`)
check('calling complete twice gives the same reward, no double XP', completeGame(s1, { won: true, score: 60, theirs: 38 }) === r1 && getProfile().games.congkak.xp === r1.gameXP)
const xpBefore = getProfile().totalXP
const loss = completeGame(startGame('congkak'), { won: false, score: 20, theirs: 78 })
check('a loss still earns some XP, total never drops', loss.xp > 0 && getProfile().totalXP > xpBefore, `+${loss.xp}`)
const reps = []
for (let i = 0; i < 12; i++) reps.push(completeGame(startGame('dam'), { won: false, score: 4, theirs: 6 }).repeat)
check('repeats today are worth less, never under half', reps[0] === 1 && reps.at(-1) === 0.5 && reps.every((r, i) => i === 0 || r <= reps[i - 1]), reps.map(fmt).join(' '))
devTools.reset()
let d5 = null
for (const id of GAME_IDS) {
  const r = completeGame(startGame(id), { won: false, score: 1, theirs: 2, time: 90, par: 80, crashes: 1, mistakes: 2 })
  if (r.daily5) d5 = id
}
check('playing all five today triggers Daily 5 once', d5 === GAME_IDS.at(-1) && !completeGame(startGame('congkak'), { won: false, score: 1, theirs: 2 }).daily5)
check('Daily 5 achievement earned', Boolean(getProfile().achievements.daily5))
check('streak starts at 1', getProfile().streak.current === 1)
const other = masteryOf(getProfile(), 'sepak-raga').level
for (let i = 0; i < 6; i++) completeGame(startGame('congkak'), { won: true, score: 70, theirs: 28 })
check('one game climbing leaves the others alone', masteryOf(getProfile(), 'sepak-raga').level === other && masteryOf(getProfile(), 'congkak').level > other)

console.log(failed ? `\n${failed} check(s) FAILED\n` : '\nall checks passed\n')
if (failed) process.exitCode = 1
