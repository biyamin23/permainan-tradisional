/** Solo records for Congkak, remembered per browser ("cuba pecahkan rekod"). */
const KEY = 'ptm-congkak-records'
const EMPTY = { wins: 0, losses: 0, draws: 0, best: 0 }

export function loadRecords() {
  try {
    return { ...EMPTY, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...EMPTY }
  }
}

/** Saves a finished game; returns the updated records and whether the best score was beaten. */
export function saveResult(result) {
  const records = loadRecords()
  const score = result.scores[0]
  const played = records.wins + records.losses + records.draws
  // a first loss isn't celebrated as a "record"; after that every best score is
  const newBest = score > records.best && (played > 0 || result.winner === 0)
  const next = {
    wins: records.wins + (result.winner === 0 ? 1 : 0),
    losses: records.losses + (result.winner === 1 ? 1 : 0),
    draws: records.draws + (result.winner === null ? 1 : 0),
    best: Math.max(records.best, score),
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable — records just won't persist
  }
  return { records: next, newBest }
}
