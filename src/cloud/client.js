/**
 * Supabase connection. The URL and the public (anon) key come from the
 * environment (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: set them in Vercel
 * and in a local .env). Without them the game still runs, just offline:
 * no login, records stay on the device.
 *
 * supabase-js is loaded only when first needed, so the landing stays light.
 */
const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudEnabled = Boolean(URL && KEY)

let pending = null

/** The Supabase client, or null when the cloud isn't set up. */
export function getClient() {
  if (!cloudEnabled) return Promise.resolve(null)
  if (!pending) {
    pending = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(URL, KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        }),
      )
      .catch((err) => {
        console.warn('[cloud] tak dapat sambung', err)
        pending = null
        return null
      })
  }
  return pending
}
