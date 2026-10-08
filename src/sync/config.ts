/**
 * Supabase project. Both values are public by design: the URL is just an address, and the publishable
 * key can only do what row level security allows a signed-in user (see docs/supabase-setup.sql).
 * Never put the secret / service_role key in this app.
 */
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://uwcxkamizhijahmzsjct.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_E_1BTeGIacUrrGB5XJNVlA_ny9kPQz_'

export const AUTH_STORAGE_KEY = 'calorie-tracker-auth'
