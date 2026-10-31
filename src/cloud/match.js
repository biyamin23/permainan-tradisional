import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './auth'
import { getClient } from './client'

/**
 * Online 1v1 matches (supabase/multiplayer.sql). The host is seat 0, the
 * friend who joins is seat 1. Moves are numbered (seq 0, 1, 2…) and go two
 * ways at once: live over the match's Realtime channel (fast), and into
 * match_moves (the record, so a reload or a dropped message catches up).
 * What a move looks like is up to each game; it's stored as JSON.
 */

/** Games that can be played online so far (same list as online_game() in the database). */
export const ONLINE_GAMES = ['dam']

const WHY = {
  'not signed in': 'Log masuk dulu untuk main dengan kawan.',
  'no profile': 'Cipta watak dulu sebelum main dengan kawan.',
  'no such match': 'Kod tu tak dijumpai. Semak semula.',
  'match closed': 'Perlawanan tu dah tutup, atau dah ada pemain lain.',
  'game not online': 'Permainan ni belum boleh dimain dengan kawan.',
}

/** Friendly Malay for what went wrong. */
export function explainMatchError(error) {
  const m = error?.message ?? String(error ?? '')
  const key = Object.keys(WHY).find((k) => m.includes(k))
  return key ? WHY[key] : 'Tak dapat sambung ke pelayan. Cuba lagi.'
}

async function call(fn, args) {
  const sb = await getClient()
  if (!sb) throw new Error('not signed in')
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw error
  return data
}

/** Host a new match of `gameId`. Returns the match row (with its code). */
export const createMatch = (gameId) => call('create_match', { p_game: gameId })
/** Join a friend's match by its code (or get your own back after a reload). */
export const joinMatch = (code) => call('join_match', { p_code: code })

/** Link that opens the game and joins this match. */
export const inviteLink = (match) => `${window.location.origin}/?main=${encodeURIComponent(match.code)}&game=${encodeURIComponent(match.game_id)}`

/** Cleans a typed code: capitals, no spaces. */
export const tidyCode = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

/**
 * One online match, seen from this player. Give it the match row from
 * createMatch / joinMatch.
 *
 * Returns: match (kept fresh), seat (0 host, 1 guest), opponent ({ name,
 * gender } once someone has joined), opponentOnline, opponentLeft, moves
 * ([{ seq, seat, move }], in order, yours included), loaded (the record has
 * been read: safe to rebuild the board), send(move), finish(winnerSeat,
 * result), leave(), rematch (a code the other player sent), offerRematch(code).
 */
export function useNetMatch(initial) {
  const userId = useAuth((s) => s.user?.id ?? null)
  const [match, setMatch] = useState(initial)
  const [opponent, setOpponent] = useState(null)
  const [opponentOnline, setOpponentOnline] = useState(false)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [moves, setMovesState] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [rematch, setRematch] = useState(null)

  const movesRef = useRef([])
  const channelRef = useRef(null)
  const sbRef = useRef(null)
  const setMoves = (list) => {
    movesRef.current = list
    setMovesState(list)
  }

  const id = initial.id
  const seat = initial.host === userId ? 0 : 1
  const opponentId = seat === 0 ? match.guest : match.host

  const refetchMoves = useCallback(async () => {
    const sb = sbRef.current
    if (!sb) return
    const { data, error } = await sb.from('match_moves').select('seq, seat, move').eq('match_id', id).order('seq')
    if (error) {
      console.warn('[match] moves', error.message)
      return
    }
    // keep anything of ours that hasn't reached the table yet
    const mine = movesRef.current.filter((m) => m.seq >= data.length)
    setMoves([...data, ...mine])
    setLoaded(true)
  }, [id])

  const refetchMatch = useCallback(async () => {
    const sb = sbRef.current
    if (!sb) return
    const { data } = await sb.from('matches').select('*').eq('id', id).maybeSingle()
    if (data) setMatch(data)
  }, [id])

  // the live channel: moves, who is here, a rematch, leaving
  useEffect(() => {
    if (!userId) return undefined
    let gone = false
    let channel = null
    getClient().then((sb) => {
      if (!sb || gone) return
      sbRef.current = sb
      channel = sb.channel(`match:${id}`, { config: { broadcast: { self: false }, presence: { key: userId } } })
      channelRef.current = channel
      channel
        .on('broadcast', { event: 'move' }, ({ payload }) => {
          const have = movesRef.current.length
          if (payload.seq === have) setMoves([...movesRef.current, payload])
          else if (payload.seq > have) refetchMoves() // missed one: read the record
        })
        .on('broadcast', { event: 'rematch' }, ({ payload }) => setRematch(payload.code))
        .on('broadcast', { event: 'left' }, () => setOpponentLeft(true))
        .on('presence', { event: 'sync' }, () => {
          const others = Object.keys(channel.presenceState()).filter((k) => k !== userId)
          setOpponentOnline(others.length > 0)
          // someone turned up: who? (the host learns the guest here)
          if (others.length) refetchMatch()
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          channel.track({ at: Date.now() })
          // (re)connected: catch up on anything sent while we were away
          refetchMoves()
          refetchMatch()
        })
    })
    return () => {
      gone = true
      channelRef.current = null
      if (sbRef.current && channel) sbRef.current.removeChannel(channel)
    }
  }, [id, userId, refetchMoves, refetchMatch])

  // who you're playing
  useEffect(() => {
    if (!opponentId) return
    getClient().then(async (sb) => {
      if (!sb) return
      const { data } = await sb.from('profiles').select('name, gender').eq('id', opponentId).maybeSingle()
      if (data) setOpponent(data)
    })
  }, [opponentId])

  /** Play a move: shows straight away here, goes live to the other player, then into the record. */
  const send = useCallback(
    async (move) => {
      const entry = { seq: movesRef.current.length, seat, move }
      setMoves([...movesRef.current, entry])
      channelRef.current?.send({ type: 'broadcast', event: 'move', payload: entry })
      const sb = sbRef.current
      for (let attempt = 0; sb && attempt < 4; attempt++) {
        const { error } = await sb.from('match_moves').insert({ match_id: id, ...entry })
        if (!error) return
        if (error.code === '23505') return refetchMoves() // already recorded
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
      console.warn('[match] move not recorded', entry.seq)
    },
    [id, seat, refetchMoves],
  )

  const finish = useCallback(
    (winnerSeat, result) => call('finish_match', { p_id: id, p_winner: winnerSeat, p_result: result }).catch((e) => console.warn('[match] finish', e.message)),
    [id],
  )

  const leave = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'left', payload: {} })
    return call('leave_match', { p_id: id }).catch(() => {})
  }, [id])

  const offerRematch = useCallback((code) => {
    channelRef.current?.send({ type: 'broadcast', event: 'rematch', payload: { code } })
  }, [])

  return { match, seat, opponent, opponentOnline, opponentLeft, moves, loaded, send, finish, leave, rematch, offerRematch }
}
