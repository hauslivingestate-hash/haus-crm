"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Check, Home } from "lucide-react";
import { Input } from "@/components/ui/Input";
// LIVE vocabularies (Settings-governed) — same source the lead intake form uses, so a value
// removed in Settings really disappears here too.
import { useMasterData } from "@/components/MasterDataProvider";
import { POTENTIALS } from "@/lib/masterdata";
import { listZones } from "@/lib/zones";
import { assignableAgents } from "@/lib/leads";
import { emptyListing, NEW_LISTING_STATUSES, type NewListing } from "@/lib/newListing";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// "Add Listing" intake — twin of LeadForm (same bottom-sheet surface, widened for a longer
// form). Design-first: Save is a STUB (console.log). Listings are read-only from v_main_listing
// today, so there's no optimistic list insert — the form just confirms + resets. Wire later =
// insert into the base listing table (see lib/newListing).
export function ListingForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { propertyTypes } = useMasterData();
  // Resolve reference data inside the component (like LeadForm) — never at module load.
  const zones = listZones();
  const agents = assignableAgents();
  const [f, setF] = React.useState<NewListing>(() => emptyListing());
  const [done, setDone] = React.useState(false);
  // Portal to <body>: this form is triggered from a button inside the backdrop-blur Topbar,
  // and backdrop-filter establishes a containing block for position:fixed — without the portal
  // the overlay would be positioned relative to the header, not the viewport.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setF(emptyListing());
      setDone(false);
    }
  }, [open]);

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

  if (!open || !mounted) return null;

  const set = (patch: Partial<NewListing>) => setF((x) => ({ ...x, ...patch }));
  // Minimum to file a listing: what it is + a name. Prices/owner can follow.
  const canSave = f.property_type.trim() && f.listing_name.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    // eslint-disable-next-line no-console
    console.log("[stub] create listing (no write):", f);
    setDone(true);
    setF(emptyListing());
  };

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-2xl bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-accent-wash grid place-items-center shrink-0">
              <Home size={16} strokeWidth={2} className="text-accent" />
            </span>
            <div className="leading-tight">
              <div className="text-h2">เพิ่มทรัพย์ใหม่</div>
              <div className="text-label text-text-subtle">โหมดออกแบบ — ยังไม่บันทึกลงฐานข้อมูล</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* ── ข้อมูลทรัพย์ ── */}
        <Section title="ข้อมูลทรัพย์" first>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ประเภททรัพย์">
              <select value={f.property_type} onChange={(e) => set({ property_type: e.target.value })} className={field}>
                <option value="">— เลือกประเภท —</option>
                {propertyTypes.map((t) => (
                  <option key={t.id} value={t.label}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="โครงการ / หมู่บ้าน">
              <Input value={f.project_name} onChange={(e) => set({ project_name: e.target.value })} placeholder="ชื่อโครงการ (ถ้ามี)" />
            </Field>
          </div>

          <Field label="ชื่อทรัพย์">
            <Input value={f.listing_name} onChange={(e) => set({ listing_name: e.target.value })} placeholder="เช่น คอนโด XYZ ชั้น 12 วิวสระ" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ทำเล / โซน">
              <select value={f.zone_id} onChange={(e) => set({ zone_id: e.target.value })} className={field}>
                <option value="">— ไม่ระบุ —</option>
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>{z.name_thai} · {z.zone_id}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="นอน"><Input value={f.bed} onChange={(e) => set({ bed: e.target.value })} inputMode="numeric" className="num" /></Field>
              <Field label="น้ำ"><Input value={f.bath} onChange={(e) => set({ bath: e.target.value })} inputMode="numeric" className="num" /></Field>
              <Field label="ตร.ม."><Input value={f.area_sqm} onChange={(e) => set({ area_sqm: e.target.value })} inputMode="decimal" className="num" /></Field>
            </div>
          </div>
        </Section>

        {/* ── ราคา ── */}
        <Section title="ราคา">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ราคาขาย (฿)">
              <Input value={f.asking_price} onChange={(e) => set({ asking_price: e.target.value })} placeholder="เช่น 6500000" inputMode="numeric" className="num" />
            </Field>
            <Field label="ค่าเช่า / เดือน (฿)">
              <Input value={f.rental_price} onChange={(e) => set({ rental_price: e.target.value })} placeholder="เช่น 25000" inputMode="numeric" className="num" />
            </Field>
          </div>
          <p className="text-label text-text-subtle">ประเภทดีล (ขาย / เช่า / ทั้งคู่) กำหนดจากราคาที่กรอก</p>
        </Section>

        {/* ── การจัดการ & เจ้าของ ── */}
        <Section title="การจัดการ & เจ้าของ">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Potential">
              <select value={f.potential} onChange={(e) => set({ potential: e.target.value })} className={field}>
                {POTENTIALS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </Field>
            <Field label="สถานะประกาศ">
              <select value={f.listing_status} onChange={(e) => set({ listing_status: e.target.value })} className={field}>
                {NEW_LISTING_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </Field>
          </div>

          <Field label="ผู้ดูแล (เซล)">
            <select value={f.agent_id} onChange={(e) => set({ agent_id: e.target.value })} className={field}>
              <option value="">— ไม่ระบุ —</option>
              {agents.map((a) => (<option key={a.id} value={a.nickname}>{a.nickname}</option>))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อเจ้าของ">
              <Input value={f.owner_name} onChange={(e) => set({ owner_name: e.target.value })} placeholder="ชื่อเจ้าของทรัพย์" />
            </Field>
            <Field label="เบอร์โทรเจ้าของ">
              <Input value={f.owner_phone} onChange={(e) => set({ owner_phone: e.target.value })} placeholder="08x-xxx-xxxx" inputMode="tel" className="num" />
            </Field>
          </div>
        </Section>

        {/* ── หมายเหตุ ── */}
        <Section title="หมายเหตุ">
          <textarea
            value={f.remark}
            onChange={(e) => set({ remark: e.target.value })}
            rows={2}
            placeholder="รายละเอียดเพิ่มเติม / เงื่อนไข / จุดเด่น…"
            className={cn(field, "h-auto py-2 resize-none")}
          />
        </Section>

        {done && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> บันทึกทรัพย์แล้ว (ตัวอย่าง — ยังไม่เขียนลงฐานข้อมูล)
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border-strong text-text-muted font-medium hover:bg-surface-2 transition-colors">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="h-10 px-5 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            บันทึกทรัพย์
          </button>
        </div>
      </form>
    </div>,
    document.body
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

// Labeled group divided by a hairline — chunks the form into scannable sections (Shelter-style).
function Section({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3", !first && "border-t border-border pt-4")}>
      <span className="text-small font-medium text-text-muted">{title}</span>
      {children}
    </div>
  );
}
