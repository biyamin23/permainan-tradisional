import { GAME_MODES, playerActions } from '../../state/playerState'

/**
 * Invite links: /?main=CODE&game=dam. Read once when the app loads, then
 * used as soon as the player is in the kampung (after logging in and making a
 * character if they had to): the game opens in multiplayer and joins.
 * While a match is on, the same two parameters sit in the address bar, so a
 * reload goes straight back into it.
 */

let pending = null

/** Call once at startup. */
export function readInviteFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('main')
  const game = params.get('game')
  if (code && game) pending = { code, game }
}

export const hasPendingInvite = () => pending !== null

/** In the kampung, logged in: open the invited game. True if there was one. */
export function openPendingInvite() {
  if (!pending) return false
  playerActions.openGame(pending.game)
  playerActions.startGame(GAME_MODES.MULTIPLAYER)
  return true
}

/** The code the online lobby should join for this game, if any. */
export const pendingCodeFor = (gameId) => (pending && pending.game === gameId ? pending.code : null)

/** The lobby is joining it now: don't use it again. */
export function clearPendingInvite() {
  pending = null
}

/** Keep the match in the address bar (or clear it when leaving). */
export function rememberMatchInUrl(match) {
  const url = new URL(window.location.href)
  if (match) {
    url.searchParams.set('main', match.code)
    url.searchParams.set('game', match.game_id)
  } else {
    url.searchParams.delete('main')
    url.searchParams.delete('game')
  }
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}
