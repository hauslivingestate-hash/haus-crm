import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";

// SESSION-AWARE server client — reads the auth cookies, so `auth.uid()` is set inside
// Postgres and RLS policies actually apply to the query.
//
// Not the same thing as `lib/supabase.ts`: that one is a plain anon client with no session,
// used by the page data queries (`lib/queries.ts`). Those still work today because every
// table carries the `demo_read_all` policy. ⚠️ When real RLS lands (Phase 4) they must move
// onto THIS client, which also makes those pages dynamic instead of ISR-cached — a page
// cached for one user must never be served to another once rows are scoped.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, which may not set cookies. Harmless: the
          // middleware refreshes the session on every request.
        }
      },
    },
  });
}
