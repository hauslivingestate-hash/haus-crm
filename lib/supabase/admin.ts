import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

// SERVICE-ROLE client — bypasses RLS entirely. The ONLY reason this exists is
// `auth.admin.*` (create/reset a login), which the anon/session-aware clients can never do
// regardless of permissions. Every caller MUST check `has_perm(...)` itself before reaching
// this — this client enforces nothing on its own.
//
// `import "server-only"` makes importing this from a "use client" component a build error
// instead of a silent leak of the service_role key into the browser bundle.
//
// Lazy by design: reads the env var only when a caller actually needs the client, not at
// module load, so a missing key fails loudly at the one call site that needs it rather than
// breaking the build or every other page that happens to import something nearby.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — get it from Supabase Dashboard → Settings → " +
        "API → service_role, and set it as a server-only env var (never NEXT_PUBLIC_)."
    );
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
