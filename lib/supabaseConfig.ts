// Public Supabase config, shared by all three clients (read-only anon, browser, server).
//
// The publishable (anon) key is designed to be exposed client-side and is protected by RLS,
// so shipping it as a fallback is safe and keeps the app working even when env vars aren't
// configured on the host. Env vars, if set (Vercel → Settings → Environment Variables),
// take priority.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jpufhxzvqfrdcblfmrmu.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MXdGWde2_RvLAWQrJ0ORWw_K18B0rvc";

// AUTH KILL-SWITCH — ON as of 2026-08-03.
//
// On (default): middleware redirects signed-out visitors to /login, and permissions come
// from the signed-in user's roles in the database.
//
// Off (`NEXT_PUBLIC_AUTH_ENFORCED=0`): the design-phase behaviour — no session required,
// RbacProvider falls back to the seeded org and the "view as" switcher. Kept as an escape
// hatch, not a mode to ship in.
//
// It defaulted OFF while `auth.users` was empty; enforcing then would have locked everyone
// out of an app nobody could sign into. The nine accounts now exist and every employee row
// is linked, so the default flips. Deliberately defaulted in code rather than set in Vercel:
// NEXT_PUBLIC_* is inlined at build time, so a dashboard change needs a redeploy anyway, and
// this project has been bitten before by env vars going missing on the host.
//
// Signing in is not by itself what protects the data — the anon key ships in the page. What
// protects it is per-table RLS, live since 2026-08-03 (db/rls_policies.sql): the anon role
// holds no grant on any table, view or helper, so this key alone now reads nothing at all.
// Turning the switch off leaves the middleware open but the database still shut.
export const AUTH_ENFORCED = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "0";
