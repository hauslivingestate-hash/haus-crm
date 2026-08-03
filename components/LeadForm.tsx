"use client";

import * as React from "react";
import { X, ChevronDown, UserRound, Building2, Check, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { AiPasteBox } from "@/components/AiPasteBox";
import {
  PURPOSES,
  SELL_REASONS,
  SAMPLE_INTEREST_LISTINGS,
  assignableAgents,
  defaultAssignee,
  emptyLead,
  nextLeadId,
  type NewLead,
  type LeadRole,
} from "@/lib/leads";
// LIVE vocabularies (Settings-governed) — NOT the seed constants, so removing a value in
// Settings really removes it from these dropdowns.
import { useMasterData } from "@/components/MasterDataProvider";
import { type LeadDraft } from "@/lib/ai/parseLead";
import { cn } from "@/lib/cn";

const ZONES = [...new Set(SAMPLE_INTEREST_LISTINGS.map((l) => l.zone))];
const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// Shared intake engine. mode="admin" adds the assign-to picker (defaults to the interested
// listing's owner-sale); mode="rep" files the lead to the creator. Buyer/owner is one axis
// that swaps labels + the requirements block. Submit is a STUB (optimistic add via onCreated).
export function LeadForm({
  open,
  mode,
  createdBy,
  onClose,
  onCreated,
}: {
  open: boolean;
  mode: "admin" | "rep";
  createdBy: string;
  onClose: () => void;
  onCreated: (lead: NewLead) => void;
}) {
  const [lead, setLead] = React.useState<NewLead>(() => emptyLead(createdBy));
  const [expanded, setExpanded] = React.useState(false);
  const [assigneeTouched, setAssigneeTouched] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const agents = assignableAgents();
  const { sources, contactBys, genders, nationalities, propertyTypes } = useMasterData();

  const reset = React.useCallback(() => {
    setLead(emptyLead(createdBy, "buyer"));
    setExpanded(false);
    setAssigneeTouched(false);
    setDone(null);
  }, [createdBy]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

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

  // Interested-listing change → default the assignee to its owner-sale (until admin overrides).
  // The combobox passes the owner-sale for a known listing; fall back to the code lookup.
  const onPickListing = (code: string, sale?: string) => {
    const next: Partial<NewLead> = { listing_code: code };
    if (mode === "admin" && !assigneeTouched) next.sale_id = sale ?? defaultAssignee(code);
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

  const canSave = lead.lead_name.trim() && lead.phone.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const built: NewLead = {
      ...lead,
      lead_id: nextLeadId(),
      lead_name: lead.lead_name.trim(),
      phone: lead.phone.trim(),
      sale_id: mode === "rep" ? createdBy : lead.sale_id,
      remark: lead.remark?.trim() || undefined,
    };
    // eslint-disable-next-line no-console
    console.log("[stub] create lead (no write):", built);
    onCreated(built);
    setDone(built.sale_id ? `บันทึกลีดแล้ว · มอบหมายให้ ${built.sale_id} (ตัวอย่าง)` : "บันทึกลีดแล้ว · ยังไม่มอบหมาย (ตัวอย่าง)");
    // Keep role for rapid entry; clear the per-lead fields.
    setLead((l) => ({ ...emptyLead(createdBy, l.role) }));
    setAssigneeTouched(false);
  };

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
              onClick={() => set({ role: r })}
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
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ช่องทางรับ (Contact By)">
            <select value={lead.contactBy} onChange={(e) => set({ contactBy: e.target.value })} className={field}>
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
                {lead.sale_id && !agents.some((a) => a.nickname === lead.sale_id) && (
                  <option value={lead.sale_id}>{lead.sale_id}</option>
                )}
                {agents.map((a) => (
                  <option key={a.id} value={a.nickname}>{a.nickname}</option>
                ))}
              </select>
              {lead.listing_code && lead.sale_id === defaultAssignee(lead.listing_code) && lead.sale_id && (
                <span className="text-label text-green inline-flex items-center gap-0.5 shrink-0" title="เจ้าของทรัพย์ที่ลูกค้าสนใจ">
                  <Check size={12} strokeWidth={2.5} /> เจ้าของทรัพย์
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
                  {nationalities.map((n) => (<option key={n.id} value={n.label}>{n.label}</option>))}
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
                    {ZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
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
                    {PURPOSES.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
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
                    {SELL_REASONS.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
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

        {done && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> {done}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSave}
          className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors mt-1 disabled:opacity-50 disabled:pointer-events-none"
        >
          บันทึกลีด
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

// Searchable listing picker — by code (TDMK007) or name. Selecting a known listing passes its
// owner-sale for the assignment default; a typed code that isn't in the list is still accepted
// (real inventory is hundreds of listings — wire this to a Supabase listing search).
function ListingCombobox({ value, onPick }: { value: string; onPick: (code: string, sale?: string) => void }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const selected = SAMPLE_INTEREST_LISTINGS.find((l) => l.code === value);
  const display = selected ? `${selected.code} · ${selected.label}` : value;
  const query = q.trim().toLowerCase();
  const matches = SAMPLE_INTEREST_LISTINGS.filter(
    (l) => !query || l.code.toLowerCase().includes(query) || l.label.toLowerCase().includes(query)
  ).slice(0, 8);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (code: string, sale?: string) => {
    onPick(code, sale);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={open ? q : display}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              e.preventDefault();
              pick(q.trim().toUpperCase());
            }
          }}
          placeholder="ค้นหารหัส / ชื่อทรัพย์ หรือพิมพ์รหัส…"
          className={cn(field, "pl-8")}
        />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-md border border-border bg-surface shadow-pop max-h-56 overflow-y-auto">
          {value && (
            <button type="button" onClick={() => pick("")} className="w-full text-left px-3 py-2 text-small text-text-subtle hover:bg-surface-hover">
              — ล้าง —
            </button>
          )}
          {matches.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code, l.sale)}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">
                <span className="num text-small font-medium">{l.code}</span> <span className="text-small text-text-muted">{l.label}</span>
              </span>
              <span className="text-label text-text-subtle shrink-0">{l.sale}</span>
            </button>
          ))}
          {query && matches.length === 0 && (
            <button type="button" onClick={() => pick(q.trim().toUpperCase())} className="w-full text-left px-3 py-2 text-small text-accent hover:bg-accent-wash">
              ใช้รหัส “{q.trim().toUpperCase()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
