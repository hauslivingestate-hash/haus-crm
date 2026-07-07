import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton: only instantiate on first real use (request time), not at
// module import. This keeps `next build` (page-data collection) from crashing
// when env vars aren't present during the build step.
let client: SupabaseClient | null = null;

// Public Supabase config. The publishable (anon) key is designed to be exposed
// client-side and is protected by RLS, so shipping it as a fallback is safe and
// keeps the app working even when env vars aren't configured on the host.
// Env vars, if set (e.g. Vercel → Settings → Environment Variables), take priority.
const DEFAULT_SUPABASE_URL = "https://jpufhxzvqfrdcblfmrmu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_MXdGWde2_RvLAWQrJ0ORWw_K18B0rvc";

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  // Read-only anon client. Used from server components; RLS demo_read_all allows select.
  client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  return client;
}

// Proxy preserves existing call sites: `supabase.from(...)` still works,
// but the underlying client is created lazily on first property access.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
