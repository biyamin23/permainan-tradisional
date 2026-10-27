import { useEffect, useMemo, useState } from 'react'
import { GAME_NAMES, UNLOCKS, XP } from '../../progression/config'
import { currentGoals, masteryOf, startGame, useProgress } from '../../progression/engine'
import './progress.css'

/**
 * The progression bits the games show: mastery at the start of a game, and
 * the reward at the end (XP, mastery bar, records, achievements, unlocks).
 * Never a difficulty number: just "this is how far you've come".
 */

/** A level bar (0..1), optionally animating from `from` once mounted. */
export function LevelBar({ fraction, from = null, color }) {
  const [w, setW] = useState(from ?? fraction)
  useEffect(() => {
    if (from === null) return setW(fraction)
    const t = setTimeout(() => setW(fraction), 350)
    return () => clearTimeout(t)
  }, [fraction, from])
  return (
    <span className="pg-bar" style={color ? { '--pg-fill': color } : undefined}>
      <i style={{ width: `${Math.round(w * 100)}%` }} />
    </span>
  )
}

/** "CONGKAK · Mastery Lv. 4 · Mahir" with its bar, and today's challenge for this game. */
export function MasteryStatus({ gameId, compact = false, note = 'Cabar diri kamu!' }) {
  const profile = useProgress((s) => s.profile)
  const m = masteryOf(profile, gameId)
  const daily = currentGoals(profile).daily.items.find((i) => i.gameId === gameId)
  return (
    <div className={`pg-mastery ${compact ? 'is-compact' : ''}`}>
      <p className="pg-mastery__line">
        <b>Mastery Lv. {m.level}</b> <span className="pg-mastery__title">{m.title}</span>
      </p>
      <LevelBar fraction={m.fraction} />
      {!compact && note && <p className="pg-mastery__note">{note}</p>}
      {!compact && daily && (
        <p className={`pg-daily ${daily.done ? 'is-done' : ''}`}>
          <span aria-hidden="true">{daily.done ? '✅' : '🎯'}</span> Cabaran hari ini: {daily.text}
        </p>
      )}
    </div>
  )
}

const unlockName = (id) => UNLOCKS.find((u) => u.id === id)?.name ?? id

/**
 * After a match: +XP, the mastery bar (Lv. 4 → 5), and only the extras that
 * happened (record, achievement, challenge, Daily 5, unlock, streak).
 */
export function ProgressReward({ reward }) {
  const [open, setOpen] = useState(false)
  if (!reward) return null
  const { mastery, overall } = reward
  const levelUp = mastery.after.level > mastery.before.level
  const overallUp = overall.after.level > overall.before.level
  return (
    <div className="pg-reward" aria-live="polite">
      <p className="pg-reward__xp">
        +{reward.xp} XP
        {reward.records.length > 0 && <span className="pg-badge pg-badge--record">REKOD BARU!</span>}
      </p>
      <div className="pg-reward__mastery">
        <span>
          {GAME_NAMES[reward.gameId]} · Mastery Lv. {mastery.before.level}
          {levelUp && (
            <>
              {' '}
              → <b>Lv. {mastery.after.level}</b>
            </>
          )}
        </span>
        <LevelBar from={levelUp ? 0 : mastery.before.fraction} fraction={mastery.after.fraction} />
        {levelUp && mastery.after.title !== mastery.before.title && <span className="pg-reward__title">Kini: {mastery.after.title}!</span>}
      </div>
      <ul className="pg-reward__extras">
        {reward.records.map((r) => (
          <li key={r.key}>📈 {r.label}: <b>{r.text}</b></li>
        ))}
        {reward.challenges.map((c) => (
          <li key={c}>🎯 Cabaran hari ini selesai!</li>
        ))}
        {reward.weekly.map((c) => (
          <li key={c}>🗓️ Cabaran minggu: {c}</li>
        ))}
        {reward.daily5 && <li>🖐️ Daily 5! Kelima-lima permainan hari ini.</li>}
        {reward.achievements.map((a) => (
          <li key={a.id}>
            {a.icon} Pencapaian: <b>{a.name}</b>
          </li>
        ))}
        {reward.unlocks.map((u) => (
          <li key={u}>🎁 Terbuka: <b>{unlockName(u)}</b></li>
        ))}
        {overallUp && <li>⬆️ Level keseluruhan {overall.after.level} · {overall.after.title}</li>}
        {reward.streak.milestone && <li>🔥 {reward.streak.milestone} hari berturut-turut!</li>}
      </ul>
      {reward.parts.length > 1 && (
        <button type="button" className="pg-reward__more" onClick={() => setOpen((o) => !o)}>
          {open ? 'Tutup' : 'Butiran XP'}
        </button>
      )}
      {open && (
        <ul className="pg-reward__parts">
          {reward.parts.map((p) => (
            <li key={p.label}>
              <span>{p.label}</span>
              <b>+{p.xp}</b>
            </li>
          ))}
          {reward.achievements.length > 0 && (
            <li>
              <span>Pencapaian</span>
              <b>+{reward.achievements.length * XP.achievement}</b>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/**
 * One progression session per match: the difficulty and the game's tuning,
 * fixed for that match. Pass something that changes per match as `round`
 * (a rematch counter) to start a new one.
 */
export function useProgressSession(gameId, round = 0) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => startGame(gameId), [gameId, round])
}
