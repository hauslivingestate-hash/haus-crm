"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, Lock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { useRbac } from "@/components/RbacProvider";
import { useMasterData } from "@/components/MasterDataProvider";
import { POTENTIALS } from "@/lib/masterdata";
import { NEW_LISTING_STATUSES } from "@/lib/newListing";
import type { ListingRow } from "@/lib/queries";
import { updateListing } from "@/lib/mutations/listings";
import { cn } from "@/lib/cn";

// Full listing edit — the แก้ไข button on listing detail, which was disabled until now.
//
// Covers the whole editable surface of `v_main_listing` (55 columns), grouped the same way
// the detail page reads: สถานะ · ข้อมูลทรัพย์ · ราคา · เจ้าของ · การตลาด. The short intake
// form (`ListingForm`) stays deliberately short — it captures what a sale knows at sourcing;
// the long tail belongs here.
//
// Save writes through `updateListing` (lib/mutations/listings.ts) — the base table
// `main_4_listing_database`, not the read-only view this form loads from. That action is also
// the permission boundary (which fields a marketing-only vs listings.edit caller may touch),
// not just the `disabled` props below — never trust the client for that.
//
// Read-only fields (id, days on market, created/updated timestamps, zone display names,
// project/owner FK ids) are shown but not editable — they're derived or joined.
//
// `project_name_eng` is also read-only here on purpose: it lives on main_3_property_detail,
// shared by every listing in the project, so editing it from one listing would rename the
// project for all of them. Edit it from the project itself instead (not built yet).

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Editable subset — everything the view exposes that a human maintains. */
type Draft = Record<string, string | boolean | null>;

const TEXT = (v: unknown) => (v == null ? "" : String(v));

function toDraft(l: ListingRow): Draft {
  return {
    listing_name: TEXT(l.listing_name),
    listing_status: TEXT(l.listing_status),
    potential: TEXT(l.potential),
    listing_type: TEXT(l.listing_type),
    owner_focus: !!l.owner_focus,
    project_name_eng: TEXT(l.project_name_eng),
    zone: TEXT(l.zone),
    in_out_project: TEXT(l.in_out_project),
    road_soi: TEXT(l.road_soi),
    link_location: TEXT(l.link_location),
    property_type: TEXT(l.property_type),
    unit_no: TEXT(l.unit_no),
    bed: TEXT(l.bed),
    bath: TEXT(l.bath),
    area_rai: TEXT(l.area_rai),
    area_ngan: TEXT(l.area_ngan),
    area_wa: TEXT(l.area_wa),
    area_sqm: TEXT(l.area_sqm),
    floor: TEXT(l.floor),
    building: TEXT(l.building),
    direction: TEXT(l.direction),
    view_type: TEXT(l.view_type),
    unit_position: TEXT(l.unit_position),
    parking: TEXT(l.parking),
    unit_condition: TEXT(l.unit_condition),
    asking_price: TEXT(l.asking_price),
    rental_price: TEXT(l.rental_price),
    old_price: TEXT(l.old_price),
    new_price: TEXT(l.new_price),
    update_remark: TEXT(l.update_remark),
    price_remark: TEXT(l.price_remark),
    owner_name: TEXT(l.owner_name),
    owner_phone: TEXT(l.owner_phone),
    owner_line: TEXT(l.owner_line),
    owner_talk_last_date: TEXT(l.owner_talk_last_date),
    activity_comment: TEXT(l.activity_comment),
    sign: !!l.sign,
    vdo: !!l.vdo,
    ddproperty_link: TEXT(l.ddproperty_link),
    livinginsider_link: TEXT(l.livinginsider_link),
    livinginsider_date: TEXT(l.livinginsider_date),
    propertyhub_link: TEXT(l.propertyhub_link),
    shorts_reels_link: TEXT(l.shorts_reels_link),
    hometour_link: TEXT(l.hometour_link),
    remark: TEXT(l.remark),
  };
}

export function ListingEditSheet({
  listing,
  open,
  onClose,
}: {
  listing: ListingRow;
  open: boolean;
  onClose: () => void;
}) {
  const { can } = useRbac();
  // Zones come from the DB via MasterDataProvider. The old lib/zones sample listed 12
  // zones against the real 30, and FOUR of its codes were not in `zone` at all — picking
  // one of those failed the FK the moment you pressed save.
  const { propertyTypes, zones } = useMasterData();
  const router = useRouter();
  const [f, setF] = React.useState<Draft>(() => toDraft(listing));
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Reset the draft when the sheet OPENS — not on every `listing` prop update while it's
  // already open. A successful save calls router.refresh(), which flows a fresh `listing`
  // back down; keying this on the object itself would immediately wipe the "บันทึกแล้ว"
  // state (and any in-progress edit) the moment that fresher prop arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open) {
      setF(toDraft(listing));
      setDone(false);
      setError(null);
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

  const set = (patch: Draft) => setF((x) => ({ ...x, ...patch }));
  const S = (k: string) => (f[k] as string) ?? "";
  const B = (k: string) => !!f[k];

  // Marketing-ops fields belong to Marketing / Listing Support, not a sale. Everyone with
  // listings.view still SEES them on the detail page — this only gates editing.
  const canMarketing = can("listings.marketing");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Only send what actually changed — the server re-diffs against the live row anyway, this
    // just keeps the payload small.
    const original = toDraft(listing);
    const patch: Draft = {};
    for (const k of Object.keys(f)) if (f[k] !== original[k]) patch[k] = f[k];

    setBusy(true);
    setError(null);
    const result = await updateListing(listing.listing_id, patch);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-2xl bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="text-label uppercase text-text-subtle num">{listing.listing_id}</div>
            <div className="text-h3 truncate">แก้ไขทรัพย์</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-5">
          <Section title="สถานะ">
            <Field label="ชื่อทรัพย์" wide>
              {/* Read-only for the same reason as โครงการ below: this is the project's Thai
                  name coming through the view, not a column on the listing. */}
              <Input value={S("listing_name")} disabled className="opacity-60" />
              <span className="text-label text-text-subtle inline-flex items-center gap-1 mt-0.5">
                <Lock size={11} strokeWidth={1.75} /> ชื่อมาจากโครงการ — เปลี่ยนได้ที่โครงการ
              </span>
            </Field>
            <Field label="สถานะประกาศ">
              <select value={S("listing_status")} onChange={(e) => set({ listing_status: e.target.value })} className={field}>
                <option value="">—</option>
                {[...new Set([...NEW_LISTING_STATUSES, S("listing_status")].filter(Boolean))].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Potential">
              <select value={S("potential")} onChange={(e) => set({ potential: e.target.value })} className={field}>
                <option value="">—</option>
                {POTENTIALS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="ประเภทประกาศ">
              <Input value={S("listing_type")} onChange={(e) => set({ listing_type: e.target.value })} placeholder="Sale / Rent / Sale & Rent…" />
            </Field>
            <Field label="ติดตามเจ้าของ">
              <Toggle on={B("owner_focus")} onChange={(v) => set({ owner_focus: v })} label="Owner Focus" />
            </Field>
          </Section>

          <Section title="ทำเล">
            <Field label="โครงการ">
              <Input value={S("project_name_eng")} disabled className="opacity-60" />
              <span className="text-label text-text-subtle inline-flex items-center gap-1 mt-0.5">
                <Lock size={11} strokeWidth={1.75} /> ใช้ร่วมกับทรัพย์อื่นในโครงการเดียวกัน แก้ไม่ได้ตรงนี้
              </span>
            </Field>
            <Field label="โซน">
              {/* Union the stored value in: a zone code the master list no longer carries
                  would otherwise render as "—" and silently save as empty on the next edit. */}
              <select value={S("zone")} onChange={(e) => set({ zone: e.target.value })} className={field}>
                <option value="">—</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))}
                {S("zone") && !zones.some((z) => z.id === S("zone")) && (
                  <option value={S("zone")}>{S("zone")} (ไม่อยู่ในรายการ)</option>
                )}
              </select>
            </Field>
            <Field label="ใน/นอกโครงการ">
              <select value={S("in_out_project")} onChange={(e) => set({ in_out_project: e.target.value })} className={field}>
                <option value="">—</option>
                <option value="ในโครงการ">ในโครงการ</option>
                <option value="นอกโครงการ">นอกโครงการ</option>
              </select>
            </Field>
            <Field label="ถนน / ซอย">
              <Input value={S("road_soi")} onChange={(e) => set({ road_soi: e.target.value })} />
            </Field>
            <Field label="ลิงก์แผนที่" wide>
              <Input value={S("link_location")} onChange={(e) => set({ link_location: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
            </Field>
          </Section>

          <Section title="ข้อมูลทรัพย์">
            <Field label="ประเภททรัพย์">
              {/* Same guard as zone: a listing may store a type that was later removed from
                  the governed list — keep it selectable rather than blanking the field. */}
              <select value={S("property_type")} onChange={(e) => set({ property_type: e.target.value })} className={field}>
                <option value="">—</option>
                {propertyTypes.map((p) => <option key={p.id} value={p.label}>{p.label}</option>)}
                {S("property_type") && !propertyTypes.some((p) => p.label === S("property_type")) && (
                  <option value={S("property_type")}>{S("property_type")} (ไม่อยู่ในรายการ)</option>
                )}
              </select>
            </Field>
            <Field label="บ้านเลขที่ / ยูนิต">
              <Input value={S("unit_no")} onChange={(e) => set({ unit_no: e.target.value })} />
            </Field>
            <Field label="นอน"><Num value={S("bed")} onChange={(v) => set({ bed: v })} /></Field>
            <Field label="น้ำ"><Num value={S("bath")} onChange={(v) => set({ bath: v })} /></Field>
            <Field label="ไร่"><Num value={S("area_rai")} onChange={(v) => set({ area_rai: v })} /></Field>
            <Field label="งาน"><Num value={S("area_ngan")} onChange={(v) => set({ area_ngan: v })} /></Field>
            <Field label="ตร.วา"><Num value={S("area_wa")} onChange={(v) => set({ area_wa: v })} /></Field>
            <Field label="ตร.ม. ใช้สอย"><Num value={S("area_sqm")} onChange={(v) => set({ area_sqm: v })} /></Field>
            <Field label="ชั้น">
              <Input value={S("floor")} onChange={(e) => set({ floor: e.target.value })} />
            </Field>
            <Field label="อาคาร">
              <Input value={S("building")} onChange={(e) => set({ building: e.target.value })} />
            </Field>
            <Field label="ทิศ">
              <Input value={S("direction")} onChange={(e) => set({ direction: e.target.value })} />
            </Field>
            <Field label="วิว">
              <Input value={S("view_type")} onChange={(e) => set({ view_type: e.target.value })} />
            </Field>
            <Field label="ตำแหน่ง">
              <Input value={S("unit_position")} onChange={(e) => set({ unit_position: e.target.value })} placeholder="มุม / กลาง…" />
            </Field>
            <Field label="จอดรถ (คัน)"><Num value={S("parking")} onChange={(v) => set({ parking: v })} /></Field>
            <Field label="สภาพห้อง">
              <Input value={S("unit_condition")} onChange={(e) => set({ unit_condition: e.target.value })} placeholder="Great / Good / Bad" />
            </Field>
            <Field label="หมายเหตุ" wide>
              <textarea
                value={S("remark")}
                onChange={(e) => set({ remark: e.target.value })}
                rows={2}
                className={cn(field, "h-auto py-2 resize-none")}
              />
            </Field>
          </Section>

          <Section title="ราคา">
            <Field label="ราคาขาย (฿)"><Num value={S("asking_price")} onChange={(v) => set({ asking_price: v })} /></Field>
            <Field label="ค่าเช่า / เดือน (฿)"><Num value={S("rental_price")} onChange={(v) => set({ rental_price: v })} /></Field>
            <Field label="ราคาเดิม (฿)"><Num value={S("old_price")} onChange={(v) => set({ old_price: v })} /></Field>
            <Field label="ราคาใหม่ (฿)"><Num value={S("new_price")} onChange={(v) => set({ new_price: v })} /></Field>
            <Field label="เหตุผลที่ปรับราคา" wide>
              <Input value={S("update_remark")} onChange={(e) => set({ update_remark: e.target.value })} />
            </Field>
            <Field label="เงื่อนไขราคา" wide>
              <Input value={S("price_remark")} onChange={(e) => set({ price_remark: e.target.value })} placeholder="เช่น 50/50 Transfer Fee" />
            </Field>
          </Section>

          <Section
            title="เจ้าของ"
            note={
              listing.owner_id == null ? (
                <span className="text-label text-text-subtle">ยังไม่มีเจ้าของผูกไว้ — กรอกแล้วบันทึกเพื่อสร้างใหม่</span>
              ) : undefined
            }
          >
            <Field label="ชื่อเจ้าของ">
              <Input value={S("owner_name")} onChange={(e) => set({ owner_name: e.target.value })} />
            </Field>
            <Field label="เบอร์โทร">
              <Input value={S("owner_phone")} onChange={(e) => set({ owner_phone: e.target.value })} inputMode="tel" className="num" />
            </Field>
            <Field label="LINE">
              <Input value={S("owner_line")} onChange={(e) => set({ owner_line: e.target.value })} />
            </Field>
            <Field label="คุยล่าสุด">
              <input
                type="date"
                value={S("owner_talk_last_date")}
                onChange={(e) => set({ owner_talk_last_date: e.target.value })}
                className={field}
              />
            </Field>
            <Field label="บันทึกการคุย" wide>
              <textarea
                value={S("activity_comment")}
                onChange={(e) => set({ activity_comment: e.target.value })}
                rows={2}
                className={cn(field, "h-auto py-2 resize-none")}
              />
            </Field>
          </Section>

          <Section
            title="การตลาด"
            note={
              canMarketing ? undefined : (
                <span className="inline-flex items-center gap-1 text-label text-text-subtle">
                  <Lock size={11} strokeWidth={1.75} /> เฉพาะการตลาด / Listing Support
                </span>
              )
            }
          >
            <Field label="ป้าย">
              <Toggle on={B("sign")} onChange={(v) => set({ sign: v })} label="ติดป้ายแล้ว" disabled={!canMarketing} />
            </Field>
            <Field label="วิดีโอ">
              <Toggle on={B("vdo")} onChange={(v) => set({ vdo: v })} label="มีวิดีโอ" disabled={!canMarketing} />
            </Field>
            <Field label="DDproperty" wide>
              <Input value={S("ddproperty_link")} onChange={(e) => set({ ddproperty_link: e.target.value })} disabled={!canMarketing} />
            </Field>
            <Field label="Livinginsider" wide>
              <Input value={S("livinginsider_link")} onChange={(e) => set({ livinginsider_link: e.target.value })} disabled={!canMarketing} />
            </Field>
            <Field label="วันที่ลง Livinginsider">
              <input
                type="date"
                value={S("livinginsider_date")}
                onChange={(e) => set({ livinginsider_date: e.target.value })}
                disabled={!canMarketing}
                className={cn(field, !canMarketing && "opacity-60")}
              />
            </Field>
            <Field label="PropertyHub" wide>
              <Input value={S("propertyhub_link")} onChange={(e) => set({ propertyhub_link: e.target.value })} disabled={!canMarketing} />
            </Field>
            <Field label="Shorts / Reels" wide>
              <Input value={S("shorts_reels_link")} onChange={(e) => set({ shorts_reels_link: e.target.value })} disabled={!canMarketing} />
            </Field>
            <Field label="Hometour" wide>
              <Input value={S("hometour_link")} onChange={(e) => set({ hometour_link: e.target.value })} disabled={!canMarketing} />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-border shrink-0">
          {error ? (
            <div className="flex-1 rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-center gap-1.5">
              <AlertCircle size={14} strokeWidth={2} /> {error}
            </div>
          ) : done ? (
            <div className="flex-1 rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
              <Check size={14} strokeWidth={2} /> บันทึกแล้ว
            </div>
          ) : (
            <span className="flex-1" />
          )}
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-border-strong text-text-muted hover:bg-surface-2 transition-colors">
            ปิด
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-label uppercase text-text-subtle">{title}</div>
        {note}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1.5 min-w-0", wide && "col-span-2 sm:col-span-4")}>
      <span className="text-label text-text-subtle">{label}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="num" />;
}

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "h-9 px-3 rounded-md border text-small inline-flex items-center gap-1.5 transition-colors",
        on ? "bg-green-bg text-green border-green/30" : "border-border-strong text-text-muted hover:bg-surface-2",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {on && <Check size={13} strokeWidth={2.5} />}
      {label}
    </button>
  );
}

/** Header button — client island so the server-rendered detail page can open the sheet. */
export function ListingEditButton({ listing }: { listing: ListingRow }) {
  const { can } = useRbac();
  const [open, setOpen] = React.useState(false);
  if (!can("listings.edit")) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-8 px-3 rounded-md border border-border-strong text-small font-medium text-text-muted hover:bg-surface-2 transition-colors"
      >
        แก้ไข
      </button>
      <ListingEditSheet listing={listing} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
