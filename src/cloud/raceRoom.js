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
 *
 * A phone can drop its connection without warning (off to WhatsApp to share
 * the link), so what the room needs is also kept in the tables: each
 * player's bike (match_players.bike) and the line-up the host started with
 * (matches.settings.roster). The room reads them again every few seconds
 * while it waits, and reconnects when the page comes back to the front.
 */

const REFRESH_MS = 4000 // while waiting: read the room again this often

export function useRaceRoom(initial) {
  const userId = useAuth((s) => s.user?.id ?? null)
  const [match, setMatch] = useState(initial)
  const [players, setPlayers] = useState([]) // [{ seat, userId, name, gender, bike }]
  const [link, setLink] = useState(0) // bumped to reconnect the live channels
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
      sb.from('match_players').select('seat, user_id, bike, profiles(name, gender)').eq('match_id', id).order('seat'),
      sb.from('matches').select('*').eq('id', id).maybeSingle(),
    ])
    if (rows) setPlayers(rows.map((r) => ({ seat: r.seat, userId: r.user_id, name: r.profiles?.name ?? 'Kawan', gender: r.profiles?.gender ?? null, bike: r.bike })))
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
  }, [id, userId, refetch, link]) // eslint-disable-line react-hooks/exhaustive-deps

  // while waiting, read the room again now and then (live messages can be missed)
  const waiting = match.status === 'waiting'
  useEffect(() => {
    if (!waiting) return undefined
    const t = setInterval(refetch, REFRESH_MS)
    return () => clearInterval(t)
  }, [waiting, refetch])

  // back to the front (a phone that went to WhatsApp): reconnect if the line dropped, say you're here
  useEffect(() => {
    const onShow = () => {
      if (document.hidden) return
      const ch = roomRef.current
      if (!ch || ch.state !== 'joined') setLink((n) => n + 1)
      else ch.track({ ...meRef.current, seat: mySeatRef.current, at: Date.now() })
      refetch()
    }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('pageshow', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('pageshow', onShow)
    }
  }, [refetch])

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
  }, [id, isHost, mySeat, seatsKey, players.length > 0, link]) // eslint-disable-line react-hooks/exhaustive-deps

  // the host's uplinks: closed when the room goes, or opened afresh on a reconnect
  useEffect(
    () => () => {
      const sb = sbRef.current
      if (sb) upsRef.current.forEach((ch) => sb.removeChannel(ch))
      upsRef.current.clear()
    },
    [link],
  )

  /** What you show the room: your bike, whether your race has loaded. */
  const setMine = useCallback((patch) => {
    meRef.current = { ...meRef.current, ...patch }
    roomRef.current?.track({ ...meRef.current, seat: mySeatRef.current, at: Date.now() })
  }, [])

  /** Your bike: shown live, and kept in the room's table (so the host has it even if a message is lost). */
  const setBike = useCallback(
    (bikeId) => {
      setMine({ bike: bikeId })
      call('set_my_bike', { p_match: id, p_bike: bikeId }).catch((e) => console.warn('[race] bike', e.message))
    },
    [id, setMine], // eslint-disable-line react-hooks/exhaustive-deps
  )
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

  /** Host: lock the room and tell everyone who rides what (kept with the match too, for anyone who misses the message). */
  const start = useCallback(async (roster) => {
    const m = await call('start_match', { p_id: id, p_roster: roster })
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

  return { match, players, here, isHost, mySeat, userId, setMine, setBike, onEvent, start, sendState, sendSnap, sendFinal, leave, refetch }
}
