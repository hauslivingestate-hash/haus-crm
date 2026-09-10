"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, ChevronDown, UserRound, Building2, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { AiPasteBox } from "@/components/AiPasteBox";
import { emptyLead, type NewLead, type LeadRole } from "@/lib/leads";
// LIVE vocabularies — loaded from the DB lookup tables via lib/lookups.ts. These are the
// values the FK columns actually accept; the old seed slugs ("ddproperty", "line_oa") match
// nothing in the database and would fail every insert.
import { useMasterData } from "@/components/MasterDataProvider";
import { createLead } from "@/lib/mutations/leads";
import { ListingCombobox } from "@/components/ListingCombobox";
import { type LeadDraft } from "@/lib/ai/parseLead";
import { cn } from "@/lib/cn";

export interface AgentOption {
  employeeCode: string;
  nickname: string;
}

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Which lead_type values belong to each side of the buyer/owner toggle. */
const typesFor = (role: LeadRole, all: { id: string }[]) =>
  all.filter((t) => (role === "owner" ? t.id.startsWith("Owner") : !t.id.startsWith("Owner")));

// Shared intake engine. mode="admin" adds the assign-to picker (defaults to the interested
// listing's managing agent); mode="rep" files the lead to the creator. Buyer/owner is one
// axis that swaps labels + the requirements block.
export function LeadForm({
  open,
  mode,
  createdBy,
  agents,
  onClose,
  onCreated,
}: {
  open: boolean;
  mode: "admin" | "rep";
  createdBy: string;
  agents: AgentOption[];
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [lead, setLead] = React.useState<NewLead>(() => emptyLead(createdBy));
  const [expanded, setExpanded] = React.useState(false);
  const [assigneeTouched, setAssigneeTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const {
    sources,
    contactBys,
    genders,
    nationalities,
    propertyTypes,
    leadTypes,
    purposes,
    sellReasons,
    zones,
  } = useMasterData();

  const reset = React.useCallback(() => {
    setLead(emptyLead(createdBy, "buyer"));
    setExpanded(false);
    setAssigneeTouched(false);
    setBusy(false);
    setError(null);
    setDone(null);
  }, [createdBy]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // lead_type can't be defaulted in emptyLead() — the valid values only arrive with the DB
  // lookups. Pick the first option for the current side once they're here, so the select
  // never *looks* like it has a value the draft doesn't actually hold.
  React.useEffect(() => {
    if (!open || !leadTypes.length) return;
    setLead((l) => {
      const allowed = typesFor(l.role, leadTypes);
      if (allowed.some((t) => t.id === l.lead_type)) return l;
      return { ...l, lead_type: allowed[0]?.id ?? "" };
    });
  }, [open, leadTypes]);

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

  const isOwner = lead.role === "owner";
  const set = (patch: Partial<NewLead>) => setLead((l) => ({ ...l, ...patch }));
  const setReq = (patch: Partial<NewLead["requirements"]>) => setLead((l) => ({ ...l, requirements: { ...l.requirements, ...patch } }));

  // Switching buyer/owner invalidates the lead_type — 'Owner - Sale' under the buyer toggle
  // would be nonsense — so snap it to the first valid option for the new side.
  const setRole = (role: LeadRole) => {
    const allowed = typesFor(role, leadTypes);
    set({ role, lead_type: allowed.some((t) => t.id === lead.lead_type) ? lead.lead_type : allowed[0]?.id ?? "" });
  };

  // Interested-listing change → default the assignee to that listing's managing agent (until
  // admin overrides). The combobox passes `effective_sale_id`, already an employee_code.
  const onPickListing = (code: string, sale?: string | null) => {
    const next: Partial<NewLead> = { listing_code: code };
    if (mode === "admin" && !assigneeTouched) next.sale_id = sale ?? "";
    set(next);
  };

  const applyAi = (d: LeadDraft) => {
    const patch: Partial<NewLead> = {};
    if (d.role) patch.role = d.role;
    if (d.lead_name) patch.lead_name = d.lead_name;
    if (d.phone) patch.phone = d.phone;
    if (d.source) patch.source = d.source;
    if (d.budget != null) patch.budget = d.budget;
    const req: Partial<NewLead["requirements"]> = {};
    if (d.zone) req.zone = d.zone;
    if (d.propertyType) req.propertyType = d.propertyType;
    set(patch);
    if (Object.keys(req).length) setReq(req);
    if (d.budget != null || d.zone || d.propertyType) setExpanded(true);
  };

  const canSave = !!lead.lead_name.trim() && !!lead.phone.trim() && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    setDone(null);

    // Requirements are two disjoint sets — send only the ones that belong to this side, so a
    // buyer never carries a sell_reason left over from toggling.
    const result = await createLead({
      lead_name: lead.lead_name.trim(),
      phone: lead.phone.trim(),
      line_id: lead.lineId,
      lead_type: lead.lead_type,
      marketing_channel: lead.source,
      contact_by: lead.contactBy,
      gender: lead.gender,
      nationality: lead.nationality,
      contact_date: lead.contactDate,
      contact_time: lead.contactTime,
      listing_code: lead.listing_code,
      budget: lead.budget != null ? String(lead.budget) : "",
      sale_id: mode === "rep" ? "" : lead.sale_id, // "rep" → server files it to the creator
      interest_zone: isOwner ? "" : lead.requirements.zone,
      interest_property_type: lead.requirements.propertyType,
      purpose: isOwner ? "" : lead.requirements.purpose,
      sell_reason: isOwner ? lead.requirements.reason : "",
      remark: lead.remark?.trim(),
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const assignedTo = agents.find((a) => a.employeeCode === lead.sale_id)?.nickname;
    setDone(
      mode === "rep" || !lead.sale_id
        ? `บันทึกลีด ${result.leadId} แล้ว`
        : `บันทึกลีด ${result.leadId} แล้ว · มอบหมายให้ ${assignedTo ?? lead.sale_id}`
    );
    // Keep role for rapid entry; clear the per-lead fields.
    setLead(() => emptyLead(createdBy, lead.role));
    setAssigneeTouched(false);
    onCreated?.();
    router.refresh();
  }

  const nameLabel = isOwner ? "ชื่อเจ้าของ" : "ชื่อลูกค้า";
  const listingLabel = isOwner ? "ทรัพย์ที่จะฝากขาย/ปล่อย" : "ทรัพย์ที่สนใจ";
  const budgetLabel = isOwner ? "ราคาที่ต้องการ (฿)" : "งบประมาณ (฿)";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-md bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar name={createdBy} tone="crimson" />
            <div className="leading-tight">
              <div className="text-label uppercase text-text-subtle">{mode === "admin" ? "รับลีด · บันทึกในนาม" : "เพิ่มลีดของฉัน"}</div>
              <div className="text-body font-semibold">{createdBy}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <AiPasteBox onFilled={applyAi} />

        {/* Role: buyer vs owner */}
        <div className="flex gap-1.5">
          {(["buyer", "owner"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "flex-1 h-9 rounded-md border text-small font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                lead.role === r ? "bg-text text-background border-text" : "border-border-strong text-text-muted hover:bg-surface-2"
              )}
            >
              {r === "buyer" ? <UserRound size={14} /> : <Building2 size={14} />}
              {r === "buyer" ? "ผู้ซื้อ / ผู้เช่า" : "เจ้าของ"}
            </button>
          ))}
        </div>

        <Field label="ประเภทลีด">
          <select value={lead.lead_type ?? ""} onChange={(e) => set({ lead_type: e.target.value })} className={field}>
            {typesFor(lead.role, leadTypes).map((t) => (
              <option key={t.id} value={t.id}>{t.id}</option>
            ))}
          </select>
        </Field>

        {/* Quick tier */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={nameLabel}>
            <Input value={lead.lead_name} onChange={(e) => set({ lead_name: e.target.value })} placeholder="ชื่อ / ชื่อเล่น" autoFocus />
          </Field>
          <Field label="เบอร์โทร">
            <Input value={lead.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="08x-xxx-xxxx" inputMode="tel" className="num" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="LINE ID (ถ้ามี)">
            <Input value={lead.lineId ?? ""} onChange={(e) => set({ lineId: e.target.value })} placeholder="@line / ชื่อไลน์" />
          </Field>
          <Field label="Marketing Channel / ช่องทาง">
            <select value={lead.source} onChange={(e) => set({ source: e.target.value })} className={field}>
              <option value="">— ไม่ระบุ —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ช่องทางรับ (Contact By)">
            <select value={lead.contactBy} onChange={(e) => set({ contactBy: e.target.value })} className={field}>
              <option value="">— ไม่ระบุ —</option>
              {contactBys.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="วันที่ / เวลาที่ติดต่อ">
            <div className="flex gap-2">
              <input type="date" value={lead.contactDate ?? ""} onChange={(e) => set({ contactDate: e.target.value })} className={cn(field, "num")} />
              <input type="time" value={lead.contactTime ?? ""} onChange={(e) => set({ contactTime: e.target.value })} className={cn(field, "w-24 num")} aria-label="เวลาที่ติดต่อ" />
            </div>
          </Field>
        </div>

        <Field label={listingLabel}>
          <ListingCombobox value={lead.listing_code ?? ""} onPick={onPickListing} />
        </Field>

        {/* Assign-to (admin only) */}
        {mode === "admin" && (
          <Field label="มอบหมายให้เซล">
            <div className="flex items-center gap-2">
              <select
                value={lead.sale_id}
                onChange={(e) => {
                  set({ sale_id: e.target.value });
                  setAssigneeTouched(true);
                }}
                className={field}
              >
                <option value="">— ยังไม่มอบหมาย —</option>
                {/* Keep an unknown stored code selectable rather than silently blanking it. */}
                {lead.sale_id && !agents.some((a) => a.employeeCode === lead.sale_id) && (
                  <option value={lead.sale_id}>{lead.sale_id}</option>
                )}
                {agents.map((a) => (
                  <option key={a.employeeCode} value={a.employeeCode}>{a.nickname}</option>
                ))}
              </select>
              {lead.sale_id && !assigneeTouched && lead.listing_code && (
                <span className="text-label text-green inline-flex items-center gap-0.5 shrink-0" title="เซลที่ดูแลทรัพย์ที่ลูกค้าสนใจ">
                  <Check size={12} strokeWidth={2.5} /> ผู้ดูแลทรัพย์
                </span>
              )}
            </div>
          </Field>
        )}

        {/* Full tier */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-small text-text-muted hover:text-text transition-colors self-start"
        >
          <ChevronDown size={14} strokeWidth={2} className={cn("transition-transform", expanded && "rotate-180")} /> เพิ่มรายละเอียด
        </button>

        {expanded && (
          <div className="flex flex-col gap-3.5 border-t border-border pt-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="เพศ">
                <select value={lead.gender ?? ""} onChange={(e) => set({ gender: e.target.value })} className={field}>
                  <option value="">— ไม่ระบุ —</option>
                  {genders.map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
                </select>
              </Field>
              <Field label="สัญชาติ">
                <select value={lead.nationality ?? ""} onChange={(e) => set({ nationality: e.target.value })} className={field}>
                  <option value="">— ไม่ระบุ —</option>
                  {nationalities.map((n) => (<option key={n.id} value={n.id}>{n.label}</option>))}
                </select>
              </Field>
            </div>
            <Field label={budgetLabel}>
              <Input
                value={lead.budget ?? ""}
                onChange={(e) => set({ budget: e.target.value ? Number(String(e.target.value).replace(/[^\d.]/g, "")) : undefined })}
                placeholder="เช่น 6000000"
                inputMode="numeric"
                className="num"
              />
            </Field>

            {/* Requirements — buyer vs owner */}
            {!isOwner ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="ทำเล / โซน">
                  <select value={lead.requirements.zone ?? ""} onChange={(e) => setReq({ zone: e.target.value })} className={field}>
                    <option value="">— ไม่ระบุ —</option>
                    {zones.map((z) => (<option key={z.id} value={z.id}>{z.label}</option>))}
                  </select>
                </Field>
                <Field label="ประเภททรัพย์">
                  <select value={lead.requirements.propertyType ?? ""} onChange={(e) => setReq({ propertyType: e.target.value })} className={field}>
                    <option value="">— ไม่ระบุ —</option>
                    {propertyTypes.map((t) => (<option key={t.id} value={t.label}>{t.label}</option>))}
                  </select>
                </Field>
                <Field label="วัตถุประสงค์">
                  <select value={lead.requirements.purpose ?? ""} onChange={(e) => setReq({ purpose: e.target.value })} className={field}>
                    <option value="">— ไม่ระบุ —</option>
                    {purposes.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
                  </select>
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="ประเภททรัพย์">
                  <select value={lead.requirements.propertyType ?? ""} onChange={(e) => setReq({ propertyType: e.target.value })} className={field}>
                    <option value="">— ไม่ระบุ —</option>
                    {propertyTypes.map((t) => (<option key={t.id} value={t.label}>{t.label}</option>))}
                  </select>
                </Field>
                <Field label="เหตุผลที่ขาย/ปล่อย">
                  <select value={lead.requirements.reason ?? ""} onChange={(e) => setReq({ reason: e.target.value })} className={field}>
                    <option value="">— ไม่ระบุ —</option>
                    {sellReasons.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
                  </select>
                </Field>
              </div>
            )}

            <Field label="หมายเหตุ (ถ้ามี)">
              <textarea
                value={lead.remark ?? ""}
                onChange={(e) => set({ remark: e.target.value })}
                rows={2}
                placeholder="สรุปสิ่งที่ลูกค้าต้องการ / บริบทเพิ่มเติม…"
                className={cn(field, "h-auto py-2 resize-none")}
              />
            </Field>
          </div>
        )}

        {error && (
          <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-start gap-1.5">
            <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {done && !error && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> {done}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSave}
          className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors mt-1 disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? "กำลังบันทึก…" : "บันทึกลีด"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small text-text-muted">{label}</span>
      {children}
    </label>
  );
}

