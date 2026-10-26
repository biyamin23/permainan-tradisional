import { createStore } from '../state/createStore'
import { SCREENS, playerActions } from '../state/playerState'
import { cloudEnabled, getClient } from './client'
import { forgetOwner, pullRecords } from './records'

/**
 * Who is logged in. status: 'loading' → 'out' | 'in'.
 * kind: 'google' | 'email' | 'guest'. profile: { name, gender } once the
 * character is made (null before that).
 */
export const authStore = createStore({
  status: cloudEnabled ? 'loading' : 'off',
  user: null,
  kind: null,
  email: null,
  profile: null,
  // came from the 'tukar kata laluan' email: ask for a new password
  recovery: false,
  // the landing's 'guna emel' link opens the login screen on the email form
  loginView: null,
})
export const useAuth = authStore.useStore

// set before leaving for Google, so coming back goes straight on into the game
const RETURN_KEY = 'ptm-auth-return'

function kindOf(user) {
  if (!user) return null
  if (user.is_anonymous) return 'guest'
  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider]
  return providers.includes('google') ? 'google' : 'email'
}

async function loadProfile(sb, user) {
  const { data, error } = await sb.from('profiles').select('name, gender').eq('id', user.id).maybeSingle()
  if (error) console.warn('[cloud] profil', error.message)
  return data ?? null
}

let current = null
async function applySession(sb, session) {
  const user = session?.user ?? null
  if ((user?.id ?? null) === current && authStore.getState().status !== 'loading') {
    // same person (token refreshed, or a guest who just added Google/email)
    if (user) {
      const was = authStore.getState().kind
      authStore.setState({ user, kind: kindOf(user), email: user.email ?? null })
      if (was === 'guest' && kindOf(user) !== 'guest' && authStore.getState().profile) {
        sb.from('profiles').update({ is_guest: false }).eq('id', user.id).then(() => {})
      }
    }
    return
  }
  current = user?.id ?? null
  if (!user) {
    authStore.setState({ status: 'out', user: null, kind: null, email: null, profile: null })
    return
  }
  const profile = await loadProfile(sb, user)
  if (profile) playerActions.setProfile(profile)
  authStore.setState({ status: 'in', user, kind: kindOf(user), email: user.email ?? null, profile })
  // records hang off the profile, so they wait until the character is made
  if (profile) pullRecords(sb, user.id)
}

/** Start listening for the session (call once at startup). */
export async function initAuth() {
  const sb = await getClient()
  if (!sb) {
    if (cloudEnabled) authStore.setState({ status: 'out' })
    return
  }
  // the reset email brings people back with ?tukar=1
  const params = new URLSearchParams(window.location.search + window.location.hash.replace('#', '&'))
  const resetting = params.has('tukar')
  // a guest tried to add a Google account that already has its own: log in to that one instead
  const taken = params.get('error_code') === 'identity_already_exists'
  if (resetting) authStore.setState({ recovery: true })
  const { data } = await sb.auth.getSession()
  if (resetting || params.has('error')) window.history.replaceState(null, '', redirectTo())
  if (taken) {
    authActions.google().catch(() => {})
    return
  }
  await applySession(sb, data.session)
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') authStore.setState({ recovery: true })
    // never await supabase calls inside the callback itself
    setTimeout(() => applySession(sb, session), 0)
  })
}

/** True once, right after coming back from the Google page. */
export function takeReturnFlag() {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v === '1'
  } catch {
    return false
  }
}

const redirectTo = () => window.location.origin + window.location.pathname

/** Friendly Malay for the errors people actually hit. */
export function explain(error) {
  const m = (error?.message ?? String(error ?? '')).toLowerCase()
  if (m.includes('invalid login')) return 'Emel atau kata laluan salah.'
  if (m.includes('email not confirmed')) return 'Emel belum disahkan. Semak peti masuk emel kamu.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Emel ini sudah didaftarkan. Cuba log masuk.'
  if (m.includes('password should be') || m.includes('at least 6')) return 'Kata laluan mesti sekurang-kurangnya 6 aksara.'
  if (m.includes('valid email') || m.includes('invalid format') || m.includes('unable to validate email')) return 'Format emel tidak betul.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Terlalu banyak cubaan. Tunggu sebentar dan cuba lagi.'
  if (m.includes('anonymous sign-ins are disabled')) return 'Main sebagai tetamu belum diaktifkan.'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Log masuk Google belum diaktifkan.'
  if (m.includes('fetch') || m.includes('network')) return 'Tiada sambungan internet. Cuba lagi.'
  return 'Ada masalah. Cuba lagi sebentar.'
}

async function client() {
  const sb = await getClient()
  if (!sb) throw new Error('network')
  return sb
}

export const authActions = {
  async google() {
    const sb = await client()
    try {
      sessionStorage.setItem(RETURN_KEY, '1')
    } catch {
      /* fine */
    }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
    if (error) throw error
  },

  async emailSignIn(email, password) {
    const sb = await client()
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  },

  /** Returns { confirm: true } when an email must be confirmed first. */
  async emailSignUp(email, password) {
    const sb = await client()
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo() } })
    if (error) throw error
    if (data.user && data.user.identities?.length === 0) throw new Error('already registered')
    return { confirm: !data.session }
  },

  async resetPassword(email) {
    const sb = await client()
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${redirectTo()}?tukar=1` })
    if (error) throw error
  },

  async guest() {
    const sb = await client()
    const { error } = await sb.auth.signInAnonymously()
    if (error) throw error
  },

  /** A guest keeps their progress by adding Google to the same account. */
  async guestToGoogle() {
    const sb = await client()
    try {
      sessionStorage.setItem(RETURN_KEY, '1')
    } catch {
      /* fine */
    }
    const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: redirectTo() } })
    if (error) throw error
  },

  /** …or by adding an email and password (a confirmation email is sent). */
  async guestToEmail(email, password) {
    const sb = await client()
    const { error } = await sb.auth.updateUser({ email: email.trim(), password }, { emailRedirectTo: redirectTo() })
    if (error) throw error
  },

  async setNewPassword(password) {
    const sb = await client()
    const { error } = await sb.auth.updateUser({ password })
    if (error) throw error
    authStore.setState({ recovery: false })
  },

  async saveProfile({ name, gender }) {
    const sb = await getClient()
    const { user, kind } = authStore.getState()
    if (!sb || !user) return
    const profile = { name: name.trim(), gender }
    authStore.setState({ profile })
    const { error } = await sb
      .from('profiles')
      .upsert({ id: user.id, ...profile, is_guest: kind === 'guest', updated_at: new Date().toISOString() })
    if (error) console.warn('[cloud] simpan profil', error.message)
    else pullRecords(sb, user.id)
  },

  async signOut() {
    const sb = await getClient()
    forgetOwner()
    if (sb) await sb.auth.signOut()
    playerActions.reset()
  },
}

/** Where MULAKAN (or logging in) leads: login, then the character the first time, then the kampung. */
export function screenAfterLogin() {
  const { status, profile } = authStore.getState()
  if (status === 'off') return SCREENS.CHARACTER
  if (status === 'in') return profile ? SCREENS.KAMPUNG : SCREENS.CHARACTER
  return SCREENS.LOGIN
}
