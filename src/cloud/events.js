import { authStore } from './auth'
import { getClient } from './client'

/**
 * Counts for you: every visit to the kampung, game opened, started and
 * finished goes into play_events (read them in Supabase with
 * `select * from game_stats`). Fire and forget: never slows the game.
 */
export function logEvent(kind, gameId = null) {
  const { user } = authStore.getState()
  if (!user) return
  getClient().then((sb) => {
    if (!sb) return
    sb.from('play_events')
      .insert({ user_id: user.id, kind, game_id: gameId })
      .then(({ error }) => error && console.warn('[cloud] kiraan', error.message))
  })
}
