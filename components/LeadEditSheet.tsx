"use client";

import * as React from "react";
import { X, Check } from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Input } from "@/components/ui/Input";
import { STAGES } from "@/lib/pipeline";
import { LEAD_POTENTIALS } from "@/lib/leads";
import { cn } from "@/lib/cn";

const LEAD_TYPES = ["Buyer - Buy", "Buyer - Rent", "Co-Agent"];
const LEAD_STATUSES = ["Active", "Win", "Lose", "Reject"];
const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// Edit an existing lead's core fields. Design-first: Save is a STUB (console.log) — leads are
// read-only Supabase in this build; wire to an update on main_6_buyer_crm. Follows the app's
// bottom-sheet form pattern.
export function LeadEditSheet({ open, lead, onClose }: { open: boolean; lead: CrmRow; onClose: () => void }) {
  const [f, setF] = React.useState(() => draftOf(lead));
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setF(draftOf(lead));
      setDone(false);
    }
  }, [open, lead]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const set = (patch: Partial<ReturnType<typeof draftOf>>) => setF((x) => ({ ...x, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // eslint-disable-next-line no-console
    console.log("[stub] update lead (no write):", { lead_id: lead.lead_id, ...f });
    setDone(true);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-md bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="text-h2">แก้ไข Lead <span className="num text-small text-text-subtle">{lead.lead_id}</span></div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ชื่อลูกค้า"><Input value={f.lead_name} onChange={(e) => set({ lead_name: e.target.value })} /></Field>
          <Field label="เบอร์โทร"><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" className="num" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="LINE ID"><Input value={f.line_id} onChange={(e) => set({ line_id: e.target.value })} /></Field>
          <Field label="ประเภท">
            <select value={f.lead_type} onChange={(e) => set({ lead_type: e.target.value })} className={field}>
              {!LEAD_TYPES.includes(f.lead_type) && f.lead_type && <option value={f.lead_type}>{f.lead_type}</option>}
              {LEAD_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="สเตจ">
            <select value={f.pipeline_stage} onChange={(e) => set({ pipeline_stage: e.target.value })} className={field}>
              {STAGES.map((s) => (<option key={s.key} value={s.key}>{s.th}</option>))}
            </select>
          </Field>
          <Field label="สถานะ">
            <select value={f.lead_status} onChange={(e) => set({ lead_status: e.target.value })} className={field}>
              {LEAD_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Potential">
            <select value={f.potential} onChange={(e) => set({ potential: e.target.value })} className={field}>
              {LEAD_POTENTIALS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </Field>
          <Field label="งบประมาณ (฿)">
            <Input value={f.budget} onChange={(e) => set({ budget: e.target.value.replace(/[^\d.]/g, "") })} inputMode="numeric" className="num" />
          </Field>
        </div>

        {done && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> บันทึกแล้ว (ตัวอย่าง — ยังไม่เชื่อมฐานข้อมูล)
          </div>
        )}

        <button type="submit" className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors mt-1">
          บันทึก
        </button>
      </form>
    </div>
  );
}

function draftOf(l: CrmRow) {
  return {
    lead_name: l.lead_name ?? "",
    phone: l.phone ?? "",
    line_id: l.line_id ?? "",
    lead_type: l.lead_type ?? "Buyer - Buy",
    pipeline_stage: l.pipeline_stage ?? "Lead",
    lead_status: l.lead_status ?? "Active",
    potential: l.potential ?? "New Lead",
    budget: l.budget != null ? String(l.budget) : "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small text-text-muted">{label}</span>
      {children}
    </label>
  );
}
