import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { Project } from "@/lib/projects";
import type { LastMatch } from "@/lib/lastMatch";
import {
  normalizePhone,
  roleForLeadType,
  type Contact,
  type ContactRole,
  type ContactSummary,
} from "@/lib/contacts";
import { stageMeta } from "@/lib/pipeline";
import type { LeadActivityRow, LeadAuditRow } from "@/lib/leadTimeline";
import {
  DEFAULT_LEAVE_ALLOWANCES,
  type LeaveAllowance,
  type LeaveRequest,
  type LeaveStatus,
} from "@/lib/leave";
import {
  asEmployeeStatus,
  asGender,
  departmentOf,
  type Employee,
} from "@/lib/team";
import { todayISO } from "@/lib/momentum";
import { withCase, type ClosedCase } from "@/lib/deals";
import type { KpiTemplate, TemplateKind, TemplateSource } from "@/lib/masterdata";
import { comboKey, type CopyGrade, type CopyTemplate, type CopyType } from "@/lib/listingCopy";
import type {
  ChecklistItemType,
  ChecklistTemplate,
  FocusTier,
  ProgressMap,
} from "@/lib/checklists";

type KpiRow = {
  id: number;
  label: string;
  kind: TemplateKind;
  source: TemplateSource;
  activity_type: string | null;
  default_target: number | string;
};
type CopyRow = {
  grade: CopyGrade;
  copy_type: CopyType;
  headline: string;
  normal_body: string;
  dd_body: string;
};
type ChecklistTemplateRow = {
  id: number;
  name: string;
  applies_to: string[] | null;
  sort: number;
  checklist_template_item:
    | {
        id: number;
        label: string;
        item_type: ChecklistItemType;
        role: string | null;
        repeat_days: number | null;
        sort: number;
      }[]
    | null;
};
type ProgressRow = {
  template_item_id: number;
  completed_at: string | null;
  completed_by: string | null;
  due_date: string | null;
  url: string | null;
  note: string | null;
};
import type { Zone, ZoneSale } from "@/lib/zones";
import type { ActivityTally, RankCriterion, SalesRank } from "@/lib/probation";
import type { Activity, AttachMode } from "@/lib/actions";
import type { AppNotification, NotificationEntity, NotificationType } from "@/lib/notifications";

// Page data reads run on the SESSION-AWARE server client. The old sessionless anon client
// (lib/supabase.ts) is deleted, not merely unused: RLS filters every table below on
// `current_employee_code()` / `has_perm()`, which are NULL/false without a session, so any
// query made through it would silently return zero rows now that `demo_read_all` is gone.
//
// Consequence, and it is the correct one: reading cookies makes these pages dynamic, so the
// 30s ISR window is gone. A page cached for one user must never be served to another now that
// two users legitimately see different rows.
//
// Server-only by construction: `cookies()` throws outside a request, so importing this from a
// client component is a build error rather than a silent leak.

export interface CrmRow {
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  line_id?: string | null;
  potential: string | null;
  lead_status: string | null;
  pipeline_stage: string | null;
  lead_type: string | null;
  sale_id: string | null;
  listing_code: string | null;
  budget: number | null;
  commission: number | null;
  last_follow_date: string | null;
  /** เซ็นสัญญา. The sales scoreboard counts on this — see lib/deals.ts. */
  closing_date: string | null;
  /** โอนกรรมสิทธิ์, weeks after closing_date. The money counts on this one. */
  transfer_date: string | null;
  /** ราคาปิดจริง — usually below the listing's asking price. Added 2026-09-06; nothing
      else in the database records what a unit actually sold for. */
  closing_price: number | null;
  case_closing_remark: string | null;
  date_received: string | null;
  /** Where the lead came from — main_6_buyer_crm.marketing_channel. */
  marketing_channel: string | null;
  /** Group tag — main_6_buyer_crm.tag_id, FK to lead_tags_ref(id). */
  tag_id: string | null;
  /** Complaint tracking — all three null together = no open complaint. */
  customer_complain: string | null;
  complain_status: string | null;
  complain_remark: string | null;
  /** The lead's deals, newest first once through withCase(). */
  primary_case?: ClosedCase | null;
  closed_case?: unknown;
}

/* The lead's own closing columns (commission, closing_date, transfer_date, closing_price,
   case_closing_remark) are NOT selected any more. Since 2026-09-10 a deal is a row in
   closed_case; those five columns keep their old values but nothing writes or reads them.
   The embed below brings the lead's cases along, and `withCase()` (lib/deals.ts) fills
   the same five fields on CrmRow from the case — so every reader of `c.commission` keeps
   working, and all of them now agree with the dashboard. */
const CASE_EMBED =
  "closed_case(case_id,lead_id,listing_id,deal_type,status,closing_date,transfer_date,closing_price,forecast_revenue,real_revenue,remark,buyer_name,agents:closed_case_agent(employee_code,is_primary,forecast_share,real_share))";

const CRM_COLUMNS =
  "lead_id,lead_name,phone,line_id,potential,lead_status,pipeline_stage,lead_type,sale_id,listing_code,budget,last_follow_date,date_received,marketing_channel,tag_id,customer_complain,complain_status,complain_remark," +
  CASE_EMBED;

// Mirrors `v_main_listing` in full — all 55 exposed columns. Types were probed against the
// live schema (not inferred from sample rows, which are mostly null): `floor` and `unit_no`
// really are TEXT; `parking` is an integer; sign/vdo/owner_focus are booleans; the three
// *_date columns are dates. Keep this in sync with LISTING_COLUMNS below.
//
// NOT here because the view doesn't expose them yet (15 sheet columns — Hook, ส่วนกลาง,
// อายุ, Photo Album, Link, Last Match Price/Remark/Type, New Photo, Facebook Ad, DD Boost,
// LV Boost, FB Repost, Marketing Report). See CEO_FEEDBACK_R1.md §2.3.
export interface ListingRow {
  // Identity & status
  listing_id: string;
  listing_name: string | null;
  listing_status: string | null;
  potential: string | null;
  listing_type: string | null;
  owner_focus: boolean | null;
  date_created: string | null;
  created_at: string | null;
  updated_at: string | null;
  days_on_market: number | null;
  /** Signed Exclusive-agreement window. On the listing itself, not main_10 — that row is
   *  deleted the moment the listing drops out of the A-List criteria. */
  agreement_start: string | null;
  agreement_end: string | null;
  /** Managing agent. Present in the view but NULL in the live rows — until the import
   *  backfills it, `lib/listings.ts` seeds a stand-in. Delete that seed once populated. */
  created_by: string | null;

  /** Who manages this listing. `sale_id` is what the row states; `effective_sale_id` falls
   *  back to the zone's primary agent when it is blank, and is the one to scope "mine" by —
   *  a listing with no agent still belongs to whoever owns the zone. */
  sale_id: string | null;
  effective_sale_id: string | null;

  // Location
  project_id: string | null;
  project_name_eng: string | null;
  zone: string | null;
  zone_name_thai: string | null;
  zone_name_eng: string | null;
  in_out_project: string | null;
  road_soi: string | null;
  link_location: string | null;

  // Specs
  property_type: string | null;
  unit_no: string | null;
  bed: number | null;
  bath: number | null;
  area_rai: number | null;
  area_ngan: number | null;
  area_wa: number | null;
  area_sqm: number | null;
  floor: string | null;
  building: string | null;
  direction: string | null;
  view_type: string | null;
  unit_position: string | null;
  parking: number | null;
  unit_condition: string | null;

  // Pricing
  asking_price: number | null;
  rental_price: number | null;
  old_price: number | null;
  new_price: number | null;
  update_remark: string | null;
  price_remark: string | null;

  // Owner
  owner_id: number | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_line: string | null;
  owner_talk_last_date: string | null;
  /** Owner-side pipeline (lib/ownerPipeline.ts). NOT listing_status, which is the
      marketing queue for the advert. */
  owner_stage: string | null;
  activity_comment: string | null;

  // Marketing / portals
  sign: boolean | null;
  vdo: boolean | null;
  ddproperty_link: string | null;
  livinginsider_link: string | null;
  livinginsider_date: string | null;
  propertyhub_link: string | null;
  shorts_reels_link: string | null;
  hometour_link: string | null;

  // Misc
  remark: string | null;
}

/** Every column of `v_main_listing`, in the ListingRow order. Single source for both queries. */
const LISTING_COLUMNS = [
  "listing_id", "listing_name", "listing_status", "potential", "listing_type", "owner_focus",
  "date_created", "created_at", "updated_at", "days_on_market", "created_by",
  "agreement_start", "agreement_end",
  "sale_id", "effective_sale_id",
  "project_id", "project_name_eng", "zone", "zone_name_thai", "zone_name_eng",
  "in_out_project", "road_soi", "link_location",
  "property_type", "unit_no", "bed", "bath", "area_rai", "area_ngan", "area_wa", "area_sqm",
  "floor", "building", "direction", "view_type", "unit_position", "parking", "unit_condition",
  "asking_price", "rental_price", "old_price", "new_price", "update_remark", "price_remark",
  "owner_id", "owner_name", "owner_phone", "owner_line", "owner_talk_last_date", "owner_stage",
  "activity_comment",
  "sign", "vdo", "ddproperty_link", "livinginsider_link", "livinginsider_date",
  "propertyhub_link", "shorts_reels_link", "hometour_link",
  "remark",
].join(",");

export interface SaleStatusRow {
  employee_code: string;
  nickname: string | null;
  first_name_en: string | null;
  zones: string | null;
  total_leads: number;
  total_crm: number;
  crm_win: number;
  total_commission: number;
  total_listings: number;
  total_matches: number;
  total_match_value: number;
}

export async function getCrm(): Promise<CrmRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_6_buyer_crm")
    .select(CRM_COLUMNS)
    .order("date_received", { ascending: false });
  return ((data ?? []) as unknown as CrmRow[]).map(withCase);
}

export async function getListings(): Promise<ListingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_main_listing")
    .select(LISTING_COLUMNS)
    .order("listing_id");
  return (data as unknown as ListingRow[]) ?? [];
}

/**
 * The listings this person manages — what the "ทรัพย์" page shows.
 *
 * Scoping lives here, not in RLS: the company-listings page reads the same table and must
 * still see every row (that page exists so agents can find a co-agent). What RLS does
 * enforce is the part that actually leaks — owner phone/line come back NULL for listings
 * you don't manage unless you hold `contacts.view_all`.
 *
 * Back-office roles (marketing, admin, HR) manage no listings, so this is empty for them by
 * design; ทรัพย์ทั้งบริษัท is their surface.
 */
export async function getMyListings(): Promise<ListingRow[]> {
  const auth = await getAuthContext();
  const all = await getListings();
  // No session (AUTH_ENFORCED off) → keep the design-phase behaviour of showing everything,
  // otherwise the page reads as broken rather than as scoped.
  if (!auth?.employeeCode) return all;
  return all.filter((l) => l.effective_sale_id === auth.employeeCode);
}

/**
 * The listing facts the closing card needs, and nothing else.
 *
 * Deliberately not `getListing()`, which reads all 55 columns of `v_main_listing` to render
 * a price and a status.
 *
 * Reads the base table rather than the view because `listing_status` is what the deal
 * writes back to, and the value read must be the value written — a view could filter or
 * rename it and the comparison would quietly stop matching.
 */
export interface DealListingContext {
  asking_price: number | null;
  listing_status: string | null;
  sale_id: string | null;
}

/** A lead plus the unit its deal is priced against. Only the detail view needs the second
    half, so it is not folded into `CrmRow` — the list reads hundreds of rows and wants none
    of it. */
export interface LeadDetailRow extends CrmRow {
  deal_listing: DealListingContext | null;
  /** The market-log entry this lead's close created, if it still exists. At most one —
      uq_last_match_lead. Present so the closing card can offer to clear it when a lead is
      reopened; a row saying a property sold when the sale fell through is worse than none. */
  last_match: { last_match_id: string; last_match_price: number | null }[];
}

/**
 * One lead, with its deal's listing attached.
 *
 * The listing used to be a SECOND round trip, fired after this one returned because it keys
 * off `listing_code` — ~0.4s of pure waiting on a page that had already finished fetching
 * everything else. The foreign key added on 2026-09-10
 * (`main_6_buyer_crm_listing_code_fkey`) lets PostgREST join it in the same request, so the
 * dependency costs nothing.
 *
 * The FK is named explicitly: `main_6_buyer_crm` has eighteen foreign keys and PostgREST
 * needs to be told which relationship this embed means.
 *
 * The embed obeys the listing table's own RLS, so a caller without `listings.view` gets null
 * here — exactly what the separate query returned them before.
 */
export async function getLead(id: string): Promise<LeadDetailRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_6_buyer_crm")
    .select(
      `${CRM_COLUMNS}` +
        `,deal_listing:main_4_listing_database!main_6_buyer_crm_listing_code_fkey(asking_price,listing_status,sale_id)` +
        `,last_match:main_7_last_match!main_7_last_match_lead_id_fkey(last_match_id,last_match_price)`
    )
    .eq("lead_id", id)
    .maybeSingle();
  return data ? withCase(data as unknown as LeadDetailRow) : null;
}

export async function getListing(id: string): Promise<ListingRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_main_listing")
    .select(LISTING_COLUMNS)
    .eq("listing_id", id)
    .maybeSingle();
  return (data as unknown as ListingRow | null) ?? null;
}

export async function getSaleStatus(): Promise<SaleStatusRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_sale_status")
    .select(
      "employee_code,nickname,first_name_en,zones,total_leads,total_crm,crm_win,total_commission,total_listings,total_matches,total_match_value"
    )
    .neq("employee_code", "C-001")
    .order("total_match_value", { ascending: false });
  return (data as SaleStatusRow[]) ?? [];
}

export async function getPotentialCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("main_10_potential_listing")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * The staff a listing can be handed to, by employee code.
 *
 * This replaces `lib/listings.ts`, which picked a "managing agent" by hashing the listing
 * id — a demo device that survived into the live app. It decided who the ทรัพย์ทั้งบริษัท
 * page told you to phone for a co-agent, and which listings the owner-contact card treated
 * you as manager of. `main_4_listing_database.sale_id` has been the real answer since
 * 2026-08-03; `effective_sale_id` falls back to the zone's primary agent.
 *
 * Only columns `authenticated` may read: salary/PII were revoked at the column level.
 */
export interface StaffMember {
  code: string;
  nickname: string;
  position: string | null;
  phone: string | null;
  lineUserId: string | null;
}

export async function getStaffDirectory(): Promise<StaffMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_1_hr")
    .select("employee_code,nickname,position,phone,line_userid")
    .order("employee_code");
  return ((data ?? []) as {
    employee_code: string;
    nickname: string | null;
    position: string | null;
    phone: string | null;
    line_userid: string | null;
  }[]).map((e) => ({
    code: e.employee_code,
    nickname: e.nickname ?? e.employee_code,
    position: e.position,
    phone: e.phone,
    lineUserId: e.line_userid,
  }));
}

/**
 * Nickname for an `auth.users` id — what `main_4_listing_database.created_by` stores.
 *
 * All 511 listings carry the same uuid (the admin account the 2026-08-03 import ran as),
 * and the listing page was printing it verbatim: a raw internal id where a person's name
 * belongs. Returns null when the uuid belongs to no employee row.
 */
export async function getNicknameByAuthId(
  authUserId: string | null | undefined
): Promise<string | null> {
  if (!authUserId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_1_hr")
    .select("nickname")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return (data?.nickname as string | undefined) ?? null;
}

/**
 * The signed-in person's notification feed.
 *
 * RLS is own-row, but `roles.manage` widens it to every row — so this filters on
 * employee_code explicitly. Without that an admin's bell would show the whole company's
 * notifications, which is the same trap the /today task list hit in Phase 5.
 */
export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,employee_code,type,title,body,entity,entity_id,actor,created_at,read_at")
    .eq("employee_code", auth.employeeCode)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as {
    id: number;
    employee_code: string;
    type: string;
    title: string;
    body: string | null;
    entity: string | null;
    entity_id: string | null;
    actor: string | null;
    created_at: string;
    read_at: string | null;
  }[]).map((n) => ({
    id: n.id,
    employeeCode: n.employee_code,
    type: n.type as NotificationType,
    title: n.title,
    body: n.body ?? undefined,
    entity: (n.entity as NotificationEntity | null) ?? undefined,
    entityId: n.entity_id ?? undefined,
    actor: n.actor ?? undefined,
    createdAt: n.created_at,
    readAt: n.read_at,
  }));
}

/**
 * The logged activity feed — 2,334 real rows, where the page showed a sample of a dozen.
 *
 * ⚠️ RLS on `activities` is own-row unless the viewer holds `performance.view_team`, and
 * `visible_employee_codes()` is "just me" until the CEO names a team. So this returns the
 * viewer's own work for almost everyone today; that is the truth, not a filter bug.
 */
export async function getActivityFeed(limit = 200): Promise<Activity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id,employee_code,action,activity_date,count,remark,related_lead_id,related_listing_id")
    .order("activity_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`อ่านกิจกรรมไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []) as {
    id: number;
    employee_code: string;
    action: string;
    activity_date: string;
    count: number | null;
    remark: string | null;
    related_lead_id: string | null;
    related_listing_id: string | null;
  }[];

  // Resolve the names the feed shows, in two batched lookups rather than per row.
  const leadIds = [...new Set(rows.map((r) => r.related_lead_id).filter(Boolean))] as string[];
  const listingIds = [...new Set(rows.map((r) => r.related_listing_id).filter(Boolean))] as string[];
  const [staff, leads, listings, actionTypes] = await Promise.all([
    getStaffDirectory(),
    leadIds.length
      ? supabase.from("main_6_buyer_crm").select("lead_id,lead_name").in("lead_id", leadIds)
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase.from("v_main_listing").select("listing_id,listing_name").in("listing_id", listingIds)
      : Promise.resolve({ data: [] }),
    supabase.from("action_type").select("name,attach"),
  ]);

  const nickname = new Map(staff.map((s) => [s.code, s.nickname]));
  const leadName = new Map(
    ((leads.data ?? []) as { lead_id: string; lead_name: string | null }[]).map((l) => [
      l.lead_id,
      l.lead_name,
    ])
  );
  const listingName = new Map(
    ((listings.data ?? []) as { listing_id: string; listing_name: string | null }[]).map((l) => [
      l.listing_id,
      l.listing_name,
    ])
  );
  const attachOf = new Map(
    ((actionTypes.data ?? []) as { name: string; attach: string | null }[]).map((a) => [
      a.name,
      (a.attach as AttachMode | null) ?? "either",
    ])
  );

  return rows.map((r) => ({
    id: String(r.id),
    created_by: nickname.get(r.employee_code) ?? r.employee_code,
    action: r.action,
    attach: attachOf.get(r.action) ?? "either",
    related_lead_id: r.related_lead_id,
    related_lead_name: r.related_lead_id ? leadName.get(r.related_lead_id) ?? null : null,
    related_listing_id: r.related_listing_id,
    related_listing_name: r.related_listing_id ? listingName.get(r.related_listing_id) ?? null : null,
    date: r.activity_date,
    count: r.count ?? 0,
    remark: r.remark,
  }));
}

/** One listing's logged activity, newest first — the timeline on the listing page. */
export async function getActivitiesForListing(listingId: string | null | undefined): Promise<Activity[]> {
  if (!listingId) return [];
  const all = await getActivityFeed(500);
  return all.filter((a) => a.related_listing_id === listingId);
}

/** One lead's logged activity, newest first. */
export async function getActivitiesForLead(leadId: string | null | undefined): Promise<Activity[]> {
  if (!leadId) return [];
  const all = await getActivityFeed(500);
  return all.filter((a) => a.related_lead_id === leadId);
}

/**
 * One lead's timeline: what was done to it, and what was changed on it.
 *
 * Asks the database for THIS lead's rows rather than pulling the last 500 activities
 * company-wide and filtering in memory the way getActivitiesForLead above does — that
 * one cannot see past the 500th row, so a lead worked on last month would silently show
 * an empty log.
 *
 * The audit half is permission-gated by RLS (roles.manage). A refusal comes back as zero
 * rows, which is why `auditReadable` is reported separately: "no changes recorded" and
 * "you may not see the changes" must not render as the same thing.
 */
export async function getLeadTimeline(
  leadId: string
): Promise<{ activities: LeadActivityRow[]; audits: LeadAuditRow[]; auditReadable: boolean }> {
  const supabase = await createClient();

  /* Identity is fetched ALONGSIDE the rows, not before them.
     `auth` used to be awaited first, so both queries sat waiting on a permission check they
     did not need to be issued — one whole round trip of dead time on the most-opened screen
     in the app.

     The audit query is therefore fired for everyone, and RLS decides: without roles.manage
     it comes back empty. That is one extra indexed lookup for the six agents who cannot read
     it, running in parallel with work they were waiting for anyway — cheaper than the wait it
     replaces. `auditReadable` still comes from the permission, never from the row count, so
     "nothing changed" and "you may not see the changes" stay different answers. */
  const [auth, act, aud] = await Promise.all([
    getAuthContext(),
    supabase
      .from("activities")
      .select("id,employee_code,action,activity_date,count,remark")
      .eq("related_lead_id", leadId)
      .order("activity_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("audit_log")
      .select("id,action,changed_by,created_at,before,after")
      .eq("entity", "main_6_buyer_crm")
      .eq("entity_id", leadId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const auditReadable = !!auth?.permissions.includes("roles.manage");

  return {
    activities: (act.data ?? []) as LeadActivityRow[],
    // Belt and braces: RLS already returns nothing without the permission, but the flag is
    // what the UI trusts, so the rows are dropped on the same condition.
    audits: auditReadable ? ((aud.data ?? []) as LeadAuditRow[]) : [],
    auditReadable,
  };
}

/** A buyer whose lead points at a listing — the ผู้สนใจ card. */
export interface InterestedLead {
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  pipeline_stage: string | null;
  lead_status: string | null;
  potential: string | null;
  budget: number | null;
  sale_id: string | null;
  date_received: string | null;
  last_follow_date: string | null;
}

/**
 * Who is interested in this unit — the reverse of the lead page's ทรัพย์ที่สนใจ link.
 *
 * The `listing_code` join has existed since the sheet import and had never been read from
 * this direction: 977 leads point at a listing, across 251 of them, and the only way to see
 * them was to search the leads grid by hand. It is the question that gets asked the moment
 * an owner drops their price.
 *
 * ⚠️ RLS-SCOPED, and that is not a bug. An agent without `leads.view_all` sees only their
 * own leads here, so this is "who that YOU can see is interested", not a company total. The
 * card must never present the count as the whole picture — a listing with 8 interested
 * buyers showing 2 to the agent who owns it would otherwise read as a quiet listing.
 */
export async function getInterestedLeads(listingCode: string): Promise<InterestedLead[]> {
  const supabase = await createClient();

  // Reads lead_listing_interest, not main_6_buyer_crm.listing_code: a buyer may be shopping
  // several units and the column holds only the one the deal is about. The embedded select
  // is a single round trip, and RLS on both tables still applies (the interest row is
  // visible only with its lead, and the lead only under the leads policy).
  const { data } = await supabase
    .from("lead_listing_interest")
    .select(
      "lead:main_6_buyer_crm(lead_id,lead_name,phone,pipeline_stage,lead_status,potential,budget,sale_id,date_received,last_follow_date)"
    )
    .eq("listing_id", listingCode)
    .limit(300);

  const rows = ((data ?? []) as unknown as { lead: InterestedLead | null }[])
    .map((r) => r.lead)
    .filter((l): l is InterestedLead => !!l);

  // Newest enquiry first — the most recent person to ask is the most likely to still care.
  // Sorted here rather than in the query: the order is on the joined table, and asking
  // PostgREST to order by an embedded column costs a second round trip to no benefit at
  // this size.
  return rows.sort((a, b) => (a.date_received ?? "") < (b.date_received ?? "") ? 1 : -1);
}

/** Every listing one lead is interested in — the ทรัพย์ที่สนใจ card on the lead drawer. */
export async function getLeadInterests(
  leadId: string
): Promise<{ listing_id: string; listing_name: string | null; asking_price: number | null; listing_status: string | null }[]> {
  const supabase = await createClient();

  /* Two levels of embed, one round trip: interest → listing → project.
     The unit's readable name lives on the project, not the listing — the same join
     v_main_listing does. This used to be a second query, fired only after the first came
     back because it needed the project ids from it. PostgREST will follow both foreign keys
     in one request, so the whole card costs what one row used to. */
  const { data } = await supabase
    .from("lead_listing_interest")
    .select(
      "listing_id, listing:main_4_listing_database(asking_price,listing_status,project:main_3_property_detail!main_4_listing_database_project_id_fkey(project_name_thai))"
    )
    .eq("lead_id", leadId)
    .order("created_at");

  const rows = (data ?? []) as unknown as {
    listing_id: string;
    listing: {
      asking_price: number | null;
      listing_status: string | null;
      project: { project_name_thai: string | null } | null;
    } | null;
  }[];

  return rows.map((r) => ({
    listing_id: r.listing_id,
    listing_name: r.listing?.project?.project_name_thai ?? null,
    asking_price: r.listing?.asking_price ?? null,
    listing_status: r.listing?.listing_status ?? null,
  }));
}

/**
 * One listing's timeline — the owner-side twin of getLeadTimeline.
 *
 * This is what merged กิจกรรมล่าสุด and ประวัติการแก้ไข into one card. They were two
 * cards showing two halves of the same question ("what has happened to this listing?"),
 * and one of them was a "เร็ว ๆ นี้" placeholder that had never been wired to anything.
 */
export async function getListingTimeline(
  listingId: string
): Promise<{ activities: LeadActivityRow[]; audits: LeadAuditRow[]; auditReadable: boolean }> {
  const supabase = await createClient();

  // Identity fetched alongside the rows, not before them — see getLeadTimeline above for why
  // the audit query is now issued for everyone and RLS is left to decide.
  const [auth, act, aud] = await Promise.all([
    getAuthContext(),
    supabase
      .from("activities")
      .select("id,employee_code,action,activity_date,count,remark")
      .eq("related_listing_id", listingId)
      .order("activity_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("audit_log")
      .select("id,action,changed_by,created_at,before,after")
      .eq("entity", "main_4_listing_database")
      .eq("entity_id", listingId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const auditReadable = !!auth?.permissions.includes("roles.manage");

  return {
    activities: (act.data ?? []) as LeadActivityRow[],
    audits: auditReadable ? ((aud.data ?? []) as LeadAuditRow[]) : [],
    auditReadable,
  };
}

/** One listing's photos, cover first. */
export async function getListingPhotos(listingId: string): Promise<
  { photo_id: number; photo_url: string; sort_order: number | null }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_8_listing_photo")
    .select("photo_id,photo_url,sort_order")
    .eq("listing_id", listingId)
    .order("sort_order")
    .order("photo_id");
  return (data ?? []) as { photo_id: number; photo_url: string; sort_order: number | null }[];
}

/**
 * Cover photo per listing, for the list views.
 *
 * One query for the whole page rather than one per row: the browser renders up to 511
 * rows and a per-row lookup would be 511 round trips.
 */
export async function getListingCovers(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_8_listing_photo")
    .select("listing_id,photo_url,sort_order")
    .order("sort_order")
    .order("photo_id");
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { listing_id: string; photo_url: string }[]) {
    // First row wins — the query is already ordered, so that is the cover.
    if (!out[r.listing_id]) out[r.listing_id] = r.photo_url;
  }
  return out;
}

// ── People / ทีม (Phase 6) ───────────────────────────────────────────────────

/**
 * The whole roster, from `main_1_hr` — plus zones, role names and this month's logged
 * activity.
 *
 * Three things worth knowing before reading the numbers:
 *
 * 1. **SELECT on main_1_hr is `using (true)`** — every signed-in person sees every row.
 *    That is deliberate: the sensitive columns are cut at the GRANT level instead, so the
 *    roster is public while pay and PII are not.
 * 2. **Salary/commission/PII come from `v_employee_private`**, which nulls each column the
 *    viewer lacks permission for. Selecting them from the base table returns 42501.
 * 3. **`activities` is own-row unless you hold `performance.view_team`** — and even then
 *    only for `visible_employee_codes()`, which is "yourself" for everyone while `teams`
 *    is empty. So effort is reported as `null` (→ "—") for anyone the viewer cannot see.
 *    Summing the RLS-filtered rows and printing 0 would claim a colleague did nothing.
 */
export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const monthStart = todayISO().slice(0, 7) + "-01";
  const nextMonth = (() => {
    const [y, m] = monthStart.split("-").map(Number);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  })();

  const [hr, zoneLinks, zones, roleLinks, roles, priv, acts, visible, teams] = await Promise.all([
    supabase
      .from("main_1_hr")
      .select(
        "employee_code,status,division,position,second_position,first_name_en,last_name_en," +
          "first_name_th,last_name_th,nickname,gender,nationality,phone,additional_phone," +
          "email,work_email,line_userid,birthday,date_started,emergency_contact," +
          "emergency_contact_phone,emergency_contact_relationship,remark,sales_sheet_url,team_id," +
          "probation_start,probation_passed_at"
      )
      .order("employee_code"),
    supabase.from("zone_sales").select("zone_id,employee_code"),
    supabase.from("zone").select("zone_id,name_thai"),
    supabase.from("user_roles").select("employee_code,role_id"),
    supabase.from("roles").select("id,name"),
    supabase
      .from("v_employee_private")
      .select("employee_code,salary,commission,id_card_no,kbank_account,payslip_drive,agreement_files"),
    supabase
      .from("activities")
      .select("employee_code,count")
      .gte("activity_date", monthStart)
      .lt("activity_date", nextMonth),
    supabase.rpc("visible_employee_codes"),
    supabase.from("teams").select("id,name,leader_code"),
  ]);

  if (hr.error) throw new Error(`อ่านข้อมูลพนักงานไม่สำเร็จ: ${hr.error.message}`);

  const zoneName = new Map(
    ((zones.data ?? []) as { zone_id: string; name_thai: string | null }[]).map((z) => [
      z.zone_id,
      z.name_thai ?? z.zone_id,
    ])
  );
  const roleName = new Map(
    ((roles.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])
  );
  const teamById = new Map(
    ((teams.data ?? []) as { id: string; name: string; leader_code: string | null }[]).map((t) => [
      t.id,
      t,
    ])
  );

  const byCode = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return m;
  };

  const zonesOf = byCode(
    (zoneLinks.data ?? []) as { zone_id: string; employee_code: string }[],
    (r) => r.employee_code
  );
  const rolesOf = byCode(
    (roleLinks.data ?? []) as { employee_code: string; role_id: string }[],
    (r) => r.employee_code
  );
  const privOf = new Map(
    ((priv.data ?? []) as Record<string, unknown>[]).map((p) => [p.employee_code as string, p])
  );

  // Own row is always visible even without the permission, hence the union.
  const me = (await getAuthContext())?.employeeCode ?? null;
  const visibleCodes = new Set<string>([
    ...(((visible.data ?? []) as (string | { visible_employee_codes: string })[]).map((v) =>
      typeof v === "string" ? v : v.visible_employee_codes
    ) ?? []),
    ...(me ? [me] : []),
  ]);

  const effort = new Map<string, number>();
  for (const a of (acts.data ?? []) as { employee_code: string; count: number | null }[]) {
    effort.set(a.employee_code, (effort.get(a.employee_code) ?? 0) + (a.count ?? 0));
  }

  return ((hr.data ?? []) as unknown as Record<string, string | null>[]).map((e) => {
    const code = e.employee_code as string;
    const zoneCodes = (zonesOf.get(code) ?? []).map((z) => z.zone_id);
    const p = privOf.get(code);
    const commission = p?.commission == null ? null : Number(p.commission);
    const team = e.team_id ? teamById.get(e.team_id) : undefined;
    return {
      code,
      teamName: team?.name,
      isTeamLeader: team ? team.leader_code === code : undefined,
      status: asEmployeeStatus(e.status),
      division: e.division ?? undefined,
      position: e.position ?? "",
      department: departmentOf(e.position, e.second_position),
      zoneCodes,
      zoneNames: zoneCodes.map((z) => zoneName.get(z) ?? z),
      roleNames: (rolesOf.get(code) ?? []).map((r) => roleName.get(r.role_id) ?? r.role_id),
      firstNameEn: e.first_name_en ?? undefined,
      lastNameEn: e.last_name_en ?? undefined,
      firstNameTh: e.first_name_th ?? undefined,
      lastNameTh: e.last_name_th ?? undefined,
      nickname: e.nickname ?? code,
      gender: asGender(e.gender),
      nationality: e.nationality ?? undefined,
      phone: e.phone ?? undefined,
      phoneAlt: e.additional_phone ?? undefined,
      email: e.email ?? undefined,
      workEmail: e.work_email ?? undefined,
      lineUserId: e.line_userid ?? undefined,
      birthday: e.birthday ?? undefined,
      startDate: e.date_started ?? undefined,
      probationStart: e.probation_start ?? undefined,
      probationPassedAt: e.probation_passed_at ?? undefined,
      emergencyContact: e.emergency_contact ?? undefined,
      emergencyPhone: e.emergency_contact_phone ?? undefined,
      emergencyRelation: e.emergency_contact_relationship ?? undefined,
      remark: e.remark ?? undefined,
      salesSheetUrl: e.sales_sheet_url ?? undefined,
      effortThisMonth: visibleCodes.has(code) ? effort.get(code) ?? 0 : null,
      // numeric arrives as a string over PostgREST.
      salary: p?.salary == null ? null : Number(p.salary),
      commissionRate: commission,
      idCardNo: (p?.id_card_no as string | null) ?? null,
      bankAccount: (p?.kbank_account as string | null) ?? null,
      payslipDriveUrl: (p?.payslip_drive as string | null) ?? null,
      agreementFilesUrl: (p?.agreement_files as string | null) ?? null,
    } satisfies Employee;
  });
}

/**
 * Sales teams and their members (ตั้งค่า → ทีมขาย).
 *
 * Membership is `main_1_hr.team_id`, not a join table — one team per person, which is what
 * `visible_employee_codes()` assumes when it resolves "team" scope.
 */
export async function getTeams(): Promise<
  { id: string; name: string; leaderCode: string | null; revenueGoal: number | null; memberCodes: string[] }[]
> {
  const supabase = await createClient();
  const [teams, members] = await Promise.all([
    supabase.from("teams").select("id,name,leader_code,revenue_goal,sort_order").order("sort_order"),
    supabase.from("main_1_hr").select("employee_code,team_id").not("team_id", "is", null),
  ]);
  if (teams.error) throw new Error(`อ่านข้อมูลทีมไม่สำเร็จ: ${teams.error.message}`);

  const byTeam = new Map<string, string[]>();
  for (const m of (members.data ?? []) as { employee_code: string; team_id: string }[]) {
    byTeam.set(m.team_id, [...(byTeam.get(m.team_id) ?? []), m.employee_code]);
  }
  return ((teams.data ?? []) as {
    id: string;
    name: string;
    leader_code: string | null;
    revenue_goal: number | null;
  }[]).map((t) => ({
    id: t.id,
    name: t.name,
    leaderCode: t.leader_code,
    // numeric arrives as a string over PostgREST.
    revenueGoal: t.revenue_goal == null ? null : Number(t.revenue_goal),
    memberCodes: byTeam.get(t.id) ?? [],
  }));
}

// ── RBAC (ตั้งค่า → บทบาท & สิทธิ์) ──────────────────────────────────────────

export interface RbacRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  /** System roles (CEO, ผู้ดูแลระบบ) cannot be renamed, deleted or re-permissioned. */
  system: boolean;
  /** Employee codes holding it. */
  members: string[];
}

export interface RbacConfig {
  roles: RbacRole[];
  /** Permission catalogue from the `permissions` table, grouped for display. */
  groups: { key: string; label: string; perms: { key: string; label: string; hint?: string }[] }[];
  /** Everyone who can be given a role. */
  people: { code: string; nickname: string; roleIds: string[] }[];
}

/**
 * The whole role/permission picture in one read.
 *
 * ⚠️ `user_roles` SELECT is own-row unless the viewer holds `roles.manage`/`people.manage`,
 * so for anyone else this comes back with only their own assignment. The screen is gated on
 * `roles.manage` anyway, but do not reuse this elsewhere expecting a full list.
 */
export async function getRbacConfig(): Promise<RbacConfig> {
  const supabase = await createClient();
  const [roles, perms, grants, assignments, staff] = await Promise.all([
    supabase.from("roles").select("id,name,description,is_system,sort_order").order("sort_order"),
    supabase
      .from("permissions")
      .select("key,group_key,group_label,label,hint,sort_order")
      .order("sort_order"),
    supabase.from("role_permissions").select("role_id,permission_key"),
    supabase.from("user_roles").select("employee_code,role_id"),
    getStaffDirectory(),
  ]);
  if (roles.error) throw new Error(`อ่านข้อมูลบทบาทไม่สำเร็จ: ${roles.error.message}`);

  const permsOf = new Map<string, string[]>();
  for (const g of (grants.data ?? []) as { role_id: string; permission_key: string }[]) {
    permsOf.set(g.role_id, [...(permsOf.get(g.role_id) ?? []), g.permission_key]);
  }
  const membersOf = new Map<string, string[]>();
  const rolesOf = new Map<string, string[]>();
  for (const a of (assignments.data ?? []) as { employee_code: string; role_id: string }[]) {
    membersOf.set(a.role_id, [...(membersOf.get(a.role_id) ?? []), a.employee_code]);
    rolesOf.set(a.employee_code, [...(rolesOf.get(a.employee_code) ?? []), a.role_id]);
  }

  const groups: RbacConfig["groups"] = [];
  for (const p of (perms.data ?? []) as {
    key: string;
    group_key: string;
    group_label: string | null;
    label: string | null;
    hint: string | null;
  }[]) {
    let g = groups.find((x) => x.key === p.group_key);
    if (!g) {
      g = { key: p.group_key, label: p.group_label ?? p.group_key, perms: [] };
      groups.push(g);
    }
    g.perms.push({ key: p.key, label: p.label ?? p.key, hint: p.hint ?? undefined });
  }

  return {
    roles: ((roles.data ?? []) as {
      id: string;
      name: string;
      description: string | null;
      is_system: boolean | null;
    }[]).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      permissions: permsOf.get(r.id) ?? [],
      system: !!r.is_system,
      members: membersOf.get(r.id) ?? [],
    })),
    groups,
    people: staff.map((s) => ({
      code: s.code,
      nickname: s.nickname,
      roleIds: rolesOf.get(s.code) ?? [],
    })),
  };
}

/** property_type name → its listing-id letter, for ตั้งค่า → ประเภททรัพย์. */
export async function getPropertyTypeCodes(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("property_type").select("name,code");
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { name: string; code: string | null }[]) {
    if (r.code) out[r.name] = r.code;
  }
  return out;
}

/** Zone picker options, from the `zone` master (30 rows). */
export async function getZoneOptions(): Promise<{ code: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("zone").select("zone_id,name_thai").order("zone_id");
  return ((data ?? []) as { zone_id: string; name_thai: string | null }[]).map((z) => ({
    code: z.zone_id,
    name: z.name_thai ?? z.zone_id,
  }));
}

/**
 * Zones with every agent covering them, plus a live listing count.
 *
 * A zone has MANY agents (`zone_sales`), which is the whole reason `zone.sale_id_assigned`
 * was dropped: พระราม 3 is covered by Mhow and Pup together. `is_primary` marks the one
 * เจ้าภาพ used as the fallback owner in `zone_primary_sale()`.
 */
export async function getZones(): Promise<Zone[]> {
  const supabase = await createClient();
  const [zones, links, staff, listings] = await Promise.all([
    supabase.from("zone").select("zone_id,name_thai,name_eng").order("zone_id"),
    supabase.from("zone_sales").select("zone_id,employee_code,is_primary"),
    getStaffDirectory(),
    supabase.from("main_4_listing_database").select("zone"),
  ]);
  if (zones.error) throw new Error(`อ่านข้อมูลโซนไม่สำเร็จ: ${zones.error.message}`);

  const nickname = new Map(staff.map((s) => [s.code, s.nickname]));
  const count = new Map<string, number>();
  for (const l of (listings.data ?? []) as { zone: string | null }[]) {
    if (l.zone) count.set(l.zone, (count.get(l.zone) ?? 0) + 1);
  }
  const salesOf = new Map<string, ZoneSale[]>();
  for (const l of (links.data ?? []) as {
    zone_id: string;
    employee_code: string;
    is_primary: boolean | null;
  }[]) {
    const arr = salesOf.get(l.zone_id) ?? [];
    arr.push({
      code: l.employee_code,
      nickname: nickname.get(l.employee_code) ?? l.employee_code,
      isPrimary: !!l.is_primary,
    });
    salesOf.set(l.zone_id, arr);
  }

  return ((zones.data ?? []) as {
    zone_id: string;
    name_thai: string | null;
    name_eng: string | null;
  }[]).map((z) => ({
    zone_id: z.zone_id,
    name_thai: z.name_thai ?? z.zone_id,
    name_eng: z.name_eng ?? "",
    // เจ้าภาพ first, then by nickname.
    sales: (salesOf.get(z.zone_id) ?? []).sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.nickname.localeCompare(b.nickname)
    ),
    listingCount: count.get(z.zone_id) ?? 0,
  }));
}

// ── เซลล์ใหม่ / probation (Phase 8 groundwork) ───────────────────────────────

/**
 * The governed activity vocabulary (`action_type`), for anything that has to produce an
 * FK-valid action name.
 *
 * ⚠️ Not `ACTION_GROUPS` in lib/actions — that seed is missing three rows that exist in the
 * table (Owner Talk, Update Price, เซ็นสัญญา), and Owner Talk is the first KPI the company
 * ever defined. The same trap already bit the task form in Phase 5.
 */
export async function getActionTypes(): Promise<
  { name: string; group: string; attach: AttachMode }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_type")
    .select("name,group_label,attach,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return ((data ?? []) as {
    name: string;
    group_label: string | null;
    attach: string | null;
  }[]).map((a) => ({
    name: a.name,
    group: a.group_label ?? "อื่นๆ",
    attach: (["lead", "listing", "either", "none"] as AttachMode[]).find((m) => m === a.attach) ??
      "either",
  }));
}

/** Logged activities per action name — the impact line on the delete confirm in
 *  ตั้งค่า → ประเภทกิจกรรม. ⚠️ RLS-scoped: an agent counts only their own rows, so this is
 *  a floor, not a total. The real refusal happens server-side in deleteLookupValue. */
export async function getActionUsage(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("activities").select("action");
  const out: Record<string, number> = {};
  for (const a of (data ?? []) as { action: string }[]) {
    out[a.action] = (out[a.action] ?? 0) + 1;
  }
  return out;
}

/** Roles, id + display name — for the checklist's responsibility chips and dropdown. */
export async function getRoleOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id, name").order("sort_order");
  if (error) throw new Error(`getRoleOptions: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}

/** Value-add checklist definitions — `checklist_template` + its items. */
export async function getChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_template")
    .select(
      "id, name, applies_to, sort, checklist_template_item(id, label, item_type, role, repeat_days, sort)"
    )
    .order("sort");
  if (error) throw new Error(`getChecklistTemplates: ${error.message}`);
  return ((data ?? []) as ChecklistTemplateRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    appliesTo: (t.applies_to ?? []) as FocusTier[],
    // The nested select does not honour the child's `order`, so sort here.
    items: [...(t.checklist_template_item ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((i) => ({
        id: i.id,
        label: i.label,
        type: i.item_type,
        role: i.role,
        repeatDays: i.repeat_days ?? undefined,
      })),
  }));
}

/** One listing's checklist progress, keyed by template_item_id. */
export async function getListingChecklistProgress(listingId: string): Promise<ProgressMap> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_checklist_item")
    .select("template_item_id, completed_at, completed_by, due_date, url, note")
    .eq("listing_id", listingId);
  if (error) throw new Error(`getListingChecklistProgress: ${error.message}`);
  const out: ProgressMap = {};
  for (const r of (data ?? []) as ProgressRow[]) {
    out[r.template_item_id] = {
      completedAt: r.completed_at,
      completedBy: r.completed_by,
      dueDate: r.due_date,
      url: r.url,
      note: r.note,
    };
  }
  return out;
}

/** KPI presets a leader picks from when setting targets — `kpi_template`. */
export async function getKpiTemplates(): Promise<KpiTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_template")
    .select("id, label, kind, source, activity_type, default_target")
    .order("sort");
  if (error) throw new Error(`getKpiTemplates: ${error.message}`);
  return ((data ?? []) as KpiRow[]).map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    source: r.source,
    activityType: r.activity_type ?? undefined,
    defaultTarget: Number(r.default_target),
  }));
}

/**
 * Ad-copy overrides — `listing_copy_template`.
 *
 * Only combos somebody has edited are stored, so this map is usually partial (and empty on a
 * fresh install). The caller layers it over defaultTemplateMap(); the code default keeps
 * covering everything else.
 */
export async function getCopyTemplateOverrides(): Promise<Record<string, CopyTemplate>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_copy_template")
    .select("grade, copy_type, headline, normal_body, dd_body");
  if (error) throw new Error(`getCopyTemplateOverrides: ${error.message}`);
  const out: Record<string, CopyTemplate> = {};
  for (const r of (data ?? []) as CopyRow[]) {
    out[comboKey(r.grade, r.copy_type)] = {
      headline: r.headline,
      normalBody: r.normal_body,
      ddBody: r.dd_body,
    };
  }
  return out;
}

/** The CEO's ladder, from `probation_rank` + `rank_criterion`. */
export async function getSalesRanks(): Promise<SalesRank[]> {
  const supabase = await createClient();
  const [ranks, criteria] = await Promise.all([
    supabase.from("probation_rank").select("id,name,sort_order").order("sort_order"),
    supabase
      .from("rank_criterion")
      .select("id,rank_id,activity_type,target,count_window,sort_order")
      .order("sort_order"),
  ]);
  if (ranks.error) throw new Error(`อ่านเกณฑ์ Rank ไม่สำเร็จ: ${ranks.error.message}`);

  const byRank = new Map<string, RankCriterion[]>();
  for (const c of (criteria.data ?? []) as {
    id: string;
    rank_id: string;
    activity_type: string;
    target: number;
    count_window: string;
  }[]) {
    const arr = byRank.get(c.rank_id) ?? [];
    arr.push({
      id: c.id,
      activityType: c.activity_type,
      target: c.target,
      window: c.count_window === "monthly" ? "monthly" : "total",
    });
    byRank.set(c.rank_id, arr);
  }
  return ((ranks.data ?? []) as { id: string; name: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
    criteria: byRank.get(r.id) ?? [],
  }));
}

/**
 * Activity tallies per agent for the probation board.
 *
 * `total` counts from each agent's own `probation_start`, so two people who joined the
 * programme at different times are each measured from their own day one. `monthly` is the
 * current calendar month for everyone.
 *
 * ⚠️ Same RLS ceiling as everywhere else: `activities` is own-row unless the viewer holds
 * `performance.view_team`, and `visible_employee_codes()` is "just me" while `teams` is
 * empty. An agent therefore sees real numbers for themselves and zeroes for everyone else.
 * The board is CEO/leader-facing (nav gate: performance.view_team), so it is not filtered
 * again here — but do not reuse this for a per-agent screen without checking that.
 */
export async function getProbationTallies(
  members: { code: string; probationStart?: string }[]
): Promise<Record<string, ActivityTally>> {
  const out: Record<string, ActivityTally> = {};
  for (const m of members) out[m.code] = { total: {}, monthly: {} };
  if (!members.length) return out;

  const supabase = await createClient();
  // One query for everyone: earliest start bounds it, then each row is attributed to the
  // agent it belongs to only if it falls on or after THAT agent's start.
  const earliest = members
    .map((m) => m.probationStart)
    .filter((d): d is string => !!d)
    .sort()[0];
  const monthStart = todayISO().slice(0, 7) + "-01";

  const { data, error } = await supabase
    .from("activities")
    .select("employee_code,action,activity_date,count")
    .in("employee_code", members.map((m) => m.code))
    .gte("activity_date", earliest ?? "1900-01-01");
  if (error) throw new Error(`อ่านกิจกรรมไม่สำเร็จ: ${error.message}`);

  const startOf = new Map(members.map((m) => [m.code, m.probationStart]));
  for (const a of (data ?? []) as {
    employee_code: string;
    action: string;
    activity_date: string;
    count: number | null;
  }[]) {
    const t = out[a.employee_code];
    if (!t) continue;
    const n = a.count ?? 0;
    const start = startOf.get(a.employee_code);
    if (!start || a.activity_date >= start) {
      t.total[a.action] = (t.total[a.action] ?? 0) + n;
    }
    if (a.activity_date >= monthStart) {
      t.monthly[a.action] = (t.monthly[a.action] ?? 0) + n;
    }
  }
  return out;
}

/** Recent activity rows for one agent — the log on their probation detail page. */
export async function getAgentActivities(
  code: string,
  limit = 40
): Promise<{ date: string; action: string; count: number; remark: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("activity_date,action,count,remark")
    .eq("employee_code", code)
    .order("activity_date", { ascending: false })
    .limit(limit);
  return ((data ?? []) as {
    activity_date: string;
    action: string;
    count: number | null;
    remark: string | null;
  }[]).map((a) => ({
    date: a.activity_date,
    action: a.action,
    count: a.count ?? 0,
    remark: a.remark,
  }));
}

export async function getEmployee(code: string): Promise<Employee | null> {
  const all = await getEmployees();
  return all.find((e) => e.code === code) ?? null;
}

// ── Leave (Phase 6) ──────────────────────────────────────────────────────────

/**
 * Every leave request the viewer may see.
 *
 * RLS on `leave_requests` already splits own vs. all on `leave.manage`, so this is not
 * re-filtered here — but LeaveBoard still checks the permission to decide whether to show
 * the HR queue and the approve/reject buttons.
 */
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const [{ data, error }, staff] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(
        "id,employee_code,submitted_at,start_date,end_date,type,remark,status,decided_by,decided_at"
      )
      .order("start_date", { ascending: false }),
    getStaffDirectory(),
  ]);
  if (error) throw new Error(`อ่านข้อมูลวันลาไม่สำเร็จ: ${error.message}`);

  const nickname = new Map(staff.map((s) => [s.code, s.nickname]));
  return ((data ?? []) as {
    id: number;
    employee_code: string;
    submitted_at: string | null;
    start_date: string;
    end_date: string;
    type: string;
    remark: string | null;
    status: string;
    decided_by: string | null;
    decided_at: string | null;
  }[]).map((r) => ({
    id: r.id,
    employeeId: r.employee_code,
    nickname: nickname.get(r.employee_code) ?? r.employee_code,
    // `submitted_at` is a timestamptz; the UI only ever shows the day.
    submittedAt: (r.submitted_at ?? r.start_date).slice(0, 10),
    startDate: r.start_date,
    endDate: r.end_date,
    type: r.type,
    remark: r.remark,
    status: (["pending", "approved", "rejected"] as LeaveStatus[]).find((s) => s === r.status) ??
      "pending",
    decidedBy: r.decided_by ? nickname.get(r.decided_by) ?? r.decided_by : undefined,
    decidedAt: r.decided_at ? r.decided_at.slice(0, 10) : undefined,
  }));
}

/** Annual quota per leave type. Falls back to the statutory placeholders when the table
 *  is empty, so the balance panel never reads as "no quota at all". */
export async function getLeaveAllowances(): Promise<LeaveAllowance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_allowances")
    .select("type,days_per_year,note");
  const rows = (data ?? []) as { type: string; days_per_year: number | null; note: string | null }[];
  if (!rows.length) return DEFAULT_LEAVE_ALLOWANCES;

  // Keep the display order the app has always used rather than whatever the table returns.
  const order = DEFAULT_LEAVE_ALLOWANCES.map((a) => a.type);
  return rows
    .map((r) => ({ type: r.type, daysPerYear: r.days_per_year, note: r.note ?? undefined }))
    .sort((a, b) => {
      const ia = order.indexOf(a.type);
      const ib = order.indexOf(b.type);
      return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
    });
}

// ── Contacts (Phase 6) ───────────────────────────────────────────────────────
//
// Assembled live from `main_2_owner` + `main_6_buyer_crm`, merged on phone number. See the
// header of lib/contacts.ts for why there is no `contacts` table behind this.
//
// Both source tables are RLS-scoped already, so this returns exactly the people the viewer
// is allowed to know about — an agent gets their own owners and their own leads.

type OwnerRow = {
  owner_id: number;
  owner_name: string | null;
  owner_phone: string | null;
  owner_line: string | null;
  remark: string | null;
};

type LeadPersonRow = {
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  line_id: string | null;
  lead_type: string | null;
  budget: number | string | null;
  pipeline_stage: string | null;
  sale_id: string | null;
  listing_code: string | null;
  interested: string | null;
  interest_zone: string | null;
  interest_property_type: string | null;
  /** The lead table's note column is `admin_remark`, NOT `remark` — asking for the wrong
   *  name makes PostgREST fail the whole select, which `?? []` then turns into "this agent
   *  has no leads". That is how this shipped 0 buyers on the first run. */
  admin_remark: string | null;
};

type OwnedListingRow = {
  listing_id: string;
  listing_name: string | null;
  owner_id: number | null;
  asking_price: number | string | null;
  rental_price: number | string | null;
  effective_sale_id: string | null;
};

/** Everyone the viewer may see, keyed by the synthetic contact id. */
async function loadPeople(): Promise<Map<string, Contact>> {
  const supabase = await createClient();
  const [owners, leads, listings, staff] = await Promise.all([
    supabase.from("main_2_owner").select("owner_id,owner_name,owner_phone,owner_line,remark"),
    supabase
      .from("main_6_buyer_crm")
      .select(
        "lead_id,lead_name,phone,line_id,lead_type,budget,pipeline_stage,sale_id,listing_code,interested,interest_zone,interest_property_type,admin_remark"
      ),
    supabase
      .from("v_main_listing")
      .select("listing_id,listing_name,owner_id,asking_price,rental_price,effective_sale_id"),
    getStaffDirectory(),
  ]);

  // Fail loudly. A half-built directory is worse than none: an agent who sees only their
  // owners has no way to tell that the buyer half of the page silently errored out.
  const failure = owners.error ?? leads.error ?? listings.error;
  if (failure) throw new Error(`อ่านข้อมูลผู้ติดต่อไม่สำเร็จ: ${failure.message}`);

  const nickname = new Map(staff.map((s) => [s.code, s.nickname]));

  // owner_id → their listings, for both the "ทรัพย์ที่เป็นเจ้าของ" panel and the
  // owner-vs-landlord distinction (a rent-only owner is a landlord).
  const byOwner = new Map<number, OwnedListingRow[]>();
  for (const l of (listings.data ?? []) as unknown as OwnedListingRow[]) {
    if (l.owner_id == null) continue;
    const arr = byOwner.get(l.owner_id);
    if (arr) arr.push(l);
    else byOwner.set(l.owner_id, [l]);
  }

  const people = new Map<string, Contact>();
  const touch = (id: string, name: string, phone: string | null, line: string | null): Contact => {
    const found = people.get(id);
    if (found) {
      // Keep the first non-empty value for each field rather than letting a blank
      // lead row wipe a phone that came from the owner side.
      if (!found.name && name) found.name = name;
      if (!found.phone && phone) found.phone = phone;
      if (!found.line && line) found.line = line;
      return found;
    }
    const created: Contact = {
      id, name, phone, line,
      roles: [], email: null, note: null, assignedTo: null, owned: [], demand: [],
    };
    people.set(id, created);
    return created;
  };
  const addRole = (c: Contact, r: ContactRole) => {
    if (!c.roles.includes(r)) c.roles.push(r);
  };

  for (const o of (owners.data ?? []) as OwnerRow[]) {
    const digits = normalizePhone(o.owner_phone);
    const c = touch(
      digits ? `p${digits}` : `o${o.owner_id}`,
      o.owner_name?.trim() || "ไม่ระบุชื่อ",
      o.owner_phone,
      o.owner_line
    );
    if (o.remark && !c.note) c.note = o.remark;

    const owned = byOwner.get(o.owner_id) ?? [];
    for (const l of owned) {
      const sale = numOrNull(l.asking_price);
      const rent = numOrNull(l.rental_price);
      // A listing can be both for sale and to let; show the sale figure as the headline.
      c.owned.push({
        listingId: l.listing_id,
        name: l.listing_name ?? l.listing_id,
        price: sale ?? rent ?? 0,
        deal: sale != null ? "sale" : "rent",
      });
      if (!c.assignedTo && l.effective_sale_id) {
        c.assignedTo = nickname.get(l.effective_sale_id) ?? l.effective_sale_id;
      }
    }
    // Someone who only ever lets property is a landlord, not a seller.
    const hasSale = owned.some((l) => numOrNull(l.asking_price) != null);
    const hasRent = owned.some((l) => numOrNull(l.rental_price) != null);
    if (hasSale || !hasRent) addRole(c, "owner");
    if (hasRent) addRole(c, "landlord");
  }

  for (const l of (leads.data ?? []) as LeadPersonRow[]) {
    const digits = normalizePhone(l.phone);
    const c = touch(
      digits ? `p${digits}` : `l${l.lead_id}`,
      l.lead_name?.trim() || "ไม่ระบุชื่อ",
      l.phone,
      l.line_id
    );
    addRole(c, roleForLeadType(l.lead_type));
    if (l.admin_remark && !c.note) c.note = l.admin_remark;
    if (!c.assignedTo && l.sale_id) c.assignedTo = nickname.get(l.sale_id) ?? l.sale_id;

    const stage = stageMeta(l.pipeline_stage);
    const wants = [l.interest_property_type, l.interest_zone].filter(Boolean).join(" · ");
    c.demand.push({
      leadId: l.lead_id,
      interest: wants || l.interested || l.listing_code || "ไม่ระบุความต้องการ",
      budget: numOrNull(l.budget),
      stageLabel: stage.label,
      stageDot: stage.dot,
      deal: l.lead_type === "Buyer - Rent" ? "rent" : "buy",
    });
  }

  return people;
}

/** The directory list — no listings/leads attached, so the payload stays small. */
export async function getContacts(): Promise<ContactSummary[]> {
  const people = await loadPeople();
  return [...people.values()]
    .map(({ id, name, roles, phone, line }) => ({ id, name, roles, phone, line }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function getContact(id: string): Promise<Contact | null> {
  const people = await loadPeople();
  return people.get(id) ?? null;
}

// ── Projects (Phase 6) ───────────────────────────────────────────────────────

type ProjectDbRow = {
  project_id: string;
  project_name_eng: string | null;
  project_name_thai: string | null;
  property_type: string | null;
  zone: string | null;
  total_units: number | null;
  phases: number | null;
  unit_types: string | null;
  material: string | null;
  floor_to_ceiling: string | null;
  project_age: string | null;
  facilities: string | null;
  common_fee: number | string | null;
  juristic: string | null;
  juristic_collect_pct: number | string | null;
  extra_parking_fee: number | string | null;
  rental_price_in_project: string | null;
  flooding: boolean | null;
  resident_occupation: string | null;
  project_sold_price: string | null;
  pros: string | null;
  cons: string | null;
  sales_id: string | null;
};

const PROJECT_COLUMNS = [
  "project_id", "project_name_eng", "project_name_thai", "property_type", "zone",
  "total_units", "phases", "unit_types", "material", "floor_to_ceiling", "project_age",
  "facilities", "common_fee", "juristic", "juristic_collect_pct", "extra_parking_fee",
  "rental_price_in_project", "flooding", "resident_occupation", "project_sold_price",
  "pros", "cons", "sales_id",
].join(",");

// `numeric` arrives as a string over PostgREST; Number() before formatting or "35" becomes
// NaN-adjacent nonsense downstream.
const numOrNull = (v: number | string | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const unit = (v: number | string | null, suffix: string): string | null => {
  const n = numOrNull(v);
  return n == null ? null : `${n.toLocaleString("en-US")} ${suffix}`;
};

function toProject(
  r: ProjectDbRow,
  zoneNames: Map<string, string>,
  saleNames: Map<string, string>
): Project {
  return {
    id: r.project_id,
    name_eng: r.project_name_eng ?? "",
    name_thai: r.project_name_thai ?? r.project_name_eng ?? r.project_id,
    property_type: r.property_type,
    zone: r.zone ? zoneNames.get(r.zone) ?? r.zone : null,
    units: r.total_units != null ? `${r.total_units.toLocaleString("en-US")} ยูนิต` : null,
    phases: r.phases != null ? `${r.phases} เฟส` : null,
    unit_types: r.unit_types,
    material: r.material,
    floor_to_ceiling: r.floor_to_ceiling,
    age: r.project_age,
    common_area: r.facilities,
    common_fee: unit(r.common_fee, "บาท"),
    juristic: r.juristic,
    fee_collection_rate: numOrNull(r.juristic_collect_pct) != null
      ? `${numOrNull(r.juristic_collect_pct)}%`
      : null,
    overflow_parking_fee: unit(r.extra_parking_fee, "บาท"),
    rental_range: r.rental_price_in_project,
    // A boolean column, but the UI renders free text — and "not recorded" must stay
    // distinguishable from "does not flood".
    flood: r.flooding == null ? null : r.flooding ? "เคยท่วม" : "ไม่ท่วม",
    resident_persona: r.resident_occupation,
    closing_price: r.project_sold_price,
    pros: r.pros,
    cons: r.cons,
    created_by: r.sales_id ? saleNames.get(r.sales_id) ?? r.sales_id : null,
  };
}

/** zone_id → Thai name, and employee_code → nickname. Both tables are tiny. */
async function nameMaps(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [zones, staff] = await Promise.all([
    supabase.from("zone").select("zone_id,name_thai"),
    supabase.from("main_1_hr").select("employee_code,nickname"),
  ]);
  return {
    zoneNames: new Map(
      ((zones.data ?? []) as { zone_id: string; name_thai: string | null }[])
        .filter((z) => z.name_thai)
        .map((z) => [z.zone_id, z.name_thai as string] as const)
    ),
    saleNames: new Map(
      ((staff.data ?? []) as { employee_code: string; nickname: string | null }[])
        .filter((s) => s.nickname)
        .map((s) => [s.employee_code, s.nickname as string] as const)
    ),
  };
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const [{ data }, maps] = await Promise.all([
    supabase
      .from("main_3_property_detail")
      .select(PROJECT_COLUMNS)
      // Zone first so the browser's filter chips come out in a stable order rather than
      // however the rows happened to arrive.
      .order("zone", { nullsFirst: false })
      .order("project_name_thai"),
    nameMaps(supabase),
  ]);
  return ((data ?? []) as unknown as ProjectDbRow[]).map((r) =>
    toProject(r, maps.zoneNames, maps.saleNames)
  );
}

export async function getProject(id: string | null | undefined): Promise<Project | null> {
  if (!id) return null;
  const supabase = await createClient();
  const [{ data }, maps] = await Promise.all([
    supabase.from("main_3_property_detail").select(PROJECT_COLUMNS).eq("project_id", id).maybeSingle(),
    nameMaps(supabase),
  ]);
  return data ? toProject(data as unknown as ProjectDbRow, maps.zoneNames, maps.saleNames) : null;
}

// ── Last Match (Phase 6) ─────────────────────────────────────────────────────

/**
 * The closed-deal ledger, already scoped by RLS to own → team → all.
 *
 * No client-side re-filtering follows this: the policy on `main_7_last_match` is the
 * enforcement, and the design build's browser-side scope filter compared seed user ids to
 * seed employee codes, which real sessions never matched.
 */
/**
 * 6 rows carry `1899-12-30` — Excel's serial-zero, i.e. the source sheet's date cell was
 * blank and the import wrote the epoch instead of nothing. "30/12/1899" on screen is worse
 * than an em-dash, so anything predating the company reads as not-recorded. The rows
 * themselves are untouched; cleaning them is a data decision, not a rendering one.
 */
const realDate = (d: string | null): string | null => (d && d >= "2000-01-01" ? d : null);

export async function getLastMatches(): Promise<LastMatch[]> {
  const supabase = await createClient();
  const [{ data }, maps] = await Promise.all([
    supabase
      .from("main_7_last_match")
      .select(
        "last_match_id,sale_id,close_type,project_name,property_type,zone,sq_wa,sq_m,bed,bath,last_match_price,last_match_remark,buyer_persona,date_created"
      )
      .order("date_created", { ascending: false, nullsFirst: false }),
    nameMaps(supabase),
  ]);

  return ((data ?? []) as {
    last_match_id: string;
    sale_id: string | null;
    close_type: string | null;
    project_name: string | null;
    property_type: string | null;
    zone: string | null;
    sq_wa: number | string | null;
    sq_m: number | string | null;
    bed: number | null;
    bath: number | string | null;
    last_match_price: number | string | null;
    last_match_remark: string | null;
    buyer_persona: string | null;
    date_created: string | null;
  }[]).map((r) => ({
    last_match_id: r.last_match_id,
    sale_id: r.sale_id,
    sale_name: r.sale_id ? maps.saleNames.get(r.sale_id) ?? r.sale_id : null,
    close_type: (r.close_type as LastMatch["close_type"]) ?? null,
    project_name: r.project_name,
    property_type: r.property_type,
    zone: r.zone,
    zone_name_thai: r.zone ? maps.zoneNames.get(r.zone) ?? null : null,
    sq_wa: numOrNull(r.sq_wa),
    sq_m: numOrNull(r.sq_m),
    bed: r.bed,
    bath: numOrNull(r.bath),
    last_match_price: numOrNull(r.last_match_price),
    last_match_remark: r.last_match_remark,
    buyer_persona: r.buyer_persona,
    date_created: realDate(r.date_created),
  }));
}
