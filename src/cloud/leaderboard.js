import { getClient } from './client'

/** Top players for a game (most wins, then best score), and where you stand. */
export async function fetchLeaderboard(gameId, userId, limit = 10) {
  const sb = await getClient()
  if (!sb) throw new Error('network')
  const top = await sb
    .from('leaderboard')
    .select('user_id, name, gender, is_guest, wins, losses, draws, best, rank')
    .eq('game_id', gameId)
    .order('rank', { ascending: true })
    .limit(limit)
  if (top.error) throw top.error
  let me = null
  if (userId && !top.data.some((r) => r.user_id === userId)) {
    const mine = await sb.from('leaderboard').select('user_id, name, gender, is_guest, wins, losses, draws, best, rank').eq('game_id', gameId).eq('user_id', userId).maybeSingle()
    me = mine.data ?? null
  }
  return { top: top.data, me }
}
