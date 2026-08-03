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

// AUTH KILL-SWITCH.
//
// Off (default): the app behaves exactly as it did in the design phase — no session is
// required, RbacProvider falls back to the seeded org + the "view as" switcher. The CEO's
// demo keeps working.
//
// On (`NEXT_PUBLIC_AUTH_ENFORCED=1`): middleware redirects signed-out visitors to /login and
// permissions come from the signed-in user's DB roles.
//
// It is OFF because there are literally zero accounts yet (`auth.users` is empty) and
// `user_roles` is empty until the HR sheet is imported — flipping it now would lock everyone
// out of an app nobody can sign in to. Turn it on right after: import main_1_hr → create the
// accounts → fill `main_1_hr.auth_user_id` → assign `user_roles`.
export const AUTH_ENFORCED = process.env.NEXT_PUBLIC_AUTH_ENFORCED === "1";
