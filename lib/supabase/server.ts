import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";

// SESSION-AWARE server client — reads the auth cookies, so `auth.uid()` is set inside
// Postgres and RLS policies actually apply to the query.
//
// The only server-side client there is, as of Phase 4. The sessionless anon client this file
// used to warn about is gone: with `demo_read_all` dropped, a query without a session sees
// nothing. Reading cookies makes every page that calls this dynamic — correct, since a page
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
