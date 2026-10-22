/** Solo records against Geng Pak-pak, remembered per browser. */
const KEY = 'ptm-sepak-raga-records'
const EMPTY = { wins: 0, losses: 0, draws: 0, best: 0 }

export function loadRecords() {
  try {
    return { ...EMPTY, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...EMPTY }
  }
}

export function saveResult(result) {
  const r = loadRecords()
  const next = {
    wins: r.wins + (result.winner === 0 ? 1 : 0),
    losses: r.losses + (result.winner === 1 ? 1 : 0),
    draws: r.draws + (result.winner === null ? 1 : 0),
    best: Math.max(r.best, result.scores[0]),
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: records just won't persist
  }
  return next
}
