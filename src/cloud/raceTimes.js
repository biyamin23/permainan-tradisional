import { getClient } from './client'
import { recordsOwner } from './records'

/**
 * Lumba Basikal lap times in the cloud: each player's best per litar (and
 * the bike it was set on), plus races and wins there. The device keeps its
 * own copy (games/lumba-basikal/records.js); after login the two are merged,
 * the faster time wins. The database only ever keeps the better time.
 */

const GAME = 'lumba-basikal'
const LOCAL_KEY = 'ptm-lumba-basikal-records'
const COLUMNS = 'user_id, name, gender, is_guest, best_ms, bike_id, races, wins, rank'

const row = (userId, trackId, t) => ({
  user_id: userId,
  game_id: GAME,
  track_id: trackId,
  best_ms: Math.round(t.best * 1000),
  bike_id: t.bike,
  races: t.races ?? 1,
  wins: t.wins ?? 0,
  updated_at: new Date().toISOString(),
})

const usable = (t) => t && Number.isFinite(t.best) && t.best >= 20 && t.bike

/** A race just finished: send this litar's record (the database keeps the best). */
export function pushRaceTime(trackId, track) {
  const userId = recordsOwner()
  if (!userId || !usable(track)) return
  getClient().then((sb) => {
    if (!sb) return
    sb.from('race_times')
      .upsert(row(userId, trackId, track))
      .then(({ error }) => error && console.warn('[cloud] simpan masa lumba', error.message))
  })
}

/** After login: merge the account's lap times with this device's. */
export async function pullRaceTimes(sb, userId) {
  if (recordsOwner() !== userId) return // the device's records belong to someone else
  const { data, error } = await sb.from('race_times').select('track_id, best_ms, bike_id, races, wins').eq('user_id', userId).eq('game_id', GAME)
  if (error) {
    console.warn('[cloud] masa lumba', error.message)
    return
  }
  let local = {}
  try {
    local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
  } catch {
    /* fine */
  }
  const tracks = { ...(local.tracks ?? {}) }
  const upload = []
  for (const r of data ?? []) {
    const mine = tracks[r.track_id]
    const cloud = { best: r.best_ms / 1000, bike: r.bike_id, races: r.races, wins: r.wins }
    tracks[r.track_id] = !usable(mine)
      ? cloud
      : {
          best: Math.min(mine.best, cloud.best),
          bike: mine.best < cloud.best ? mine.bike : cloud.bike,
          races: Math.max(mine.races ?? 0, cloud.races),
          wins: Math.max(mine.wins ?? 0, cloud.wins),
        }
  }
  for (const [trackId, t] of Object.entries(tracks)) {
    const cloud = (data ?? []).find((r) => r.track_id === trackId)
    if (usable(t) && (!cloud || t.best * 1000 < cloud.best_ms - 1 || (t.races ?? 0) > cloud.races || (t.wins ?? 0) > cloud.wins))
      upload.push(row(userId, trackId, t))
  }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...local, tracks }))
  } catch {
    /* storage unavailable */
  }
  if (upload.length) {
    const res = await sb.from('race_times').upsert(upload)
    if (res.error) console.warn('[cloud] simpan masa lumba', res.error.message)
  }
}

/** Fastest on a litar, and where you stand if you're not in the top. */
export async function fetchRaceLeaderboard(trackId, userId, limit = 10) {
  const sb = await getClient()
  if (!sb) throw new Error('network')
  const top = await sb.from('race_leaderboard').select(COLUMNS).eq('game_id', GAME).eq('track_id', trackId).order('rank', { ascending: true }).limit(limit)
  if (top.error) throw top.error
  let me = null
  if (userId && !top.data.some((r) => r.user_id === userId)) {
    const mine = await sb.from('race_leaderboard').select(COLUMNS).eq('game_id', GAME).eq('track_id', trackId).eq('user_id', userId).maybeSingle()
    me = mine.data ?? null
  }
  return { top: top.data, me }
}

/** The kampung record on each litar: { trackId: { name, best_ms, bike_id } }. */
export async function fetchTrackRecords() {
  const sb = await getClient()
  if (!sb) return {}
  const { data, error } = await sb.from('race_leaderboard').select('track_id, name, best_ms, bike_id').eq('game_id', GAME).eq('rank', 1)
  if (error) return {}
  return Object.fromEntries((data ?? []).map((r) => [r.track_id, r]))
}
