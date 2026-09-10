/* What actually happened to a lead. Pure model — lib/queries.ts does the reading.
 *
 * ── WHAT THIS REPLACED ──────────────────────────────────────────────────────────
 * Until 2026-09-10 this file GENERATED the timeline: a hash of the lead_id picked a
 * plausible-looking run of calls, follow-ups and viewings, dated off `date_received`.
 * It was written as design-phase scaffolding and it was still on screen months later,
 * showing every sale a history of work nobody did. A fake log is worse than no log —
 * an empty one says "nothing recorded", a fabricated one says "this was handled".
 *
 * ── WHERE THE REAL EVENTS COME FROM ─────────────────────────────────────────────
 *   activities  — what someone did, with a note. `related_lead_id` has existed on that
 *                 table since it was created and had never been written to: all 2,646
 *                 rows are daily KPI tallies with no lead attached. The composer in the
 *                 lead drawer is the first thing to fill it in, so a lead's log starts
 *                 empty today and grows from here. That is the honest starting point.
 *   audit_log   — what someone changed: reassignment, closing the deal, field edits.
 *                 Only readable with roles.manage (RLS), so most viewers see the
 *                 activity half only.
 *   the lead    — `date_received` anchors the list so it is never completely empty.
 */

export type TimelineKind = "created" | "call" | "follow" | "show" | "note" | "stage" | "assign";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string; // YYYY-MM-DD
  by: string; // actor: employee_code, resolved to a nickname by the component
  text: string;
  /** activities.count when it is more than one ("พาชม × 3"). */
  count?: number;
}

/** One row of `activities`, as the timeline needs it. */
export interface LeadActivityRow {
  id: number;
  employee_code: string;
  action: string;
  activity_date: string;
  count: number | null;
  remark: string | null;
}

/** One row of `audit_log` for this lead. */
export interface LeadAuditRow {
  id: number;
  action: string;
  changed_by: string;
  created_at: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/* Which icon an action gets. The keys are the company's own vocabulary from the
   `activities.action` reference list — not a new set invented here, because Settings can
   add to that list and anything unrecognised must still render rather than crash. */
const ACTION_KIND: Record<string, TimelineKind> = {
  Call: "call",
  Follow: "follow",
  "Follow Up": "follow",
  Appoint: "show",
  Show: "show",
  Nego: "follow",
  Close: "stage",
  Win: "stage",
  เซ็นสัญญา: "stage",
  โอน: "stage",
  บันทึก: "note",
  "Owner Talk": "call",
  "Owner Visit": "show",
  Survey: "show",
};

export function actionKind(action: string): TimelineKind {
  return ACTION_KIND[action] ?? "note";
}

/** Field edits worth a line in the log. Everything else is noise on a timeline. */
const AUDIT_LABEL: Record<string, string> = {
  close_deal: "บันทึกการปิดการขาย",
  update: "แก้ไขข้อมูล",
  tag: "เปลี่ยนแท็ก",
  complaint: "อัปเดตข้อร้องเรียน",
};

/**
 * Merge the sources into one list, newest first.
 *
 * `assign` rows are handled by the caller (it already resolves nicknames from the agent
 * list, and the audit half is permission-gated separately) — passing them in pre-built
 * keeps this function from needing a directory it would only use for two lines.
 */
export function buildTimeline({
  leadId,
  dateReceived,
  activities,
  audits,
  extra = [],
}: {
  leadId: string;
  dateReceived: string | null;
  activities: LeadActivityRow[];
  audits: LeadAuditRow[];
  extra?: TimelineEvent[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const a of activities) {
    const n = a.count ?? 1;
    events.push({
      id: `act-${a.id}`,
      kind: actionKind(a.action),
      at: a.activity_date,
      by: a.employee_code,
      text: a.remark?.trim() || a.action,
      count: n > 1 ? n : undefined,
    });
  }

  for (const r of audits) {
    // Reassignment is the caller's to render — it needs the nickname directory.
    if (r.action === "assign") continue;
    const label = AUDIT_LABEL[r.action];
    if (!label) continue;
    events.push({
      id: `aud-${r.id}`,
      kind: r.action === "close_deal" ? "stage" : "note",
      at: r.created_at.slice(0, 10),
      by: r.changed_by,
      text: r.action === "update" ? `${label}: ${changedFields(r.after)}` : label,
    });
  }

  events.push(...extra);

  // The anchor. Without it a lead with no logged work shows a blank card, which reads as
  // broken rather than as "nothing has been recorded yet".
  if (dateReceived) {
    events.push({
      id: `${leadId}-created`,
      kind: "created",
      at: dateReceived,
      by: "",
      text: "รับลีดเข้าระบบ",
    });
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** "ชื่อ, เบอร์โทร" — which fields an `update` touched, for the log line. */
function changedFields(after: Record<string, unknown> | null): string {
  const TH: Record<string, string> = {
    lead_name: "ชื่อ",
    phone: "เบอร์โทร",
    line_id: "LINE",
    lead_type: "ประเภท",
    pipeline_stage: "ขั้นตอน",
    lead_status: "สถานะ",
    potential: "เกรด",
    budget: "งบประมาณ",
  };
  const keys = Object.keys(after ?? {});
  if (!keys.length) return "—";
  return keys.map((k) => TH[k] ?? k).join(", ");
}
