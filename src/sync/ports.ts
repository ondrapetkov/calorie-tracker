import type { Remote } from './engine'

export interface AuthUser {
  id: string
  email: string | null
}

/** Sign-in, kept behind an interface so the sync manager can be tested without Supabase. */
export interface AuthPort {
  /** The signed-in user from the stored session, or null. Must not fail when offline. */
  getUser(): Promise<AuthUser | null>
  /** Notified when the user signs in or is signed out. */
  onChange(listener: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

export interface SyncBackend {
  auth: AuthPort
  remote: Remote
}

/** Thrown by the remote when the server rejects the login (expired or invalid session). */
export class AuthExpiredError extends Error {
  constructor(message = 'Your session has expired. Sign in again.') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}
