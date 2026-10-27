import { useState } from 'react'
import { sfx } from '../../audio/engine'
import { GAME_IDS, GAME_NAMES, UNLOCKS, XP } from '../../progression/config'
import { currentGoals, equip, masteryOf, overallOf, useProgress } from '../../progression/engine'
import { ACHIEVEMENTS } from '../../progression/goals'
import { RECORDS } from '../../progression/performance'
import { GameIcon } from '../game/GameIcon'
import { LevelBar } from './Progress'
import './profile.css'

/**
 * PROFIL PEMAIN: who you are in the kampung. Overall level, the five
 * games' mastery, today's and this week's challenges, streak, records,
 * achievements and the cosmetic things you've unlocked.
 */

const AVATAR = { lelaki: '/avatars/pemain-lelaki.webp', perempuan: '/avatars/pemain-perempuan.webp' }
const frameOf = (id) => UNLOCKS.find((u) => u.id === id)

/** Your avatar in its frame (shared with the HUD). */
export function FramedAvatar({ gender, frameId, size = 64 }) {
  const frame = frameOf(frameId)
  return (
    <span className="pf-frame" style={{ '--frame': frame?.color ?? '#c9a173', width: size, height: size }}>
      <img src={AVATAR[gender] ?? AVATAR.lelaki} alt="" />
    </span>
  )
}

function Section({ title, children }) {
  return (
    <section className="pf-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function ProfilePanel({ name, gender }) {
  const profile = useProgress((s) => s.profile)
  const [tab, setTab] = useState('maju')
  const overall = overallOf(profile)
  const goals = currentGoals(profile)
  const playedToday = GAME_IDS.filter((id) => (goals.today.counts?.[id] ?? 0) > 0).length
  const title = UNLOCKS.find((u) => u.id === profile.equipped.title)?.name ?? overall.title
  const titles = UNLOCKS.filter((u) => u.kind === 'title' && profile.unlocks.includes(u.id))
  const frames = UNLOCKS.filter((u) => u.kind === 'frame' && profile.unlocks.includes(u.id))
  const badges = UNLOCKS.filter((u) => u.kind === 'badge' && profile.unlocks.includes(u.id))

  return (
    <div className="pf">
      <div className="pf-head">
        <FramedAvatar gender={gender} frameId={profile.equipped.frame} />
        <div className="pf-head__text">
          <p className="pf-name">{name}</p>
          <p className="pf-title">{title}</p>
          <p className="pf-level">
            <b>Level {overall.level}</b> · {overall.xp.toLocaleString('ms-MY')} XP
          </p>
          <LevelBar fraction={overall.fraction} />
        </div>
        {profile.streak.current > 0 && (
          <span className="pf-streak" title="Hari berturut-turut">
            🔥 {profile.streak.current}
            <small>hari</small>
          </span>
        )}
      </div>

      <div className="pf-tabs" role="tablist">
        {[
          ['maju', 'Kemajuan'],
          ['cabaran', 'Cabaran'],
          ['rekod', 'Rekod'],
          ['koleksi', 'Koleksi'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'is-on' : ''}
            onClick={() => {
              sfx.tap()
              setTab(id)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'maju' && (
        <Section title="Mastery permainan">
          <ul className="pf-games">
            {GAME_IDS.map((id) => {
              const m = masteryOf(profile, id)
              const g = profile.games[id]
              return (
                <li key={id}>
                  <GameIcon id={id} size={30} />
                  <div>
                    <p>
                      <b>{GAME_NAMES[id]}</b>
                      <span>
                        Lv. {m.level} · {m.title}
                      </span>
                    </p>
                    <LevelBar fraction={m.fraction} />
                    <small>
                      {g.played ? `${g.wins} menang dari ${g.played} permainan` : 'Belum dimain lagi'}
                      {g.bestWinStreak > 1 ? ` · terbaik ${g.bestWinStreak} berturut` : ''}
                    </small>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {tab === 'cabaran' && (
        <>
          <Section title="Cabaran hari ini">
            <ul className="pf-list">
              {goals.daily.items.map((i) => (
                <li key={i.gameId} className={i.done ? 'is-done' : ''}>
                  <span>{i.done ? '✅' : '🎯'}</span>
                  <span>
                    <b>{GAME_NAMES[i.gameId]}:</b> {i.text}
                  </span>
                  <em>+{XP.challenge}</em>
                </li>
              ))}
            </ul>
            <p className="pf-daily5">
              🖐️ <b>Daily 5</b> (pilihan): main kelima-lima permainan hari ini, {playedToday}/5
              {goals.today.daily5 ? ' ✅' : ` · +${XP.daily5} XP`}
            </p>
          </Section>
          <Section title="Cabaran minggu ini">
            <ul className="pf-list">
              {goals.weekly.items.map((i) => (
                <li key={i.id} className={i.done ? 'is-done' : ''}>
                  <span>{i.done ? '✅' : '🗓️'}</span>
                  <span>
                    {i.text}
                    <LevelBar fraction={i.progress / i.target} />
                    <small>
                      {i.progress}/{i.target}
                    </small>
                  </span>
                  <em>+{XP.weekly}</em>
                </li>
              ))}
            </ul>
          </Section>
          <p className="pf-small">Streak: {profile.streak.current} hari (paling lama {profile.streak.longest}). Terlepas sehari? Tak apa, mula semula esok.</p>
        </>
      )}

      {tab === 'rekod' && (
        <Section title="Rekod peribadi">
          {GAME_IDS.map((id) => {
            const rec = profile.games[id].records
            const rows = Object.entries(RECORDS[id]).filter(([k]) => rec[k] !== undefined)
            return (
              <div key={id} className="pf-records">
                <p>
                  <GameIcon id={id} size={20} /> <b>{GAME_NAMES[id]}</b>
                </p>
                {rows.length ? (
                  <ul>
                    {rows.map(([k, def]) => (
                      <li key={k}>
                        <span>{def.label}</span>
                        <b>{def.format ? def.format(rec[k]) : rec[k]}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <small>Belum ada rekod.</small>
                )}
              </div>
            )
          })}
        </Section>
      )}

      {tab === 'koleksi' && (
        <>
          <Section title="Gelaran">
            <div className="pf-chips">
              <button type="button" className={!profile.equipped.title ? 'is-on' : ''} onClick={() => equip('title', null)}>
                {overall.title}
              </button>
              {titles.map((u) => (
                <button key={u.id} type="button" className={profile.equipped.title === u.id ? 'is-on' : ''} onClick={() => equip('title', u.id)}>
                  {u.name}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Bingkai">
            <div className="pf-chips">
              {frames.map((u) => (
                <button key={u.id} type="button" className={profile.equipped.frame === u.id ? 'is-on' : ''} onClick={() => equip('frame', u.id)}>
                  <i className="pf-swatch" style={{ background: u.color }} /> {u.name}
                </button>
              ))}
            </div>
            <p className="pf-small">
              Lagi akan terbuka: {UNLOCKS.filter((u) => !profile.unlocks.includes(u.id)).length} gelaran, bingkai dan lencana.
            </p>
          </Section>
          <Section title={`Pencapaian (${Object.keys(profile.achievements).length}/${ACHIEVEMENTS.length})`}>
            <ul className="pf-achievements">
              {ACHIEVEMENTS.map((a) => {
                const got = Boolean(profile.achievements[a.id])
                return (
                  <li key={a.id} className={got ? 'is-got' : ''} title={a.desc}>
                    <span>{got ? a.icon : '🔒'}</span>
                    <b>{a.name}</b>
                    <small>{a.desc}</small>
                  </li>
                )
              })}
            </ul>
            {badges.length > 0 && (
              <p className="pf-badges">
                {badges.map((b) => (
                  <span key={b.id} title={b.name}>
                    {b.icon} {b.name}
                  </span>
                ))}
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
