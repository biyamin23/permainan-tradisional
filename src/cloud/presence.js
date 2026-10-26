import { useEffect, useState } from 'react'
import { useAuth } from './auth'
import { getClient } from './client'

/**
 * Who is in the kampung right now (Supabase Realtime presence, no table
 * needed). Returns the number of players online, counting each account once.
 */
export function useKampungLive() {
  const userId = useAuth((s) => s.user?.id ?? null)
  const name = useAuth((s) => s.profile?.name ?? '')
  const [count, setCount] = useState(null)

  useEffect(() => {
    if (!userId) return undefined
    let channel = null
    let sb = null
    let gone = false
    getClient().then((client) => {
      if (!client || gone) return
      sb = client
      channel = sb.channel('kampung', { config: { presence: { key: userId } } })
      channel
        .on('presence', { event: 'sync' }, () => setCount(Object.keys(channel.presenceState()).length))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') channel.track({ name, at: Date.now() })
        })
    })
    return () => {
      gone = true
      if (sb && channel) sb.removeChannel(channel)
    }
  }, [userId, name])

  return count
}
