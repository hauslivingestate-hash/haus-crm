import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton: only instantiate on first real use (request time), not at
// module import. This keeps `next build` (page-data collection) from crashing
// when env vars aren't present during the build step.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set them in your environment (Vercel → Project → Settings → Environment Variables)."
    );
  }

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
