import { useState } from 'react'
import { GAME_IDS, GAME_NAMES } from '../../progression/config'
import { devTools, masteryOf, setDifficultyOverride, useProgress } from '../../progression/engine'
import { recentPerformance, tierOf } from '../../progression/rules'
import { tuningFor } from '../../progression/adapters'

/**
 * DEVELOPMENT ONLY (import.meta.env.DEV): see and push the progression
 * numbers. Never shipped: App.jsx only imports it in dev builds.
 */

const fmt = (v) => (typeof v === 'number' ? (Math.abs(v) < 10 ? v.toFixed(2) : Math.round(v)) : JSON.stringify(v))

export default function DevProgressPanel() {
  const profile = useProgress((s) => s.profile)
  const [open, setOpen] = useState(false)
  const [gameId, setGameId] = useState(GAME_IDS[0])
  const [override, setOverride] = useState(null)
  const g = profile.games[gameId]
  const m = masteryOf(profile, gameId)
  const tuning = tuningFor(gameId, override ?? g.difficulty)
  const btn = { padding: '3px 7px', margin: 2, borderRadius: 6, border: '1px solid #555', background: '#2a2a2a', color: '#eee', fontSize: 11, cursor: 'pointer' }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...btn, position: 'fixed', left: '50%', top: 4, transform: 'translateX(-50%)', zIndex: 9999, opacity: 0.6 }}>
        🧪 progression
      </button>
    )

  return (
    <div style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 9999, width: 300, maxHeight: '80vh', overflow: 'auto', padding: 10, borderRadius: 10, background: 'rgba(15,15,15,0.92)', color: '#eee', font: '12px/1.45 ui-monospace, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b>PROGRESSION (dev)</b>
        <button type="button" style={btn} onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <select value={gameId} onChange={(e) => setGameId(e.target.value)} style={{ width: '100%', margin: '6px 0' }}>
        {GAME_IDS.map((id) => (
          <option key={id} value={id}>
            {GAME_NAMES[id]}
          </option>
        ))}
      </select>
      <div>XP {g.xp} · Mastery Lv {m.level} ({m.title})</div>
      <div>Skill {Math.round(g.skill)} / 1000</div>
      <div>Recent perf {fmt(recentPerformance(g.results))} (n={g.results.length})</div>
      <div>
        Difficulty {fmt(g.difficulty)} · tier {tierOf(g.difficulty)} · flow {fmt(g.flowOffset ?? 0)}
      </div>
      <div>Played {g.played} · W {g.wins} L {g.losses} D {g.draws} · streak {g.winStreak}</div>
      <div style={{ marginTop: 6, color: '#aaa' }}>Tuning{override !== null ? ` (override ${override})` : ''}:</div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {Object.entries(tuning)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? Object.entries(v).map(([a, b]) => `${a}=${fmt(b)}`).join(' ') : fmt(v)}`)
          .join('\n')}
      </pre>
      <div style={{ marginTop: 6 }}>
        Override difficulty:{' '}
        <input
          type="range"
          min="0.1"
          max="0.95"
          step="0.05"
          value={override ?? g.difficulty}
          onChange={(e) => {
            const v = Number(e.target.value)
            setOverride(v)
            setDifficultyOverride(v)
          }}
        />
        <button
          type="button"
          style={btn}
          onClick={() => {
            setOverride(null)
            setDifficultyOverride(null)
          }}
        >
          adaptive
        </button>
      </div>
      <div style={{ marginTop: 6 }}>
        {['new', 'low', 'average', 'skilled'].map((k) => (
          <button key={k} type="button" style={btn} onClick={() => devTools.simulate(gameId, k)}>
            sim {k}
          </button>
        ))}
      </div>
      <div>
        <button type="button" style={btn} onClick={() => devTools.results(gameId, 3, true)}>
          3 wins
        </button>
        <button type="button" style={btn} onClick={() => devTools.results(gameId, 3, false)}>
          3 losses
        </button>
        <button type="button" style={btn} onClick={() => devTools.addXP(gameId, 100)}>
          +100 XP
        </button>
        <button type="button" style={{ ...btn, borderColor: '#a33' }} onClick={() => devTools.reset()}>
          reset all
        </button>
      </div>
      <div style={{ marginTop: 6, color: '#aaa' }}>
        Overall XP {profile.totalXP} · streak {profile.streak.current} · achievements {Object.keys(profile.achievements).length}
      </div>
    </div>
  )
}
