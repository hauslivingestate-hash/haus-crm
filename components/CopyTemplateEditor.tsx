"use client";

import * as React from "react";
import { X, RotateCcw, Pencil } from "lucide-react";
import { useCopyTemplates } from "@/components/CopyTemplatesProvider";
import {
  COPY_GRADES,
  COPY_TYPES,
  COPY_PLACEHOLDERS,
  comboKey,
  splitKey,
  isDefaultTemplate,
  type CopyTemplate,
} from "@/lib/listingCopy";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

// Settings ▸ คำโฆษณา (gated copy.manage). A Grade × Type matrix; each cell opens an editor with
// three fields — Headline / Normal (FB·LV·PropertyHub) / DDproperty — plus placeholder chips that
// insert <tokens> at the cursor. An orange dot marks combos edited away from the code default.
// Shares CopyTemplatesProvider so edits change generated copy everywhere. Design-first: in-memory.

const field =
  "w-full px-3 py-2 rounded-md border border-border-strong bg-surface text-body text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 resize-y";

export function CopyTemplateEditor() {
  const { templates } = useCopyTemplates();
  const [editing, setEditing] = React.useState<string | null>(null);

  return (
    <>
      <Card className="overflow-hidden">
        {/* Column header — types */}
        <div className="grid grid-cols-[92px_repeat(3,1fr)] border-b border-border bg-surface-2">
          <div className="px-3 py-2 text-label uppercase text-text-subtle">ระดับ \ ประเภท</div>
          {COPY_TYPES.map((t) => (
            <div key={t.key} className="px-3 py-2 text-label uppercase text-text-subtle border-l border-border">
              {t.label}
            </div>
          ))}
        </div>
        {/* Grade rows */}
        {COPY_GRADES.map((g) => (
          <div key={g.key} className="grid grid-cols-[92px_repeat(3,1fr)] border-b border-border last:border-b-0">
            <div className="px-3 py-3 text-body font-medium flex items-center">{g.label}</div>
            {COPY_TYPES.map((t) => {
              const key = comboKey(g.key, t.key);
              const edited = !isDefaultTemplate(key, templates[key]);
              return (
                <button
                  key={t.key}
                  onClick={() => setEditing(key)}
                  className="text-left px-3 py-3 border-l border-border hover:bg-surface-hover transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    {edited && <span className="size-1.5 rounded-full bg-amber shrink-0" title="แก้ไขแล้ว" />}
                    <span className="text-small text-text-muted line-clamp-1 flex-1 min-w-0">
                      {templates[key].headline}
                    </span>
                    <Pencil size={13} strokeWidth={1.75} className="text-text-subtle opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </Card>

      {editing && <EditSheet comboKey={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditSheet({ comboKey: key, onClose }: { comboKey: string; onClose: () => void }) {
  const { templates, setTemplate, resetTemplate } = useCopyTemplates();
  const tpl = templates[key];
  const [grade, type] = splitKey(key);
  const gradeLabel = COPY_GRADES.find((g) => g.key === grade)?.label;
  const typeLabel = COPY_TYPES.find((t) => t.key === type)?.label;
  const edited = !isDefaultTemplate(key, tpl);

  // Track which field is focused so a placeholder chip inserts into the right textarea at cursor.
  const refs = {
    headline: React.useRef<HTMLTextAreaElement>(null),
    normalBody: React.useRef<HTMLTextAreaElement>(null),
    ddBody: React.useRef<HTMLTextAreaElement>(null),
  };
  const [focused, setFocused] = React.useState<keyof CopyTemplate>("normalBody");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const insert = (token: string) => {
    const el = refs[focused].current;
    const cur = tpl[focused];
    if (!el) {
      setTemplate(key, { [focused]: cur + token });
      return;
    }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    setTemplate(key, { [focused]: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-h2">คำโฆษณา · {gradeLabel} · {typeLabel}</div>
            <p className="text-small text-text-muted mt-0.5">
              แทนค่า <code className="num">&lt;...&gt;</code> ด้วยข้อมูลของทรัพย์แต่ละรายการ
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Placeholder chips */}
        <div className="flex flex-wrap gap-1.5">
          {COPY_PLACEHOLDERS.map((p) => (
            <button
              key={p}
              onClick={() => insert(p)}
              className="text-label num rounded-md px-2 py-1 border border-border-strong text-text-muted hover:bg-surface-2 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        <FieldLabel label="หัวข้อ (Headline)">
          <textarea
            ref={refs.headline}
            value={tpl.headline}
            onFocus={() => setFocused("headline")}
            onChange={(e) => setTemplate(key, { headline: e.target.value })}
            rows={2}
            className={field}
          />
        </FieldLabel>

        <FieldLabel label="โพสต์ทั่วไป · Facebook / Livinginsider / PropertyHub">
          <textarea
            ref={refs.normalBody}
            value={tpl.normalBody}
            onFocus={() => setFocused("normalBody")}
            onChange={(e) => setTemplate(key, { normalBody: e.target.value })}
            rows={8}
            className={field}
          />
        </FieldLabel>

        <FieldLabel label="DDproperty (ไม่มีอิโมจิ)">
          <textarea
            ref={refs.ddBody}
            value={tpl.ddBody}
            onFocus={() => setFocused("ddBody")}
            onChange={(e) => setTemplate(key, { ddBody: e.target.value })}
            rows={6}
            className={field}
          />
        </FieldLabel>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors"
          >
            เสร็จสิ้น
          </button>
          <button
            onClick={() => resetTemplate(key)}
            disabled={!edited}
            className="h-10 px-3 rounded-md border border-border text-text-muted hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
            title="คืนค่าเริ่มต้น"
          >
            <RotateCcw size={15} strokeWidth={1.75} /> คืนค่าเริ่มต้น
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small text-text-muted">{label}</span>
      {children}
    </label>
  );
}
