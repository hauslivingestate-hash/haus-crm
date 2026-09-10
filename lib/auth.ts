import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Server-side identity: who is signed in, which employee row they are, and what they may do.
//
// The join is the whole point of the auth bridge added to the DB on 2026-08-03:
//     auth.users.id → main_1_hr.auth_user_id → employee_code → user_roles → role_permissions
// Every RLS policy filters on the same chain via `current_employee_code()` / `has_perm()`,
// so what the UI hides and what the database refuses stay in agreement.
//
// ── WHY THIS FILE IS SHAPED THE WAY IT IS (2026-09-10) ──────────────────────────
// Answering "who are you" used to cost FOUR network round trips, one after another:
// getUser() to the Auth server, then main_1_hr, then user_roles, then role_permissions.
// Measured from Bangkok against this project in ap-southeast-2, that is ~1.5s — and it ran
// more than once per page render. Opening a lead drawer spent longer introducing the user to
// the app than fetching the lead. It is now ONE round trip, memoised per request:
//
//   1. getClaims() verifies the token locally against the project's public signing key,
//      instead of asking the Auth server to do it. Zero network. See below.
//   2. my_identity() returns the employee row and the permission list together.
//   3. cache() means the whole thing runs once per render, however many callers ask.
export interface AuthContext {
  userId: string;
  email: string | null;
  /** null when the account exists in auth but no employee row links to it yet. */
  employeeCode: string | null;
  nickname: string | null;
  teamId: string | null;
  /** Union of every permission across the roles this employee holds. */
  permissions: string[];
}

/** One row of public.my_identity() — the employee row and their permissions, together. */
interface IdentityRow {
  employee_code: string;
  nickname: string | null;
  team_id: string | null;
  status: string | null;
  permissions: string[] | null;
}

async function loadAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();

  /* getClaims(), not getUser().

     getUser() sends the token to the Auth server and waits for a verdict — a real network
     round trip on every single call. getClaims() verifies the signature locally against the
     project's published public key (/.well-known/jwks.json), which this project has: it
     signs with ES256. The key set is fetched once per server process and shared across every
     client instance, so after the first request this costs nothing at all.

     It is not a shortcut around a security check. PostgREST already accepts any correctly
     signed, unexpired token without asking the Auth server, so the database was never
     gated on that call either — we were paying for a check that protected nothing the
     database wasn't already checking itself, by exactly the same means.

     The one real difference: a token stays usable until it expires (1 hour) even if the
     session is revoked server-side, where getUser() would have noticed immediately. That
     was already true of every query this app makes; it is now also true of the UI.

     If the project is ever switched back to a shared-secret (HS256) signing key, the library
     falls back to calling the Auth server on its own — correct, just slower again. */
  const { data: claimData } = await supabase.auth.getClaims();
  const claims = claimData?.claims;
  if (!claims?.sub) return null;

  const base: AuthContext = {
    userId: claims.sub,
    email: claims.email ?? null,
    employeeCode: null,
    nickname: null,
    teamId: null,
    permissions: [],
  };

  const { data } = await supabase.rpc("my_identity");
  const row = (data as IdentityRow[] | null)?.[0];

  // Signed in but not linked to an employee (or the employee was terminated) → no
  // permissions. Deliberately not an error: the account is valid, it just grants nothing.
  if (!row || row.status === "Terminate") return base;

  return {
    ...base,
    employeeCode: row.employee_code,
    nickname: row.nickname,
    teamId: row.team_id,
    permissions: row.permissions ?? [],
  };
}

/**
 * The signed-in user, or null when there is no session.
 *
 * Memoised for the length of one server render: the layout, the page and every query helper
 * that needs permissions all call this, and they should not each pay for it. React clears
 * the cache between requests, so one user's identity can never be served to another.
 *
 * The memo only applies inside a component render — that is all React's cache() offers.
 * Server Actions calling this still make the round trip, which is fine: an action makes one
 * call, not six.
 */
export const getAuthContext = cache(loadAuthContext);
