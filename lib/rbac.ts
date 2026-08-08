// SAMPLE DATA + permission catalog — UI-first, configurable RBAC.
//
// Roles are NOT hardcoded capabilities: a role is an editable SET of permissions, and a
// user holds one or more roles (effective access = the UNION). The CEO edits roles +
// assigns users on /settings/roles. Every role ships with a seeded default matrix (see
// SEED_ROLES) — that matrix IS the access policy, so the wiring phase has a spec to
// enforce rather than an empty grid. CEO is locked to all permissions (superadmin).
//
// Design phase: changes live in component state only (not persisted). Wire later =
// tables `permissions` (fixed catalog), `roles`, `role_permissions`, `user_roles`, and
// a `can()` check fed by the authenticated session's union of role permissions.

export interface Permission {
  key: string;
  label: string;
  hint?: string;
}
export interface PermissionGroup {
  key: string;
  label: string;
  perms: Permission[];
}

// The catalog = the actual gates we implement in the app. Roles combine these freely.
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "leads",
    label: "Lead / ดีล",
    perms: [
      { key: "leads.view_all", label: "ดู Lead ทั้งหมด" },
      { key: "leads.view_own", label: "ดู Lead ของตัวเอง", hint: "เฉพาะที่ได้รับมอบหมาย" },
      { key: "leads.create", label: "เพิ่ม Lead (ปุ่มลอย)", hint: "รับสาย/แชท แล้วบันทึกลูกค้าเป็นลีด" },
      { key: "leads.assign", label: "มอบหมาย Lead" },
      { key: "leads.edit", label: "แก้ไข Lead" },
    ],
  },
  {
    key: "contacts",
    label: "ผู้ติดต่อ",
    perms: [
      { key: "contacts.view_all", label: "ดูผู้ติดต่อทั้งหมด" },
      { key: "contacts.view_own", label: "ดูเฉพาะที่สร้าง/ได้รับมอบหมาย" },
      { key: "contacts.manage", label: "จัดการผู้ติดต่อ" },
    ],
  },
  {
    key: "inventory",
    label: "คลังทรัพย์",
    perms: [
      { key: "listings.view", label: "ดูทรัพย์" },
      { key: "listings.create", label: "เพิ่มทรัพย์ใหม่", hint: "งานของเซลล์ — สร้างรายการทรัพย์ (แยกจากการแก้ไข)" },
      { key: "listings.edit", label: "แก้ไขทรัพย์" },
      { key: "listings.marketing", label: "การตลาด / ลงพอร์ทัล" },
      { key: "projects.edit", label: "แก้ไขโครงการ" },
      { key: "lastmatch.add", label: "เพิ่ม Last Match" },
      // CEO feedback R1: a sale may see ONLY their own closes ("Last Match ของตัวเองเท่านั้น"),
      // a Sales Leader sees their whole team. Three scopes, grant exactly one per role —
      // same convention as leads.view_all / leads.view_own. Widest wins if several are held.
      { key: "lastmatch.view_all", label: "ดู Last Match ทั้งบริษัท" },
      { key: "lastmatch.view_team", label: "ดู Last Match ของทีม", hint: "หัวหน้าทีมเห็นของลูกทีมทุกคน" },
      { key: "lastmatch.view_own", label: "ดู Last Match ของตัวเอง", hint: "เซลส์เห็นเฉพาะดีลที่ตัวเองปิด" },
    ],
  },
  {
    key: "activity",
    label: "กิจกรรม",
    perms: [
      {
        key: "activity.log",
        label: "บันทึกกิจกรรม",
        hint: "ติ๊กงานในแผนวันนี้แล้วระบบบันทึกกิจกรรมให้ — สำหรับคนที่ทำงานขาย",
      },
    ],
  },
  {
    key: "website",
    label: "เว็บพอร์ทัล",
    perms: [
      // Manages the CUSTOMER-FACING portal website (menu, banners, featured content) — a
      // separate gate from listings.marketing (posting listings to portals), which Listing
      // Support also holds. Page is a coming-soon placeholder until the portal is designed.
      {
        key: "website.manage",
        label: "จัดการเนื้อหาเว็บหน้าบ้าน",
        hint: "เมนู / แบนเนอร์ / เนื้อหาบนเว็บพอร์ทัลลูกค้า — Marketing",
      },
    ],
  },
  {
    key: "performance",
    label: "เป้าหมาย / KPI",
    perms: [
      { key: "performance.view_team", label: "ดูผลงานทีม" },
      { key: "performance.view_own", label: "ดูผลงานตัวเอง" },
      { key: "targets.set", label: "ตั้งเป้าหมายให้ทีม" },
      { key: "targets.stretch", label: "ตั้งเป้าหมายส่วนตัวเพิ่ม" },
    ],
  },
  {
    key: "financials",
    label: "การเงิน",
    perms: [
      // Compensation ONLY — this does NOT gate listing prices. Anyone with
      // `listings.view` sees asking/rental price (a listing without a price is useless).
      {
        key: "financials.view_comp",
        label: "ดูค่าตอบแทนของทีม (เงินเดือน/คอมมิชชั่น)",
        hint: "เงินเดือน + เรตคอมของพนักงาน — CEO/HR เท่านั้น",
      },
      { key: "financials.payroll", label: "จัดการเงินเดือน" },
    ],
  },
  {
    key: "people",
    label: "บุคคล",
    perms: [
      { key: "people.manage", label: "จัดการพนักงาน (HR)" },
      {
        key: "people.view_sensitive",
        label: "ดูข้อมูลอ่อนไหว (บัตร ปชช./บัญชี/สลิป)",
        hint: "PII และเอกสารพนักงาน — CEO/HR เท่านั้น",
      },
      {
        key: "teams.manage",
        label: "จัดการทีมขาย",
        hint: "สร้างทีม กำหนดหัวหน้า และมอบหมายเซลเข้าทีม",
      },
      // Leave is two-sided: everyone files, a small group decides. Granted to EVERY role —
      // taking leave is not a privilege.
      { key: "leave.request", label: "ขอลา", hint: "ยื่นใบลาจากหน้าแผนวันนี้" },
      {
        key: "leave.manage",
        label: "อนุมัติ / จัดการวันลา",
        hint: "ดูใบลาทุกคนและอนุมัติ — CEO / HR",
      },
      {
        key: "people.manage_accounts",
        label: "จัดการบัญชีผู้ใช้ (สร้าง/ตั้งรหัสผ่าน)",
        hint: "สร้างบัญชี login ใหม่ + รีเซ็ตรหัสผ่าน — เข้าถึงบัญชี auth โดยตรง CEO / HR เท่านั้น",
      },
    ],
  },
  {
    key: "masterdata",
    label: "ข้อมูลหลัก",
    perms: [
      {
        key: "masterdata.govern",
        label: "จัดการโซน & เทมเพลตกิจกรรม/KPI",
        hint: "โซน · ประเภทกิจกรรม · เทมเพลต KPI — CEO/หัวหน้า",
      },
      {
        key: "reference.manage",
        label: "จัดการรายการอ้างอิง (ประเภททรัพย์ / ช่องทาง / ฟิลด์ Lead)",
        hint: "ประเภททรัพย์ · Marketing Channel · Contact By · เพศ · สัญชาติ",
      },
      {
        key: "checklists.manage",
        label: "จัดการเช็คลิสต์ทรัพย์ (A-List / Exclusive)",
        hint: "เทมเพลตงานเพิ่มมูลค่าทรัพย์เด่น — CEO / Listing Support",
      },
      {
        key: "copy.manage",
        label: "จัดการเทมเพลตคำโฆษณา",
        hint: "คำประกาศโฆษณาทรัพย์ (Headline / โพสต์ / DDproperty) — CEO / Marketing / Listing Support",
      },
    ],
  },
  {
    key: "system",
    label: "ระบบ",
    perms: [{ key: "roles.manage", label: "จัดการบทบาท & สิทธิ์" }],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.perms.map((p) => p.key)
);

export function permissionLabel(key: string): string {
  for (const g of PERMISSION_GROUPS) {
    const p = g.perms.find((x) => x.key === key);
    if (p) return p.label;
  }
  return key;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  /** Permission keys granted. */
  permissions: string[];
  /** System role: cannot be deleted; CEO is locked to all permissions. */
  system?: boolean;
}

export interface OrgUser {
  id: string;
  name: string;
  /** One or more role ids — effective access is the union of their permissions. */
  roleIds: string[];
}

// Roles reflect the real org (HR Sheet → Position / 2nd Position): CEO, Agent (Sales),
// Listing Support, Marketing are staffed today. Sales Leader is now staffed (Pup, Game) as
// the two seeded team leads (see lib/teams.ts) to demonstrate team scoping. Admin / HR remain
// seeded but UNSTAFFED (0 users = 0 real access) — they document the org's stated future
// (lead dispatch, payroll) and are testable via view-as. CEO can delete any that go unused.
//
// This matrix is the **intended access policy** and the spec the wiring phase must
// reproduce in RLS — the client-side `can()` is convenience, not enforcement.
// Rules encoded here:
//   • view_all beats view_own — grant only one per surface.
//   • Last Match is 3-scoped (CEO feedback R1, 2026-07-29): own (Agent) → team (Sales
//     Leader) → all (CEO, Listing Support). A closing record is private performance data;
//     Marketing/Admin/HR get NO scope at all, which hides the page for them entirely.
//   • Agents are own-scoped (matches the created_by/assigned_to contact privacy already
//     built) but DO see team performance — the leaderboard is intentionally public.
//   • Compensation + PII are CEO/HR only, and are two SEPARATE gates.
//   • activity.log goes to roles that DO logged field actions. Every action in
//     ACTION_GROUPS is a SALES action — including ถ่ายรูป and Reels, which the sale performs,
//     not Marketing (confirmed by Ben, 2026-07-29). So: Agent, Sales Leader, CEO only.
//     NOT Marketing (this used to be granted on the false premise that they shoot the
//     Reels — there is no action in the catalog they would ever log), NOT Listing Support
//     (portal-only), NOT Admin. Logging now happens by completing a Daily-Plan task; the
//     +บันทึก FAB was removed in CEO feedback R1.
//   • Master data is split into two gates: reference.manage = the light lead/listing
//     vocabularies (property type, marketing channel, contact-by, gender, nationality),
//     delegated to Listing Support; masterdata.govern = the structural/leadership data
//     (zones = the listing↔lead↔match join key, activity types, KPI templates), CEO-only.
export const SEED_ROLES: Role[] = [
  {
    id: "ceo",
    name: "CEO",
    description: "ผู้บริหารสูงสุด — เข้าถึงทุกอย่าง กำหนดบทบาทและสิทธิ์",
    permissions: [...ALL_PERMISSIONS],
    system: true,
  },
  {
    id: "agent",
    name: "Agent (Sales)",
    description: "เซลส์ / ดูแลดีลของตัวเอง",
    // No performance.view_team: the ผลงาน group (team) is leadership-only.
    // Agents keep performance.view_own for their own แผนวันนี้. The dashboard leaderboard is
    // ungated, so agents still see it.
    permissions: [
      "leads.view_own",
      "leads.edit",
      "contacts.view_own",
      "contacts.manage",
      "listings.view",
      "listings.create", // Sales sources & creates listings (the ทรัพย์ page + เพิ่มทรัพย์)
      "listings.edit",
      "lastmatch.add",
      "lastmatch.view_own", // CEO R1: own closes only — never another sale's record
      "activity.log",
      "performance.view_own",
      "targets.stretch",
      "leave.request",
    ],
  },
  {
    id: "listing_support",
    name: "Listing Support",
    description: "งานสนับสนุนการลงประกาศ/คลังทรัพย์ + มอบหมายดีล",
    permissions: [
      // Lead assignment + intake is a core back-office job for this role.
      "leads.create",
      "leads.assign",
      // Needs every owner's contact to coordinate listings — not own-scoped.
      "contacts.view_all",
      "listings.view",
      "listings.edit",
      "listings.marketing",
      "projects.edit",
      "lastmatch.add",
      // Back-office: coordinates across every agent's inventory, so not own-scoped.
      "lastmatch.view_all",
      // Governs the lead/listing reference vocabularies they live in (property type, marketing
      // channel, contact-by, gender, nationality) — NOT zones / activity / KPI (masterdata.govern).
      "reference.manage",
      // Owns the value-add checklist templates for A-List/Exclusive listings (cross-team steps).
      "checklists.manage",
      // Also edits the ad-copy templates (คำประกาศโฆษณา) alongside Marketing.
      "copy.manage",
      // No activity.log: this role only manages/posts listings on portals — it doesn't do
      // the logged field actions (Owner Visit / Show / Call…), so no +บันทึก activity FAB.
      "performance.view_own",
      "targets.stretch",
      "leave.request",
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "การตลาด / โซเชียล / ลงโฆษณา",
    permissions: [
      "listings.view",
      "listings.marketing",
      // Owns the customer-facing portal website's menu/content (/website — placeholder
      // until the portal is designed). NOT granted to Listing Support: their portal work
      // is posting listings (listings.marketing), not the website itself.
      "website.manage",
      // Owns the ad-copy templates (คำประกาศโฆษณา) — copywriting is Marketing's job.
      "copy.manage",
      // NO activity.log: every action in the catalog is a sales action (the sale shoots the
      // Reels, not Marketing), so there is nothing here for this role to log. Marketing
      // still gets a Daily Plan via performance.view_own — it's just a plain to-do list.
      "performance.view_own",
      "targets.stretch",
      "leave.request",
    ],
  },
  {
    id: "sales_leader",
    name: "Sales Leader",
    description: "หัวหน้าทีมขาย (ยังไม่มีผู้ดำรงตำแหน่ง)",
    permissions: [
      "leads.view_all",
      "leads.create",
      "leads.edit",
      "leads.assign",
      "contacts.view_all",
      "contacts.manage",
      "listings.view",
      "listings.create", // Sales Leaders still sell — they source & create listings too
      "listings.edit",
      "lastmatch.add",
      "lastmatch.view_team", // CEO R1: "หัวหน้าทีมเห็นของทั้งทีม"

      "activity.log",
      "performance.view_own",
      "performance.view_team",
      "targets.set",
      "targets.stretch",
      "leave.request",
    ],
  },
  {
    id: "admin",
    name: "Admin",
    description: "งานธุรการ / รับลีดทุกช่องทาง + มอบหมายดีล (ยังไม่มีผู้ดำรงตำแหน่ง)",
    permissions: [
      "leads.view_all",
      "leads.create",
      "leads.edit",
      "leads.assign",
      "contacts.view_all",
      "contacts.manage",
      "listings.view",
      "leave.request",
    ],
  },
  {
    id: "hr",
    name: "HR",
    description: "งานบุคคล / เงินเดือน (ยังไม่มีผู้ดำรงตำแหน่ง)",
    permissions: [
      "people.manage",
      "people.view_sensitive",
      "financials.view_comp",
      "financials.payroll",
      "performance.view_team",
      "leave.request",
      "leave.manage", // HR owns the approval queue
      "people.manage_accounts", // create/reset logins — CEO/HR only (Ben, 2026-08-08)
    ],
  },
];

// Real staff (HR Sheet → Employee Lists, Active only). Stone is a genuine player-coach:
// CEO who also carries a Sales role. Login ids mirror lib/team.ts Employee.id.
export const SEED_USERS: OrgUser[] = [
  { id: "u_stone", name: "Stone", roleIds: ["ceo", "agent"] },
  // Pup & Game lead the two seeded sales teams (lib/teams.ts) — hence [agent, sales_leader],
  // the player-coach shape. Design-first demo: it activates the Sales Leader role + shows team
  // scoping (a leader sees only their team). The real org may designate different leads.
  { id: "u_pup", name: "Pup", roleIds: ["agent", "sales_leader"] },
  { id: "u_game", name: "Game", roleIds: ["agent", "sales_leader"] },
  { id: "u_q", name: "Q", roleIds: ["agent"] },
  { id: "u_mhow", name: "Mhow", roleIds: ["agent"] },
  { id: "u_golf", name: "Golf", roleIds: ["agent"] },
  { id: "u_benz", name: "Benz", roleIds: ["listing_support"] },
  { id: "u_pui", name: "Pui", roleIds: ["marketing"] },
];

/** Effective permission set for a user = union across their roles. */
export function effectivePermissions(user: OrgUser, roles: Role[]): Set<string> {
  const out = new Set<string>();
  for (const rid of user.roleIds) {
    const r = roles.find((x) => x.id === rid);
    r?.permissions.forEach((p) => out.add(p));
  }
  return out;
}

export function can(perms: Set<string>, key: string): boolean {
  return perms.has(key);
}

export function roleUserCount(roleId: string, users: OrgUser[]): number {
  return users.filter((u) => u.roleIds.includes(roleId)).length;
}
