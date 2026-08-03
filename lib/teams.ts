// Sales TEAMS — the org sub-structure under the CEO: a named team, a leader, its members,
// and a monthly revenue goal. DESIGN-FIRST + in-memory: teams live in the shared org store
// (RbacProvider) so the Settings manager edits live-update every surface — mirrors how roles
// and user-roles work. Wire later = a `teams(id, name, leader_id, revenue_goal)` table + a
// membership link (`employees.team_id`, or a `team_members` join for multi-team).
//
// Membership is stored on the Team (memberIds) rather than on Employee, so a team can be
// created/reassigned at runtime without mutating the static employee list. The leader is a
// member by definition (kept in memberIds too).

export interface Team {
  id: string;
  name: string;
  /** Employee/OrgUser id of the team leader (ids mirror across rbac + team). */
  leaderId: string;
  /** All members' ids (includes the leader). */
  memberIds: string[];
  /** Team monthly revenue goal (฿) — feeds team-level targets/dashboards at wiring. */
  revenueGoal: number;
}

// Seeded sample teams — the 6 selling agents split into two pods, each led by a senior sale.
// (Design-first: the real org has no formally designated team leads yet; this demonstrates
// the structure. Leaders here are also granted the Sales Leader role in SEED_USERS.)
export const SEED_TEAMS: Team[] = [
  {
    id: "team_a",
    name: "ทีม A · โซนใน",
    leaderId: "u_pup",
    memberIds: ["u_pup", "u_q", "u_mhow"],
    revenueGoal: 6_000_000,
  },
  {
    id: "team_b",
    name: "ทีม B · โซนนอก",
    leaderId: "u_game",
    memberIds: ["u_game", "u_golf", "u_stone"],
    revenueGoal: 6_000_000,
  },
];

/** The team an employee/user belongs to (by id), or undefined if unassigned. */
export function teamOf(teams: Team[], memberId: string): Team | undefined {
  return teams.find((t) => t.memberIds.includes(memberId));
}

/** The team a user LEADS, or undefined. */
export function teamLedBy(teams: Team[], leaderId: string): Team | undefined {
  return teams.find((t) => t.leaderId === leaderId);
}

// ── Scoping ───────────────────────────────────────────────────────────────────────────
// The set of member ids a viewer may see in team/performance surfaces:
//   • org-wide viewers (CEO/admin — `isOrgWide`) → null = "everyone, no scope".
//   • a team leader who is NOT org-wide            → just their team's members.
//   • anyone else                                  → just themselves.
// Return null means "no scoping" (see all). Callers filter their agent list by the returned
// Set, or skip filtering when null.
export function visibleMemberIds(
  teams: Team[],
  viewerId: string,
  isOrgWide: boolean
): Set<string> | null {
  if (isOrgWide) return null;
  const led = teamLedBy(teams, viewerId);
  if (led) return new Set(led.memberIds);
  return new Set([viewerId]);
}
