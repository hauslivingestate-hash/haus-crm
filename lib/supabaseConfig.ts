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
// ⚠️ Signing in is NOT what protects the data. The anon key ships in the page, so anything
// still covered only by the `demo_read_all` policy is readable without ever logging in.
// Real protection is per-table RLS (Phase 4); done so far: main_1_hr's salary/PII columns.
export const AUTH_ENFORCED = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "0";
