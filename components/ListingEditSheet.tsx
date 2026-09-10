"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useRbac } from "@/components/RbacProvider";
import type { ListingRow } from "@/lib/queries";
import { updateListing } from "@/lib/mutations/listings";
import {
  LISTING_FIELDS,
  LISTING_SECTIONS,
  type ListingFieldGroup,
} from "@/lib/listingFields";
import { ListingSectionBlock, type DraftValue } from "@/components/ListingFieldInput";
import { useTopmostEscape } from "@/lib/overlayStack";

// แก้ไขทรัพย์ — the same field set as เพิ่มทรัพย์, from lib/listingFields.ts.
//
// Both screens used to keep their own hand-written list, which is how the add form ended up
// offering 14 fields against this one's 44 (Ben, 2026-08-23). One list now feeds both forms
// and both mutations; every section is open here because someone editing is looking for a
// specific field rather than filling a blank record.
//
// Save writes through `updateListing` — the base table main_4_listing_database, not the
// read-only view this loads from. That action is also the permission boundary (which fields
// a marketing-only vs listings.edit caller may touch), not the `disabled` props below.
//
// Read-only and therefore NOT in the shared list: listing_id, days on market, timestamps,
// zone display names, and the project's name — the last because it lives on
// main_3_property_detail and is shared by every listing in the project, so editing it from
// one listing would rename it for all of them.

type Draft = Record<string, DraftValue>;

/* Fields the จัดการ card owns, so this form must not offer them too.
   Both are one-tap pills sitting a few centimetres above this sheet's own dropdown for the
   same column — a pill that saves on touch, a dropdown that saves on บันทึก. Change it in
   the form, close without saving, and nobody can say what the listing now holds.
   NOT excluded from the ADD form: a listing being created has no จัดการ card to set them
   in, and its opening status is a real thing to choose. */
const OWNED_BY_MANAGE_CARD: ReadonlySet<string> = new Set(["listing_status", "owner_stage"]);

const TEXT = (v: unknown) => (v == null ? "" : String(v));

function toDraft(l: ListingRow): Draft {
  const out: Draft = {};
  const row = l as unknown as Record<string, unknown>;
  for (const f of LISTING_FIELDS) {
    out[f.key] = f.kind === "boolean" ? !!row[f.key] : TEXT(row[f.key]);
  }
  return out;
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
  const router = useRouter();
  const [f, setF] = React.useState<Draft>(() => toDraft(listing));
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Reset the draft when the sheet OPENS — not on every `listing` prop update while it is
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

  // Escape is handled by the overlay stack, not by a bare document listener: this sheet
  // can open INSIDE the detail drawer, and two listeners meant one key press closed both.
  // See lib/overlayStack.ts.
  useTopmostEscape(onClose, open);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const setField = (key: string, value: DraftValue) => setF((x) => ({ ...x, [key]: value }));

  // Presentation only — updateListing enforces the same split server-side.
  const canEditGroup = (group: ListingFieldGroup) =>
    group === "marketing"
      ? can("listings.marketing") || can("roles.manage")
      : can("listings.edit") || can("roles.manage");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Only send what actually changed — the server re-diffs against the live row anyway,
    // this just keeps the payload small.
    const original = toDraft(listing);
    const patch: Draft = {};
    for (const k of Object.keys(f)) if (f[k] !== original[k]) patch[k] = f[k];

    setBusy(true);
    setError(null);
    try {
      const result = await updateListing(listing.listing_id, patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      // A rejected server action is not the same as { ok: false } — without this the sheet
      // would sit on "กำลังบันทึก…" saying nothing.
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-2xl bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop flex flex-col max-h-[92vh]"
      >
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

        <div className="overflow-y-auto p-4 flex flex-col gap-3">
          {/* The name comes from the project, shared by every listing in it — shown so the
              sheet identifies what is being edited, never editable from here. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-label text-text-muted">ชื่อทรัพย์ (จากโครงการ)</span>
            <Input value={TEXT(listing.listing_name)} disabled className="opacity-60" />
          </label>

          {LISTING_SECTIONS.map((section) => (
            <ListingSectionBlock
              key={section.key}
              section={section}
              draft={f}
              onChange={setField}
              canEditGroup={canEditGroup}
              defaultOpen
              exclude={OWNED_BY_MANAGE_CARD}
            />
          ))}

          {/* Said once, where someone would otherwise hunt for the two missing dropdowns. */}
          <p className="text-label text-text-subtle">
            สถานะประกาศ และ ไปป์ไลน์เจ้าของ แก้ได้ที่การ์ด “จัดการ” — กดครั้งเดียวบันทึกทันที
          </p>

          {error && (
            <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-start gap-1.5">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {done && (
            <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
              <Check size={14} strokeWidth={2} /> บันทึกแล้ว
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md border border-border-strong text-text-muted font-medium hover:bg-surface-2 transition-colors"
          >
            ปิด
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-10 px-5 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// The แก้ไข button on the listing detail page — gated on listings.edit so a viewer who
// cannot change anything is not offered a form that would refuse every field.
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
