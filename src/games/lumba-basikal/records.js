import { pushRaceTime } from '../../cloud/raceTimes'
import { pushRecord } from '../../cloud/records'
import { logEvent } from '../../cloud/events'

/**
 * Races against Kamarul, remembered per browser and copied to the account:
 * wins / losses overall, and per litar the best lap (seconds), the bike it
 * was set on, races and wins there.
 */
const KEY = 'ptm-lumba-basikal-records'
const EMPTY = { wins: 0, losses: 0, draws: 0, tracks: {} }

export function loadRecords() {
  try {
    const r = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    return { ...EMPTY, ...r, tracks: { ...(r.tracks ?? {}) } }
  } catch {
    return { ...EMPTY, tracks: {} }
  }
}

/** Returns the new records and whether this lap was a new best on the litar. */
export function saveResult({ won, trackId, bikeId, time }) {
  const r = loadRecords()
  const before = r.tracks[trackId]
  const newBest = !before || time < before.best
  const track = {
    best: newBest ? time : before.best,
    bike: newBest ? bikeId : before.bike,
    races: (before?.races ?? 0) + 1,
    wins: (before?.wins ?? 0) + (won ? 1 : 0),
  }
  const next = {
    wins: r.wins + (won ? 1 : 0),
    losses: r.losses + (won ? 0 : 1),
    draws: 0,
    tracks: { ...r.tracks, [trackId]: track },
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: records just won't persist
  }
  pushRecord('lumba-basikal', { wins: next.wins, losses: next.losses, draws: 0 })
  pushRaceTime(trackId, track)
  logEvent('finish', 'lumba-basikal')
  return { records: next, newBest, track }
}
