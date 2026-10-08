import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import type { PushRow, Remote, RemoteRecord } from './engine'
import { AuthExpiredError, type AuthPort, type AuthUser, type SyncBackend } from './ports'

interface PostgrestLikeError {
  message: string
  code?: string
  status?: number
}

/** 401 and JWT problems mean the login is no good; everything else is a plain failure. */
function toError(error: PostgrestLikeError): Error {
  const looksLikeAuth =
    error.status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt/i.test(error.message)
  return looksLikeAuth ? new AuthExpiredError() : new Error(error.message)
}

function createRemote(client: SupabaseClient): Remote {
  return {
    async push(rows: PushRow[]) {
      const { error } = await client.rpc('push_records', { rows })
      if (error) throw toError(error)
    },
    async pull(sinceIso: string | null, offset: number, limit: number): Promise<RemoteRecord[]> {
      let query = client
        .from('records')
        .select('entity, id, data, updated_at, deleted_at, server_updated_at')
        .order('server_updated_at', { ascending: true })
        .order('entity', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1)
      if (sinceIso) query = query.gt('server_updated_at', sinceIso)
      const { data, error } = await query
      if (error) throw toError(error)
      return (data ?? []) as RemoteRecord[]
    },
  }
}

/** The signed-in user as stored on this device, readable even without a network. */
function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const user = raw ? JSON.parse(raw)?.user : null
    return user?.id ? { id: user.id, email: user.email ?? null } : null
  } catch {
    return null
  }
}

function createAuth(client: SupabaseClient): AuthPort {
  const toUser = (u: { id: string; email?: string | null } | null | undefined): AuthUser | null =>
    u ? { id: u.id, email: u.email ?? null } : null
  return {
    async getUser() {
      try {
        const { data, error } = await client.auth.getSession()
        if (!error) return toUser(data.session?.user)
      } catch {
        /* fall through to the stored session */
      }
      // Offline with an expired access token: the refresh fails, but we are still signed in.
      return readStoredUser()
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // Only an explicit sign-out counts as signed out; a failed refresh while offline reports no session.
        if (event === 'SIGNED_OUT') listener(null)
        else if (session) listener(toUser(session.user))
      })
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) {
        if (/invalid login credentials/i.test(error.message)) throw new Error('Wrong email or password.')
        if (/fetch|network|load failed/i.test(error.message)) throw new Error('Cannot reach the server. Check your connection.')
        throw new Error(error.message)
      }
    },
    async signOut() {
      await client.auth.signOut()
    },
  }
}

export function createSupabaseBackend(): SyncBackend {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
    },
  })
  return { auth: createAuth(client), remote: createRemote(client) }
}
