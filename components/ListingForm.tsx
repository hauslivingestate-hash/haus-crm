"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, Home, Search, Plus, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
// LIVE vocabularies (DB-backed via getLookups) — same source the lead intake form uses, so a
// value removed in Settings really disappears here too, and every option is FK-valid.
import { useMasterData } from "@/components/MasterDataProvider";
import type { AgentOption } from "@/components/LeadForm";
import { searchProjects, type ProjectHit } from "@/lib/search";
import { createListing, createProject } from "@/lib/mutations/listings";
import { emptyListing, NEW_LISTING_STATUSES, type NewListing } from "@/lib/newListing";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// "Add Listing" intake — twin of LeadForm (same bottom-sheet surface, widened for a longer
// form).
//
// Two constraints from the schema drive this form's shape:
//   • There is no listing_name column. A listing's displayed name is its PROJECT's Thai name
//     (v_main_listing joins it), so the project picker is what gives a listing a name — hence
//     a real search over the 308 projects, plus inline creation for a village not yet on file.
//   • The listing_id trigger builds the code from the property type's letter + the zone and
//     RAISES without them, so both are required here rather than optional.
export function ListingForm({
  open,
  onClose,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  agents: AgentOption[];
}) {
  const router = useRouter();
  const { propertyTypes, zones, listingPotentials } = useMasterData();
  const [f, setF] = React.useState<NewListing>(() => emptyListing());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  // Portal to <body>: this form is triggered from a button inside the backdrop-blur Topbar,
  // and backdrop-filter establishes a containing block for position:fixed — without the portal
  // the overlay would be positioned relative to the header, not the viewport.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setF(emptyListing());
      setBusy(false);
      setError(null);
      setCreatedId(null);
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
  // Type + zone are what the listing code is built from, so they are the real minimum.
  const canSave = !!f.property_type && !!f.zone_id && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const result = await createListing({
      project_id: f.project_id,
      property_type: f.property_type,
      zone: f.zone_id,
      listing_status: f.listing_status,
      potential: f.potential,
      sale_id: f.agent_id,
      unit_no: f.unit_no,
      bed: f.bed,
      bath: f.bath,
      area_sqm: f.area_sqm,
      asking_price: f.asking_price,
      rental_price: f.rental_price,
      owner_name: f.owner_name,
      owner_phone: f.owner_phone,
      remark: f.remark,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedId(result.listingId);
    setF(emptyListing());
    router.refresh();
  }

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
              <div className="text-label text-text-subtle">รหัสทรัพย์สร้างอัตโนมัติจากประเภท + โซน</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* ── ข้อมูลทรัพย์ ── */}
        <Section title="ข้อมูลทรัพย์" first>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ประเภททรัพย์ *">
              <select value={f.property_type} onChange={(e) => set({ property_type: e.target.value })} className={field}>
                <option value="">— เลือกประเภท —</option>
                {propertyTypes.map((t) => (
                  <option key={t.id} value={t.label}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="ทำเล / โซน *">
              <select value={f.zone_id} onChange={(e) => set({ zone_id: e.target.value })} className={field}>
                <option value="">— เลือกโซน —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="โครงการ / หมู่บ้าน">
            <ProjectCombobox
              value={f.project_label}
              propertyType={f.property_type}
              zone={f.zone_id}
              onPick={(projectId, label) => set({ project_id: projectId, project_label: label })}
              onError={setError}
            />
            <span className="text-label text-text-subtle mt-0.5">
              ชื่อทรัพย์ที่โชว์ในระบบคือชื่อโครงการ — ถ้าไม่เลือก ทรัพย์นี้จะไม่มีชื่อ
            </span>
          </Field>

          <div className="grid grid-cols-4 gap-3">
            <Field label="บ้านเลขที่ / ยูนิต"><Input value={f.unit_no} onChange={(e) => set({ unit_no: e.target.value })} /></Field>
            <Field label="นอน"><Input value={f.bed} onChange={(e) => set({ bed: e.target.value })} inputMode="numeric" className="num" /></Field>
            <Field label="น้ำ"><Input value={f.bath} onChange={(e) => set({ bath: e.target.value })} inputMode="numeric" className="num" /></Field>
            <Field label="ตร.ม."><Input value={f.area_sqm} onChange={(e) => set({ area_sqm: e.target.value })} inputMode="decimal" className="num" /></Field>
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
                {listingPotentials.map((p) => (<option key={p.id} value={p.label}>{p.label}</option>))}
              </select>
            </Field>
            <Field label="สถานะประกาศ">
              <select value={f.listing_status} onChange={(e) => set({ listing_status: e.target.value })} className={field}>
                {NEW_LISTING_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </Field>
          </div>

          <Field label="ผู้ดูแล (เซล)">
            {/* Values are employee codes — sale_id is a foreign key, not a nickname. */}
            <select value={f.agent_id} onChange={(e) => set({ agent_id: e.target.value })} className={field}>
              <option value="">— ไม่ระบุ —</option>
              {agents.map((a) => (<option key={a.employeeCode} value={a.employeeCode}>{a.nickname}</option>))}
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

        {error && (
          <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-start gap-1.5">
            <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {createdId && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> เพิ่มทรัพย์แล้ว · รหัส <span className="num font-medium">{createdId}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border-strong text-text-muted font-medium hover:bg-surface-2 transition-colors">
            ปิด
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="h-10 px-5 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? "กำลังบันทึก…" : "บันทึกทรัพย์"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// Searchable project picker over the real 308 projects, with inline creation for one that
// isn't on file yet. Creating from here is allowed for plain agents by design — main_3's
// INSERT policy accepts `listings.create`, because otherwise an agent hitting a new village
// would be stuck filing a nameless listing.
function ProjectCombobox({
  value,
  propertyType,
  zone,
  onPick,
  onError,
}: {
  value: string;
  propertyType: string;
  zone: string;
  onPick: (projectId: string, label: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [matches, setMatches] = React.useState<ProjectHit[]>([]);
  const [creating, setCreating] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const query = q.trim();

  // Debounced, with a staleness guard so a slower earlier response can't overwrite a newer one.
  React.useEffect(() => {
    if (!open) return;
    let stale = false;
    const t = setTimeout(async () => {
      const hits = await searchProjects(query);
      if (!stale) setMatches(hits);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, open, query]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (projectId: string, label: string) => {
    onPick(projectId, label);
    setQ("");
    setOpen(false);
  };

  async function createAndPick() {
    if (!query || creating) return;
    setCreating(true);
    onError(null);
    const result = await createProject({
      nameThai: query,
      propertyType: propertyType || null,
      zone: zone || null,
    });
    setCreating(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    pick(result.projectId, query);
  }

  const exactExists = matches.some((m) => m.label.trim().toLowerCase() === query.toLowerCase());

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={open ? q : value}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="ค้นหาชื่อโครงการ / หมู่บ้าน…"
          className={cn(field, "pl-8")}
        />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-md border border-border bg-surface shadow-pop max-h-56 overflow-y-auto">
          {value && (
            <button type="button" onClick={() => pick("", "")} className="w-full text-left px-3 py-2 text-small text-text-subtle hover:bg-surface-hover">
              — ล้าง —
            </button>
          )}
          {matches.map((m) => (
            <button
              key={m.projectId}
              type="button"
              onClick={() => pick(m.projectId, m.label)}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
            >
              <div className="text-small truncate">{m.label}</div>
              <div className="text-label text-text-subtle num">{m.projectId}</div>
            </button>
          ))}
          {query && !exactExists && (
            <button
              type="button"
              onClick={createAndPick}
              disabled={creating}
              className="w-full text-left px-3 py-2 border-t border-border text-small text-accent hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={13} strokeWidth={2} />
              {creating ? "กำลังสร้าง…" : `สร้างโครงการใหม่ “${query}”`}
            </button>
          )}
          {!query && matches.length === 0 && (
            <div className="px-3 py-3 text-label text-text-subtle">พิมพ์เพื่อค้นหาโครงการ</div>
          )}
        </div>
      )}
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

// Labeled group divided by a hairline — chunks the form into scannable sections (Shelter-style).
function Section({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3", !first && "border-t border-border pt-4")}>
      <span className="text-small font-medium text-text-muted">{title}</span>
      {children}
    </div>
  );
}
