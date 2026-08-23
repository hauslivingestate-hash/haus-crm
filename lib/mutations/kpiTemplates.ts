"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { KpiTemplate } from "@/lib/masterdata";

// เทมเพลตเป้าหมาย KPI (ตั้งค่า → เป้าหมาย KPI) — the presets a leader picks from when
// setting a month's targets. Each row is the shape of one `targets` row, minus the person
// and the month.
//
// Saved as a whole list behind an explicit button, like the probation ladder: a half-built
// row (source switched to กิจกรรม but no activity picked yet) violates the table's coherence
// check, and committing every keystroke would surface that as an error mid-typing.

type Result = { ok: true } | { ok: false; error: string };

async function requireGovern(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("masterdata.govern") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์แก้เทมเพลต KPI" };
  }
  return { employeeCode: auth.employeeCode };
}

export async function saveKpiTemplates(rows: KpiTemplate[]): Promise<Result> {
  const auth = await requireGovern();
  if ("error" in auth) return { ok: false, error: auth.error };

  for (const r of rows) {
    if (!r.label.trim()) return { ok: false, error: "ทุกเป้าหมายต้องมีชื่อ" };
    if (r.source === "activity" && !r.activityType) {
      return { ok: false, error: `${r.label}: ยังไม่ได้เลือกกิจกรรม` };
    }
    if (!Number.isFinite(r.defaultTarget) || r.defaultTarget < 0) {
      return { ok: false, error: `${r.label}: เป้าตั้งต้นต้องไม่ติดลบ` };
    }
  }

  const supabase = await createClient();

  // Rows the editor no longer holds are gone. Ids are DB-generated, so a row the CEO just
  // added has none yet and cannot be in this list.
  const keep = rows.map((r) => r.id).filter((id): id is number => typeof id === "number");
  const { data: existing } = await supabase.from("kpi_template").select("id");
  const gone = ((existing ?? []) as { id: number }[])
    .map((r) => r.id)
    .filter((id) => !keep.includes(id));
  if (gone.length) {
    const { error } = await supabase.from("kpi_template").delete().in("id", gone);
    if (error) return { ok: false, error: error.message };
  }

  // activity_type must be null unless the source is กิจกรรม — the table refuses a leftover.
  // Carry each row's own id along rather than re-deriving it from a parallel filtered array.
  const payload = rows.map((r, i) => ({
    id: typeof r.id === "number" ? r.id : null,
    row: {
      label: r.label.trim(),
      kind: r.kind,
      source: r.source,
      activity_type: r.source === "activity" ? (r.activityType ?? null) : null,
      default_target: r.defaultTarget,
      sort: i + 1,
      updated_at: new Date().toISOString(),
    },
  }));

  const updates = payload.filter((p) => p.id !== null).map((p) => ({ ...p.row, id: p.id! }));
  const inserts = payload.filter((p) => p.id === null).map((p) => p.row);

  if (updates.length) {
    const { error } = await supabase.from("kpi_template").upsert(updates, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
  }
  if (inserts.length) {
    const { error } = await supabase.from("kpi_template").insert(inserts);
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "kpi_template",
    entity_id: "all",
    action: "update",
    changed_by: auth.employeeCode,
    before: {},
    after: { count: rows.length },
  });

  revalidatePath("/settings");
  revalidatePath("/today");
  return { ok: true };
}
