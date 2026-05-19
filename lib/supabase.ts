import { createClient } from '@supabase/supabase-js'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    )
  }
  return { url, key }
}

/** Browser-side Supabase client (auth only — data uses pg pool) */
export function createBrowserClient() {
  const { url, key } = getSupabaseConfig()
  return createClient(url, key)
}

/** Server-side Supabase client (auth only) */
export function createServerClient() {
  const { url, key } = getSupabaseConfig()
  return createClient(url, key)
}
