import { getClient } from './client'

/**
 * Game records live on the device (fast, works offline) and are copied to
 * the player's account. On login the two are merged: counts only ever grow,
 * so the bigger number of each wins. Records from someone else's account
 * that was on this device before are replaced.
 */
export const RECORD_KEYS = {
  congkak: 'ptm-congkak-records',
  dam: 'ptm-dam-records',
  'sepak-raga': 'ptm-sepak-raga-records',
  'ting-ting': 'ptm-teng-teng-records',
  'lumba-basikal': 'ptm-lumba-basikal-records',
}
const OWNER_KEY = 'ptm-records-owner'
const FIELDS = ['wins', 'losses', 'draws', 'best']

const readLocal = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
const writeLocal = (key, value) => {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

let owner = null

const row = (userId, gameId, rec) => ({
  user_id: userId,
  game_id: gameId,
  ...Object.fromEntries(FIELDS.map((f) => [f, Math.max(0, Math.round(rec?.[f] ?? 0))])),
  updated_at: new Date().toISOString(),
})

/** After login: merge the account's records with this device's. */
export async function pullRecords(sb, userId) {
  owner = userId
  let previous = null
  try {
    previous = localStorage.getItem(OWNER_KEY)
  } catch {
    /* fine */
  }
  const { data, error } = await sb.from('game_records').select('game_id, wins, losses, draws, best').eq('user_id', userId)
  if (error) {
    console.warn('[cloud] rekod', error.message)
    return
  }
  const cloud = Object.fromEntries((data ?? []).map((r) => [r.game_id, r]))
  // this device's records belong to this player, or to nobody yet (played before logging in)
  const mine = !previous || previous === userId
  const upload = []
  for (const [gameId, key] of Object.entries(RECORD_KEYS)) {
    const local = mine ? readLocal(key) : null
    const remote = cloud[gameId] ?? null
    if (!local && !remote) {
      writeLocal(key, null)
      continue
    }
    // keep a game's own extra fields (e.g. lumba basikal's best times) on the device
    const merged = { ...(local ?? {}), ...Object.fromEntries(FIELDS.map((f) => [f, Math.max(local?.[f] ?? 0, remote?.[f] ?? 0)])) }
    writeLocal(key, merged)
    if (!remote || FIELDS.some((f) => merged[f] > (remote[f] ?? 0))) upload.push(row(userId, gameId, merged))
  }
  try {
    localStorage.setItem(OWNER_KEY, userId)
  } catch {
    /* fine */
  }
  if (upload.length) {
    const res = await sb.from('game_records').upsert(upload)
    if (res.error) console.warn('[cloud] hantar rekod', res.error.message)
  }
}

/** A game just saved its records on the device: copy them to the account. */
export function pushRecord(gameId, rec) {
  if (!owner) return
  const userId = owner
  getClient().then((sb) => {
    if (!sb) return
    sb.from('game_records')
      .upsert(row(userId, gameId, rec))
      .then(({ error }) => error && console.warn('[cloud] simpan rekod', error.message))
  })
}

/** The logged-in player whose records these are (null when offline / logged out). */
export const recordsOwner = () => owner

/** Logged out: forget whose records these are (they stay for the same player). */
export function forgetOwner() {
  owner = null
}
