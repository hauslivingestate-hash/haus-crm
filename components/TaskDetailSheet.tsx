"use client";

import * as React from "react";
import { X, Trash2, Clock, Repeat } from "lucide-react";
import { Input } from "@/components/ui/Input";
import {
  TASK_TYPES,
  TASK_TYPE_ORDER,
  RECUR_FREQ,
  RECUR_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  listTargets,
  type Task,
  type TaskType,
  type RecurFreq,
} from "@/lib/momentum";
import { ACTION_GROUPS, SAMPLE_LEAD_OPTIONS, SAMPLE_LISTING_OPTIONS } from "@/lib/actions";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export type TaskDraft = Omit<Task, "id" | "agent" | "date" | "done" | "order">;

export function TaskDetailSheet({
  open,
  mode,
  agent,
  initial,
  onSubmit,
  onDelete,
  onClose,
}: {
  open: boolean;
  mode: "add" | "edit";
  agent: string;
  initial?: Task | null;
  onSubmit: (values: TaskDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [type, setType] = React.useState<TaskType>("work");
  const [targetId, setTargetId] = React.useState("");
  const [activityType, setActivityType] = React.useState("");
  const [entityKind, setEntityKind] = React.useState<"none" | "lead" | "listing">("none");
  const [leadId, setLeadId] = React.useState("");
  const [listingId, setListingId] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [freq, setFreq] = React.useState<RecurFreq>("none");
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [dom, setDom] = React.useState(1);

  const targets = listTargets(agent);

  // Re-seed each time the sheet opens.
  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setNotes(initial?.notes ?? "");
    setType(initial?.type ?? "work");
    setTargetId(initial?.targetId ?? "");
    setActivityType(initial?.activityType ?? "");
    setEntityKind(initial?.relatedLeadId ? "lead" : initial?.relatedListingId ? "listing" : "none");
    setLeadId(initial?.relatedLeadId ?? "");
    setListingId(initial?.relatedListingId ?? "");
    setStartTime(initial?.startTime ?? "");
    setEndTime(initial?.endTime ?? "");
    setFreq(initial?.repeat?.freq ?? "none");
    setWeekdays(initial?.repeat?.weekdays ?? []);
    setDom(initial?.repeat?.dayOfMonth ?? 1);
  }, [open, initial]);

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

  const badRange = !!startTime && !!endTime && endTime < startTime;
  const weeklyIncomplete = freq === "weekly" && weekdays.length === 0;
  const canSave = title.trim() && !badRange && !weeklyIncomplete;

  const toggleWeekday = (n: number) =>
    setWeekdays((ws) => (ws.includes(n) ? ws.filter((x) => x !== n) : [...ws, n]));

  const submit = () => {
    if (!canSave) return;
    const leadOpt = SAMPLE_LEAD_OPTIONS.find((o) => o.id === leadId);
    const listingOpt = SAMPLE_LISTING_OPTIONS.find((o) => o.id === listingId);
    onSubmit({
      title: title.trim(),
      notes: notes.trim() || undefined,
      type,
      targetId: targetId || undefined,
      activityType: activityType || undefined,
      relatedLeadId: entityKind === "lead" ? leadId || undefined : undefined,
      relatedLeadName: entityKind === "lead" ? leadOpt?.label.split(" · ")[0] : undefined,
      relatedListingId: entityKind === "listing" ? listingId || undefined : undefined,
      relatedListingName:
        entityKind === "listing" ? listingOpt?.label.split(" · ").slice(1).join(" · ") : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      repeat: freq === "none" ? null : { freq, weekdays: freq === "weekly" ? weekdays : undefined, dayOfMonth: freq === "monthly" ? dom : undefined },
    });
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
          <div className="text-h2">{mode === "add" ? "เพิ่มงาน" : "แก้ไขงาน"}</div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <Field label="หัวข้องาน">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อสั้น ๆ" autoFocus />
        </Field>

        <Field label="ประเภท">
          <div className="flex gap-1.5">
            {TASK_TYPE_ORDER.map((tt) => (
              <Chip key={tt} on={type === tt} onClick={() => setType(tt)}>
                {TASK_TYPES[tt].label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="รายละเอียด (ไม่บังคับ)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="—"
            className={cn(field, "h-auto py-2 resize-none")}
          />
        </Field>

        <Field label="เชื่อมกับเป้าหมายเดือนนี้">
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={field}>
            <option value="">— ไม่เชื่อม —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {/* CRM link — HAUS extension: logging this activity feeds the auto-bridge */}
        <Field label="เชื่อมกับ CRM (ไม่บังคับ)">
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className={cn(field, "mb-2")}
          >
            <option value="">— ไม่มีกิจกรรม —</option>
            {ACTION_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="flex gap-1.5 mb-2">
            {(["none", "lead", "listing"] as const).map((k) => (
              <Chip key={k} on={entityKind === k} onClick={() => setEntityKind(k)}>
                {k === "none" ? "ไม่ผูก" : k === "lead" ? "ลูกค้า" : "ทรัพย์"}
              </Chip>
            ))}
          </div>
          {entityKind === "lead" && (
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={field}>
              <option value="">— เลือกลูกค้า —</option>
              {SAMPLE_LEAD_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {entityKind === "listing" && (
            <select value={listingId} onChange={(e) => setListingId(e.target.value)} className={field}>
              <option value="">— เลือกทรัพย์ —</option>
              {SAMPLE_LISTING_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="เวลา (ไม่บังคับ)">
          <div className="flex items-center gap-2">
            <Clock size={15} strokeWidth={1.75} className="text-text-subtle shrink-0" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={cn(field, "w-auto")} aria-label="เวลาเริ่ม" />
            <span className="text-text-subtle">–</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={cn(field, "w-auto")} aria-label="เวลาสิ้นสุด" />
          </div>
          {badRange && <p className="text-label text-red mt-1.5">เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม</p>}
        </Field>

        <Field label="ทำซ้ำ">
          <div className="flex gap-1.5 flex-wrap">
            {RECUR_ORDER.map((f) => (
              <Chip key={f} on={freq === f} onClick={() => setFreq(f)}>
                <span className="inline-flex items-center gap-1">
                  {f !== "none" && <Repeat size={11} strokeWidth={2} />}
                  {RECUR_FREQ[f].label}
                </span>
              </Chip>
            ))}
          </div>
          {freq === "weekly" && (
            <div className="flex gap-1.5 flex-wrap mt-2.5">
              {WEEKDAY_ORDER.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleWeekday(n)}
                  className={cn(
                    "size-9 rounded-md text-small font-medium border transition-colors",
                    weekdays.includes(n)
                      ? "bg-accent text-text-onaccent border-accent"
                      : "border-border-strong text-text-muted hover:bg-surface-2"
                  )}
                >
                  {WEEKDAY_LABELS[n]}
                </button>
              ))}
            </div>
          )}
          {weeklyIncomplete && <p className="text-label text-red mt-1.5">เลือกอย่างน้อยหนึ่งวัน</p>}
          {freq === "monthly" && (
            <div className="flex items-center gap-2 mt-2.5 text-small text-text-muted">
              ทุกวันที่
              <input
                type="number"
                min={1}
                max={31}
                value={dom}
                onChange={(e) => setDom(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                className={cn(field, "w-20 num text-center")}
              />
              ของเดือน
            </div>
          )}
        </Field>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={submit}
            disabled={!canSave}
            className="flex-1 h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            บันทึก
          </button>
          {mode === "edit" && onDelete && (
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              aria-label="ลบงาน"
              className="size-10 grid place-items-center rounded-md border border-border text-red hover:bg-red-bg transition-colors shrink-0"
            >
              <Trash2 size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
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
