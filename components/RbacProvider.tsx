"use client";

import * as React from "react";
import {
  SEED_ROLES,
  SEED_USERS,
  effectivePermissions,
  type Role,
  type OrgUser,
} from "@/lib/rbac";
import { SEED_TEAMS, type Team } from "@/lib/teams";

// Shared RBAC store — single source for BOTH the Settings role editor and app-wide gating,
// so editing a role's permissions live-changes what that persona sees.
//
// TWO MODES (2026-08-03):
//   • signed in (`session` prop) — `perms` comes from the DB:
//     auth.users → main_1_hr.auth_user_id → user_roles → role_permissions. "View as" is then
//     an admin tool, offered only to holders of `roles.manage`.
//   • no session — the design-phase behaviour: seeded org + free "view as" switcher. This is
//     what runs today, because no accounts exist until the HR sheet is imported.
//
// The roles/users/teams lists are still the SEEDS even when signed in: the DB tables exist
// (and RLS already reads them), but `main_1_hr` holds demo rows, so a DB-backed org list
// would name people who aren't in the app's Employee data. They get swapped together with
// the HR import — the session's permissions are the part that had to be real first.

interface SessionIdentity {
  /** null when the account isn't linked to an employee row yet. */
  employeeCode: string | null;
  name: string;
  permissions: string[];
}

interface RbacValue {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  users: OrgUser[];
  setUsers: React.Dispatch<React.SetStateAction<OrgUser[]>>;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  viewerId: string;
  setViewerId: (id: string) => void;
  currentUser: OrgUser;
  perms: Set<string>;
  /** True if any of the given permission keys is granted (or none required). */
  can: (keys?: string | string[]) => boolean;
  /** True when a real session backs `perms` (not the seeded demo identity). */
  isAuthenticated: boolean;
  /** Whether the "view as" switcher should be offered at all. */
  canViewAs: boolean;
}

const RbacCtx = React.createContext<RbacValue | null>(null);
const STORAGE_KEY = "haus.viewAs";

/** Sentinel viewerId meaning "me, not impersonating anyone". */
export const SELF_ID = "__self__";

export function RbacProvider({
  children,
  session = null,
}: {
  children: React.ReactNode;
  session?: SessionIdentity | null;
}) {
  const [roles, setRoles] = React.useState<Role[]>(() =>
    SEED_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }))
  );
  const [users, setUsers] = React.useState<OrgUser[]>(() =>
    SEED_USERS.map((u) => ({ ...u, roleIds: [...u.roleIds] }))
  );
  const [teams, setTeams] = React.useState<Team[]>(() =>
    SEED_TEAMS.map((t) => ({ ...t, memberIds: [...t.memberIds] }))
  );
  // Signed in → start as yourself. Demo mode → the CEO (Stone), so the app renders full
  // before the client hydrates a saved choice.
  const [viewerId, setViewerIdState] = React.useState<string>(session ? SELF_ID : "u_stone");

  React.useEffect(() => {
    // Impersonation is deliberately NOT sticky for a real account: coming back tomorrow
    // still logged in as someone else is how people misread what they're allowed to see.
    if (session) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    // Ignore a stale saved id (e.g. an old seed user that no longer exists).
    if (saved && SEED_USERS.some((u) => u.id === saved)) setViewerIdState(saved);
  }, [session]);

  const setViewerId = React.useCallback(
    (id: string) => {
      setViewerIdState(id);
      if (session) return; // don't persist an impersonation across reloads
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
    },
    [session]
  );

  // The signed-in person's own permissions, straight from the DB. Independent of `viewerId`
  // so that "view as" can never widen access — an admin impersonating the CEO still holds
  // only what their own account grants, and RLS would refuse anything more anyway.
  const sessionPerms = React.useMemo(
    () => new Set(session?.permissions ?? []),
    [session]
  );

  // Impersonation is a debugging tool, not an escalation path: you must already govern
  // roles to use it. Without a session (demo mode) it stays open, since it IS the identity.
  const canViewAs = !session || sessionPerms.has("roles.manage");

  const seededUser = React.useMemo(
    () => users.find((u) => u.id === viewerId) ?? users[0],
    [users, viewerId]
  );

  const currentUser = React.useMemo<OrgUser>(() => {
    if (!session) return seededUser;
    // Impersonating → show who you're pretending to be. Otherwise show the real account,
    // matched to a seeded user by name so the avatar/roles read correctly in the demo org.
    if (canViewAs && viewerId !== SELF_ID) return seededUser;
    return (
      users.find((u) => u.name === session.name) ?? {
        id: SELF_ID,
        name: session.name,
        roleIds: [],
      }
    );
  }, [session, seededUser, users, viewerId, canViewAs]);

  const perms = React.useMemo(() => {
    if (!session) return effectivePermissions(currentUser, roles);
    // While impersonating, show that persona's view — but intersected with what the real
    // account actually holds, so the preview can never exceed real access.
    if (canViewAs && viewerId !== SELF_ID) {
      const target = effectivePermissions(currentUser, roles);
      return new Set([...target].filter((p) => sessionPerms.has(p)));
    }
    return sessionPerms;
  }, [session, currentUser, roles, sessionPerms, viewerId, canViewAs]);

  const can = React.useCallback(
    (keys?: string | string[]) => {
      if (!keys) return true;
      const list = Array.isArray(keys) ? keys : [keys];
      if (list.length === 0) return true;
      return list.some((k) => perms.has(k));
    },
    [perms]
  );

  const value: RbacValue = {
    roles,
    setRoles,
    users,
    setUsers,
    teams,
    setTeams,
    viewerId,
    setViewerId,
    currentUser,
    perms,
    can,
    isAuthenticated: !!session,
    canViewAs,
  };

  return <RbacCtx.Provider value={value}>{children}</RbacCtx.Provider>;
}

export function useRbac(): RbacValue {
  const ctx = React.useContext(RbacCtx);
  if (!ctx) throw new Error("useRbac must be used within RbacProvider");
  return ctx;
}
