/**
 * Supabase project for sync, supplied at build time (see .env.example and docs/SUPABASE_SETUP.md).
 * Both values end up in the shipped JavaScript and are public by design: the URL is an address and the
 * publishable key can only do what row level security allows a signed-in user. They are kept out of the
 * repository anyway, so a fork never talks to someone else's project.
 *
 * Never put the secret / service_role key here; it bypasses all security.
 */
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()

export const SUPABASE_PUBLISHABLE_KEY: string = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

/** Without both values the app runs fully local and the sync card explains how to set it up. */
export const SYNC_CONFIGURED = SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== ''

export const AUTH_STORAGE_KEY = 'calorie-tracker-auth'
