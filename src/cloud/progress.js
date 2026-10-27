import { GAME_IDS } from '../progression/config'
import { getProfile, mergeProfiles, onProgress, replaceProfile } from '../progression/engine'
import { getClient } from './client'
import { recordsOwner } from './records'

/**
 * Progression in the cloud. Every finished game is one row in
 * progress_events (the database checks its numbers and refuses a session it
 * has already counted); the whole profile is copied to player_progress, whose
 * totals the database keeps honest (XP never down, never ahead of the games
 * recorded). Games finished while logged out or offline wait in a small queue
 * on the device and are sent later.
 */

const QUEUE = 'ptm-progress-pending'
const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) || '[]')
  } catch {
    return []
  }
}
const writeQueue = (q) => {
  try {
    localStorage.setItem(QUEUE, JSON.stringify(q.slice(-200)))
  } catch {
    /* fine */
  }
}

let flushing = false
async function flush() {
  const userId = recordsOwner()
  if (!userId || flushing) return
  const sb = await getClient()
  if (!sb) return
  flushing = true
  try {
    let q = readQueue()
    while (q.length) {
      const e = q[0]
      const { error } = await sb.from('progress_events').insert({
        session_id: e.sessionId,
        game_id: e.gameId,
        won: e.won,
        performance: e.performance,
        difficulty: Math.min(0.95, Math.max(0.1, e.difficulty)),
        xp: Math.min(700, e.xp),
        game_xp: Math.min(300, e.gameXP, e.xp),
      })
      // a duplicate (23505) is already counted; "too fast" or offline: try again later
      if (error && error.code !== '23505') {
        if (error.code !== 'P0001') console.warn('[cloud] simpan kemajuan', error.message)
        break
      }
      q = q.slice(1)
      writeQueue(q)
    }
  } finally {
    flushing = false
  }
}

async function pushProfile() {
  const userId = recordsOwner()
  if (!userId) return
  const sb = await getClient()
  if (!sb) return
  await flush()
  const p = getProfile()
  const { error } = await sb.from('player_progress').upsert({
    user_id: userId,
    total_xp: p.totalXP,
    game_xp: Object.fromEntries(GAME_IDS.map((id) => [id, p.games[id].xp])),
    state: p,
  })
  if (error) console.warn('[cloud] simpan profil kemajuan', error.message)
}

let pushTimer = null
onProgress(({ event }) => {
  if (event) writeQueue([...readQueue(), event])
  clearTimeout(pushTimer)
  pushTimer = setTimeout(pushProfile, 1500)
})

/** After login: merge the account's progress with this device's, then send the result back. */
export async function pullProgress(sb, userId) {
  if (recordsOwner() !== userId) return
  const { data, error } = await sb.from('player_progress').select('state').eq('user_id', userId).maybeSingle()
  if (error) {
    console.warn('[cloud] kemajuan', error.message)
    return
  }
  if (data?.state) replaceProfile(mergeProfiles(getProfile(), data.state), true)
  await pushProfile()
}

/** Highest overall level in the kampung, and where you stand. */
export async function fetchProgressLeaderboard(userId, limit = 10) {
  const sb = await getClient()
  if (!sb) throw new Error('network')
  const cols = 'user_id, name, gender, is_guest, total_xp, overall_level, rank'
  const top = await sb.from('progress_leaderboard').select(cols).order('rank', { ascending: true }).limit(limit)
  if (top.error) throw top.error
  let me = null
  if (userId && !top.data.some((r) => r.user_id === userId)) {
    const mine = await sb.from('progress_leaderboard').select(cols).eq('user_id', userId).maybeSingle()
    me = mine.data ?? null
  }
  return { top: top.data, me }
}
