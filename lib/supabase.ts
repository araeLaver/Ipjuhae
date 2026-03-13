import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Browser-side Supabase client (auth only — data uses pg pool) */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

/** Server-side Supabase client (auth only) */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}
