"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { navItemFor } from "@/lib/nav";

// Server-side lookups. Server actions rather than shipping tables to the client: there are
// 511 listings and thousands of leads, and every picker here shows at most a handful.
//
// Two audiences share one set of queries:
//   · the pickers (intake form, task link) — `searchListings` / `searchLeads` /
//     `searchProjects`, which browse the first rows when the box is empty;
//   · the ⌘K palette — `searchAll`, which runs the same finders side by side and shows
//     nothing for an empty box, because "everything" is not a search result.
//
// `effective_sale_id` is what makes the assignment default work — it is the listing's own
// agent, falling back to the zone's primary agent. That mirrors the rule the rest of the app
// follows: the LISTING decides who handles the lead, not the zone.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** PostgREST's `or` filter is one comma-separated string, so a query containing its
    delimiters would split into extra clauses. Blank them rather than escape them. */
const safe = (q: string) => q.replace(/[(),]/g, " ");

/* ── Finders — raw rows, shared by the pickers and the palette ────────────────────── */

interface ListingRow {
  listing_id: string;
  listing_name: string | null;
  zone_name_thai: string | null;
  effective_sale_id: string | null;
}

async function findListings(supabase: Supabase, q: string, limit: number): Promise<ListingRow[]> {
  let req = supabase
    .from("v_main_listing")
    .select("listing_id,listing_name,zone_name_thai,effective_sale_id")
    .order("listing_id")
    .limit(limit);
  // Match either the code or the project name; PostgREST needs the OR as one filter string.
  if (q) req = req.or(`listing_id.ilike.%${safe(q)}%,listing_name.ilike.%${safe(q)}%`);
  const { data } = await req;
  return (data ?? []) as ListingRow[];
}

interface LeadRow {
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  listing_code: string | null;
}

async function findLeads(supabase: Supabase, q: string, limit: number): Promise<LeadRow[]> {
  let req = supabase
    .from("main_6_buyer_crm")
    .select("lead_id,lead_name,phone,listing_code")
    .order("lead_id", { ascending: false })
    .limit(limit);
  if (q) req = req.or(`lead_id.ilike.%${safe(q)}%,lead_name.ilike.%${safe(q)}%,phone.ilike.%${safe(q)}%`);
  const { data } = await req;
  return (data ?? []) as LeadRow[];
}

interface ProjectRow {
  project_id: string;
  project_name_thai: string | null;
  project_name_eng: string | null;
}

async function findProjects(supabase: Supabase, q: string, limit: number): Promise<ProjectRow[]> {
  let req = supabase
    .from("main_3_property_detail")
    .select("project_id,project_name_thai,project_name_eng")
    .order("project_name_thai")
    .limit(limit);
  // Sheet data put Thai names in the English column often enough that searching only one
  // would hide real projects — match either.
  if (q) req = req.or(`project_name_thai.ilike.%${safe(q)}%,project_name_eng.ilike.%${safe(q)}%`);
  const { data } = await req;
  return (data ?? []) as ProjectRow[];
}

interface PersonRow {
  employee_code: string;
  nickname: string | null;
  first_name_th: string | null;
  last_name_th: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  position: string | null;
}

async function findPeople(supabase: Supabase, q: string, limit: number): Promise<PersonRow[]> {
  const s = safe(q);
  const { data } = await supabase
    .from("main_1_hr")
    .select("employee_code,nickname,first_name_th,last_name_th,first_name_en,last_name_en,position")
    .or(
      `employee_code.ilike.%${s}%,nickname.ilike.%${s}%,first_name_th.ilike.%${s}%,` +
        `last_name_th.ilike.%${s}%,first_name_en.ilike.%${s}%,last_name_en.ilike.%${s}%`
    )
    .order("employee_code")
    .limit(limit);
  return (data ?? []) as PersonRow[];
}

/* ── Pickers ─────────────────────────────────────────────────────────────────────── */

export interface ListingHit {
  code: string;
  label: string;
  sale: string | null;
}

export interface ProjectHit {
  projectId: string;
  label: string;
}

export interface LeadHit {
  id: string;
  label: string;
}

/**
 * Project lookup for the listing intake form.
 *
 * This picker is not a convenience: `main_4_listing_database` has no `listing_name` column,
 * and `v_main_listing.listing_name` is the joined `main_3_property_detail.project_name_thai`.
 * The project a listing points at IS its displayed name everywhere, so a listing filed
 * without one shows up blank on every screen.
 */
export async function searchProjects(query: string): Promise<ProjectHit[]> {
  const rows = await findProjects(await createClient(), query.trim(), 8);
  return rows.map((p) => ({
    projectId: p.project_id,
    label: p.project_name_thai || p.project_name_eng || p.project_id,
  }));
}

/**
 * Lead lookup for the Daily Plan's "เชื่อมกับ CRM" picker.
 *
 * `tasks.related_lead_id` and `activities.related_lead_id` are both FKs to
 * `main_6_buyer_crm`, so the design build's six hardcoded sample leads (L-0007, L-0011 …)
 * would fail every insert. RLS scopes the result to the leads the caller may see, which for
 * an agent is their own — exactly the set they can plan work against.
 */
export async function searchLeads(query: string): Promise<LeadHit[]> {
  const rows = await findLeads(await createClient(), query.trim(), 8);
  return rows.map((l) => ({
    id: l.lead_id,
    label: [l.lead_name || l.lead_id, l.phone].filter(Boolean).join(" · "),
  }));
}

/** Listing lookup for the intake form's "ทรัพย์ที่สนใจ" combobox. */
export async function searchListings(query: string): Promise<ListingHit[]> {
  const rows = await findListings(await createClient(), query.trim(), 8);
  return rows.map((l) => ({
    code: l.listing_id,
    label: [l.listing_name, l.zone_name_thai].filter(Boolean).join(" · ") || l.listing_id,
    sale: l.effective_sale_id,
  }));
}

/* ── The palette ─────────────────────────────────────────────────────────────────── */

export type SearchKind = "lead" | "listing" | "project" | "person";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  /** Where choosing it goes — the record's own page, so a hit is also a shareable link. */
  href: string;
  label: string;
  detail: string | null;
}

export interface SearchGroup {
  kind: SearchKind;
  title: string;
  hits: SearchHit[];
}

/** Per kind: the nav entry whose permission decides whether the group is searched at all,
    and the group's heading. You can search what you can browse — one rule, defined once in
    lib/nav. RLS then decides which rows inside that group the caller may see. */
const KINDS: { kind: SearchKind; nav: string; title: string }[] = [
  { kind: "lead", nav: "/leads", title: "Lead" },
  { kind: "listing", nav: "/company-listings", title: "ทรัพย์" },
  { kind: "project", nav: "/projects", title: "โครงการ" },
  { kind: "person", nav: "/team", title: "บุคคล" },
];

const PER_GROUP = 5;

/**
 * Everything at once, for ⌘K. Groups the caller cannot browse are not queried; groups
 * with no hits are dropped so the panel never shows an empty heading.
 *
 * Plain `ilike '%q%'` on four tables. At this size (hundreds to low thousands of rows per
 * table) that is a few milliseconds; if it ever is not, the fix is a pg_trgm index on the
 * searched columns, not a change here.
 */
export async function searchAll(query: string): Promise<SearchGroup[]> {
  const q = query.trim();
  if (!q) return [];

  const auth = await getAuthContext();
  // No session only happens while AUTH_ENFORCED is off (design mode); RLS returns nothing
  // then anyway, so gating on permissions would only hide the empty state.
  const perms = new Set(auth?.permissions ?? []);
  const allowed = (nav: string) => {
    if (!auth) return true;
    const p = navItemFor(nav)?.perm;
    if (!p) return true;
    return (Array.isArray(p) ? p : [p]).some((k) => perms.has(k));
  };

  const supabase = await createClient();
  const groups = await Promise.all(
    KINDS.filter((k) => allowed(k.nav)).map(async ({ kind, title }): Promise<SearchGroup> => {
      let hits: SearchHit[] = [];
      switch (kind) {
        case "lead":
          hits = (await findLeads(supabase, q, PER_GROUP)).map((l) => ({
            kind,
            id: l.lead_id,
            href: `/leads/${encodeURIComponent(l.lead_id)}`,
            label: l.lead_name || l.lead_id,
            detail: [l.lead_id, l.phone, l.listing_code].filter(Boolean).join(" · ") || null,
          }));
          break;
        case "listing":
          hits = (await findListings(supabase, q, PER_GROUP)).map((l) => ({
            kind,
            id: l.listing_id,
            href: `/listings/${encodeURIComponent(l.listing_id)}`,
            label: l.listing_name || l.listing_id,
            detail: [l.listing_id, l.zone_name_thai].filter(Boolean).join(" · ") || null,
          }));
          break;
        case "project":
          hits = (await findProjects(supabase, q, PER_GROUP)).map((p) => ({
            kind,
            id: p.project_id,
            href: `/projects/${encodeURIComponent(p.project_id)}`,
            label: p.project_name_thai || p.project_name_eng || p.project_id,
            detail: p.project_name_thai && p.project_name_eng ? p.project_name_eng : null,
          }));
          break;
        case "person":
          hits = (await findPeople(supabase, q, PER_GROUP)).map((e) => {
            const full = [e.first_name_th ?? e.first_name_en, e.last_name_th ?? e.last_name_en]
              .filter(Boolean)
              .join(" ");
            return {
              kind,
              id: e.employee_code,
              href: `/team/${encodeURIComponent(e.employee_code)}`,
              label: e.nickname || full || e.employee_code,
              detail: [e.employee_code, full !== (e.nickname || "") ? full : null, e.position]
                .filter(Boolean)
                .join(" · ") || null,
            };
          });
          break;
      }
      return { kind, title, hits };
    })
  );

  return groups.filter((g) => g.hits.length > 0);
}
