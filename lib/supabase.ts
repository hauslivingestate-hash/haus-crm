import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";

// Lazy singleton: only instantiate on first real use (request time), not at
// module import. This keeps `next build` (page-data collection) from crashing
// when env vars aren't present during the build step.
let client: SupabaseClient | null = null;

// ⚠️ SESSIONLESS anon client — `auth.uid()` is NULL for every query it makes, so it can
// only ever read what the `demo_read_all` policy exposes. Page data queries
// (`lib/queries.ts`) still use it; they must move to `lib/supabase/server.ts` when real RLS
// lands (Phase 4), or every scoped surface will come back empty.
function getClient(): SupabaseClient {
  if (client) return client;

  // Read-only anon client. Used from server components; RLS demo_read_all allows select.
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
