import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './auth'
import { getClient } from './client'

/**
 * A room of 2–8 players (Lumba Basikal). Seat 0 is the host. Who is in the
 * room comes from match_players; who is here right now (and which bike they
 * picked) from presence on the room's channel.
 *
 * During a race Realtime messages are the budget (the Free plan allows 100
 * a second for the whole project, each delivery counted), so the host is
 * the hub: every other player sends their rider on a channel of their own
 * that only the host listens to (2 messages), and the host sends everyone
 * one snapshot of all the riders (1 + players messages). How often: rateFor()
 * in games/lumba-basikal/netRace.js.
 *
 * Events (onEvent((name, data) => …)):
 *   'start' { roster, at }   the host started: who rides what, AI included
 *   'snap'  { … }            the host's snapshot of every rider
 *   'state' { seat, s }      (host only) a player's own rider
 *   'final' { standings }    the host's results
 *   'left'  { seat }         someone walked out
 */

export function useRaceRoom(initial) {
  const userId = useAuth((s) => s.user?.id ?? null)
  const [match, setMatch] = useState(initial)
  const [players, setPlayers] = useState([]) // [{ seat, userId, name, gender }]
  const [here, setHere] = useState({}) // userId → { seat, bike, ready }
  const listeners = useRef(new Set())
  const sbRef = useRef(null)
  const roomRef = useRef(null)
  const upRef = useRef(null) // your uplink (guests)
  const upsRef = useRef(new Map()) // seat → uplink channel (host)
  const meRef = useRef({ bike: null })
  const isHost = initial.host === userId
  const mySeat = players.find((p) => p.userId === userId)?.seat ?? (isHost ? 0 : null)
  const id = initial.id

  const emit = (name, data) => listeners.current.forEach((fn) => fn(name, data))

  const refetch = useCallback(async () => {
    const sb = sbRef.current
    if (!sb) return
    const [{ data: rows }, { data: m }] = await Promise.all([
      sb.from('match_players').select('seat, user_id, profiles(name, gender)').eq('match_id', id).order('seat'),
      sb.from('matches').select('*').eq('id', id).maybeSingle(),
    ])
    if (rows) setPlayers(rows.map((r) => ({ seat: r.seat, userId: r.user_id, name: r.profiles?.name ?? 'Kawan', gender: r.profiles?.gender ?? null })))
    if (m) setMatch(m)
  }, [id])

  // the room: presence (who's here, their bike), the host's messages
  useEffect(() => {
    if (!userId) return undefined
    let gone = false
    let channel = null
    getClient().then((sb) => {
      if (!sb || gone) return
      sbRef.current = sb
      channel = sb.channel(`race:${id}`, { config: { broadcast: { self: false }, presence: { key: userId } } })
      roomRef.current = channel
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const next = {}
          for (const [key, metas] of Object.entries(state)) next[key] = metas[metas.length - 1] ?? {}
          setHere(next)
          refetch() // someone came or went: who's in the room now
        })
        .on('broadcast', { event: 'start' }, ({ payload }) => emit('start', payload))
        .on('broadcast', { event: 'snap' }, ({ payload }) => emit('snap', payload))
        .on('broadcast', { event: 'final' }, ({ payload }) => emit('final', payload))
        .on('broadcast', { event: 'left' }, ({ payload }) => emit('left', payload))
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          channel.track({ ...meRef.current, at: Date.now() })
          refetch()
        })
    })
    return () => {
      gone = true
      roomRef.current = null
      if (sbRef.current && channel) sbRef.current.removeChannel(channel)
    }
  }, [id, userId, refetch]) // eslint-disable-line react-hooks/exhaustive-deps

  // uplinks: a guest opens their own; the host listens to every guest's
  const seatsKey = players.map((p) => p.seat).join(',')
  useEffect(() => {
    const sb = sbRef.current
    if (!sb || mySeat === null) return undefined
    if (!isHost) {
      const ch = sb.channel(`race:${id}:up:${mySeat}`, { config: { broadcast: { self: false } } })
      ch.subscribe()
      upRef.current = ch
      return () => {
        upRef.current = null
        sb.removeChannel(ch)
      }
    }
    const ups = upsRef.current
    for (const p of players) {
      if (p.seat === 0 || ups.has(p.seat)) continue
      const ch = sb.channel(`race:${id}:up:${p.seat}`, { config: { broadcast: { self: false } } })
      ch.on('broadcast', { event: 'st' }, ({ payload }) => emit('state', { seat: p.seat, s: payload }))
      ch.subscribe()
      ups.set(p.seat, ch)
    }
    return undefined
  }, [id, isHost, mySeat, seatsKey, players.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // the host closes every uplink when the room goes
  useEffect(
    () => () => {
      const sb = sbRef.current
      if (sb) upsRef.current.forEach((ch) => sb.removeChannel(ch))
      upsRef.current.clear()
    },
    [],
  )

  /** What you show the room: your bike, whether your race has loaded. */
  const setMine = useCallback((patch) => {
    meRef.current = { ...meRef.current, ...patch }
    roomRef.current?.track({ ...meRef.current, seat: mySeatRef.current, at: Date.now() })
  }, [])
  const mySeatRef = useRef(mySeat)
  mySeatRef.current = mySeat

  const onEvent = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])

  const call = async (fn, args) => {
    const sb = sbRef.current ?? (await getClient())
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw error
    return data
  }

  /** Host: lock the room and tell everyone who rides what. */
  const start = useCallback(async (roster) => {
    const m = await call('start_match', { p_id: id })
    setMatch(m)
    const payload = { roster, at: Date.now() }
    roomRef.current?.send({ type: 'broadcast', event: 'start', payload })
    emit('start', payload)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Guest: your rider, to the host. */
  const sendState = useCallback((s) => {
    upRef.current?.send({ type: 'broadcast', event: 'st', payload: s })
  }, [])
  /** Host: every rider, to everyone. */
  const sendSnap = useCallback((snap) => {
    roomRef.current?.send({ type: 'broadcast', event: 'snap', payload: snap })
  }, [])
  /** Host: the results, to everyone (and into the record, the first time). */
  const sendFinal = useCallback(
    (standings, winnerSeat, again = false) => {
      roomRef.current?.send({ type: 'broadcast', event: 'final', payload: { standings } })
      if (!again) call('finish_match', { p_id: id, p_winner: winnerSeat, p_result: { standings } }).catch((e) => console.warn('[race] finish', e.message))
    },
    [id], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const leave = useCallback(() => {
    roomRef.current?.send({ type: 'broadcast', event: 'left', payload: { seat: mySeatRef.current } })
    return call('leave_match', { p_id: id }).catch(() => {})
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { match, players, here, isHost, mySeat, userId, setMine, onEvent, start, sendState, sendSnap, sendFinal, leave, refetch }
}
