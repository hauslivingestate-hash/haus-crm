"use client";

import * as React from "react";
import { X, Zap } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { ActionGroupRow } from "@/lib/plan";
import { type TargetKind } from "@/lib/momentum";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// Personal (stretch) goals are simple: a count or a baht amount. Ratio/KPI goals are
// leadership-set only, so they're not offered here.
export interface GoalDraft {
  label: string;
  kind: Extract<TargetKind, "count" | "baht">;
  target: number;
  /** count: auto from the activity log, or a manual +1 tally.
   *  baht: auto from the agent's own signed commission.
   *
   *  ⚠️ A baht goal used to be saved as source "pipeline", which `targetCurrent()` reads
   *  as a STORED number — and nothing ever wrote that number, so every baht goal sat at
   *  ฿0 for ever. It is now "revenue", which is computed live from the same query the
   *  dashboard's เป้ารายได้ card uses. */
  source: "activity" | "revenue" | "manual";
  activityType?: string;
}

const KINDS: { value: GoalDraft["kind"]; label: string }[] = [
  { value: "count", label: "จำนวนครั้ง" },
  { value: "baht", label: "ยอดเงิน (฿)" },
];

export function GoalDetailSheet({
  open,
  actionGroups,
  onSubmit,
  onClose,
}: {
  open: boolean;
  /** The governed action vocabulary from `action_type` — `targets.activity_type` is an FK
   *  to it, so an option that isn't in this list would fail the insert. */
  actionGroups: ActionGroupRow[];
  onSubmit: (values: GoalDraft) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [kind, setKind] = React.useState<GoalDraft["kind"]>("count");
  const [target, setTarget] = React.useState("");
  const [activityType, setActivityType] = React.useState("");

  // Re-seed each time the sheet opens.
  React.useEffect(() => {
    if (!open) return;
    setLabel("");
    setKind("count");
    setTarget("");
    setActivityType("");
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

  const targetNum = Number(target);
  const canSave = label.trim().length > 0 && targetNum > 0;

  const submit = () => {
    if (!canSave) return;
    onSubmit(
      kind === "baht"
        ? // Revenue tracks actual system revenue — no activity link, no manual tally.
          { label: label.trim(), kind, target: targetNum, source: "revenue" }
        : {
            label: label.trim(),
            kind,
            target: targetNum,
            source: activityType ? "activity" : "manual",
            activityType: activityType || undefined,
          }
    );
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="text-h2">เพิ่มเป้าหมายส่วนตัว</div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <Field label="ชื่อเป้าหมาย">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="เช่น ถ่าย Reels, ปิดดีลเงินสด"
            autoFocus
          />
        </Field>

        <Field label="ประเภท">
          <div className="flex gap-1.5">
            {KINDS.map((k) => (
              <Chip key={k.value} on={kind === k.value} onClick={() => setKind(k.value)}>
                {k.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={kind === "baht" ? "เป้าหมาย (บาท)" : "เป้าหมาย (ครั้ง)"}>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={kind === "baht" ? "500000" : "10"}
            className={cn(field, "num")}
          />
        </Field>

        {kind === "count" ? (
          /* Optional auto-track: linking a CRM action makes progress fill from the
             activity log automatically (a ⚡ auto goal) instead of a manual +1 tally. */
          <Field label="อัปเดตอัตโนมัติจากกิจกรรม (ไม่บังคับ)">
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className={field}
            >
              <option value="">— นับเอง (+1) —</option>
              {actionGroups.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {activityType && (
              <p className="text-label text-green mt-1.5 inline-flex items-center gap-1">
                <Zap size={11} strokeWidth={2} /> จะนับจากกิจกรรม “{activityType}” อัตโนมัติ
              </p>
            )}
          </Field>
        ) : (
          /* Revenue goals auto-track the agent's actual revenue in the system — no
             activity link, no manual +1 tally. */
          <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-small text-text-muted inline-flex items-center gap-1.5">
            <Zap size={14} strokeWidth={2} className="text-green shrink-0" />
            นับจากรายได้จริงในระบบอัตโนมัติ
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSave}
          className="mt-1 h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          เพิ่มเป้าหมาย
        </button>
      </div>
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 h-8 rounded-md border text-small font-medium transition-colors px-2",
        on ? "bg-text text-background border-text" : "border-border-strong text-text-muted hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}
