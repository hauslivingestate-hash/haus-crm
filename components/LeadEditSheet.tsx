"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Check, AlertCircle } from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Input } from "@/components/ui/Input";
import { STAGES } from "@/lib/pipeline";
import { LEAD_POTENTIALS } from "@/lib/leads";
import { updateLead } from "@/lib/mutations/leads";
import { closeDeal } from "@/lib/mutations/lastMatch";
import { CLOSED_STAGES } from "@/lib/pipeline";
import { cn } from "@/lib/cn";

const LEAD_TYPES = ["Buyer - Buy", "Buyer - Rent", "Co-Agent"];
const LEAD_STATUSES = ["Active", "Win", "Lose", "Reject"];
const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// Edit an existing lead's core fields. Follows the app's bottom-sheet form pattern — same
// busy/error/done shape as ListingEditSheet.tsx.
export function LeadEditSheet({ open, lead, onClose }: { open: boolean; lead: CrmRow; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = React.useState(() => draftOf(lead));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  // The closing price, asked for the moment the stage moves into a closed state.
  const [closePrice, setClosePrice] = React.useState("");

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
      setClosePrice("");
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

  if (!open) return null;
  const set = (patch: Partial<ReturnType<typeof draftOf>>) => setF((x) => ({ ...x, ...patch }));

  // Moving INTO a closed stage from an open one. Re-saving a lead that was already closed
  // does not ask again — that deal is already in the ledger.
  const justClosed =
    CLOSED_STAGES.includes(f.pipeline_stage) && !CLOSED_STAGES.includes(lead.pipeline_stage ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const original = draftOf(lead);
    const patch: Record<string, string> = {};
    for (const k of Object.keys(f)) {
      if (f[k as keyof typeof f] !== original[k as keyof typeof original]) {
        patch[k] = f[k as keyof typeof f];
      }
    }

    // Closing price is required the first time this lead reaches a closed stage. It is the
    // only place a sale price is recorded anywhere in the system, and asking later means
    // asking someone to remember — which is how all 56 imported deals ended up with none.
    const price = Number(closePrice.replace(/[^\d.]/g, ""));
    if (justClosed && !(price > 0)) {
      setError("กรอกราคาปิดก่อน — ตัวเลขนี้เป็นที่เดียวที่ระบบเก็บยอดขาย");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await updateLead(lead.lead_id, patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (justClosed) {
        // The lead is saved either way; a failure here loses the deal row, not the stage.
        const deal = await closeDeal({ leadId: lead.lead_id, price });
        if (!deal.ok) {
          setError(`บันทึกสเตจแล้ว แต่บันทึกดีลไม่สำเร็จ: ${deal.error}`);
          return;
        }
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

        {justClosed && (
          <div className="rounded-md border border-green/30 bg-green-bg/40 p-3 flex flex-col gap-2">
            <div className="text-small font-medium text-green">ปิดดีลได้! กรอกราคาปิดด้วย</div>
            <Input
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="numeric"
              placeholder="เช่น 3500000"
              aria-label="ราคาปิด (บาท)"
              className="num text-right"
              autoFocus
            />
            <p className="text-label text-text-subtle">
              บันทึกลงทะเบียนดีลที่ปิด (Last Match) พร้อมรายละเอียดทรัพย์ที่ลูกค้าสนใจ —
              ถ้ายังไม่รู้ตัวเลขตอนนี้ ให้เปลี่ยนสเตจทีหลังตอนรู้ราคา
            </p>
          </div>
        )}
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
