"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Check, AlertCircle } from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Input } from "@/components/ui/Input";
import { updateLead } from "@/lib/mutations/leads";
import { useTopmostEscape } from "@/lib/overlayStack";

const LEAD_TYPES = ["Buyer - Buy", "Buyer - Rent", "Co-Agent"];
const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/* Edit an existing lead's core fields. Follows the app's bottom-sheet form pattern — same
   busy/error/done shape as ListingEditSheet.tsx.
 *
 * ── WHAT THIS FORM DELIBERATELY DOES NOT OWN ────────────────────────────────────
 * ขั้นตอน, สถานะ and Potential are NOT here. They live in the จัดการ card, one tap each,
 * and they used to be in both places at once — a pill that saved the moment you touched it
 * sitting above a dropdown that saved on บันทึก, for the same field. Change it here, close
 * without saving, and nobody could say what the lead now held.
 *
 * The stage dropdown also carried the closing-price prompt, which wrote a Last Match
 * record. That was a second way to close a deal, recording a different half of it from the
 * การปิดการขาย card — see components/CloseDealCard.tsx, which is now the only one. */
export function LeadEditSheet({ open, lead, onClose }: { open: boolean; lead: CrmRow; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = React.useState(() => draftOf(lead));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  // Reset on OPEN only, not on every `lead` prop update while already open — router.refresh()
  // after a successful save flows a fresher `lead` back down, and keying this on the object
  // itself would wipe the just-set "บันทึกแล้ว" state (see ListingEditSheet.tsx for the bug
  // this avoids).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open) {
      setF(draftOf(lead));
      setBusy(false);
      setError(null);
      setDone(false);
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

  if (!open) return null;
  const set = (patch: Partial<ReturnType<typeof draftOf>>) => setF((x) => ({ ...x, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const original = draftOf(lead);
    const patch: Record<string, string> = {};
    for (const k of Object.keys(f)) {
      if (f[k as keyof typeof f] !== original[k as keyof typeof original]) {
        patch[k] = f[k as keyof typeof f];
      }
    }

    setBusy(true);
    setError(null);
    try {
      const result = await updateLead(lead.lead_id, patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      // A rejected server action is not the same as { ok: false } — without this the sheet
      // would sit on "กำลังบันทึก…" with nothing said.
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

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
          <Field label="งบประมาณ (฿)">
            <Input value={f.budget} onChange={(e) => set({ budget: e.target.value.replace(/[^\d.]/g, "") })} inputMode="numeric" className="num" />
          </Field>
        </div>

        {/* Said once, where someone would otherwise go looking for the missing dropdowns. */}
        <p className="text-label text-text-subtle">
          ขั้นตอน สถานะ และ Potential แก้ได้ที่การ์ด “จัดการ” — กดครั้งเดียวบันทึกทันที
        </p>

        {error ? (
          <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-center gap-1.5">
            <AlertCircle size={14} strokeWidth={2} /> {error}
          </div>
        ) : done ? (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> บันทึกแล้ว
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors mt-1 disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </form>
    </div>
  );
}

/* The fields this form owns — and ONLY those. `submit` diffs the draft against this, so a
   key removed here can no longer be written from this sheet at all, which is the point:
   ขั้นตอน / สถานะ / Potential belong to the จัดการ card. */
function draftOf(l: CrmRow) {
  return {
    lead_name: l.lead_name ?? "",
    phone: l.phone ?? "",
    line_id: l.line_id ?? "",
    lead_type: l.lead_type ?? "Buyer - Buy",
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
