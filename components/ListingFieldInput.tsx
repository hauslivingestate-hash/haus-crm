"use client";

import * as React from "react";
import { ChevronDown, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useMasterData } from "@/components/MasterDataProvider";
import {
  fieldsInSection,
  type ListingField,
  type ListingSection,
} from "@/lib/listingFields";
import { cn } from "@/lib/cn";

// One renderer for a listing field, shared by เพิ่มทรัพย์ and แก้ไขทรัพย์ so the two screens
// cannot show different things for the same column again.
//
// The `disabled` flag is presentation only. The permission boundary is in
// lib/mutations/listings.ts, which drops fields the caller may not write — never trust a
// disabled input.

const inputClass =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 disabled:cursor-not-allowed";

export type DraftValue = string | boolean | null;

export function ListingFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ListingField;
  value: DraftValue;
  onChange: (next: DraftValue) => void;
  disabled?: boolean;
}) {
  const master = useMasterData();

  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2 h-9 text-body text-text-muted">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
        {field.label}
      </label>
    );
  }

  const text = value == null || value === false ? "" : String(value);

  const control = () => {
    if (field.kind === "select") {
      // Every one of these is FK-backed, so the options come from the table. A hand-written
      // list here is how "ทิศเหนือ" got typed into a column whose only legal values are
      // North/South/East/West.
      const options =
        field.options?.map((o) => ({ id: o, label: o })) ??
        (field.lookup ? (master[field.lookup] ?? []) : []);
      // Union the stored value in: a code the master list no longer carries would otherwise
      // render as blank and be saved as empty on the next edit.
      const known = options.some((o) => o.id === text);
      return (
        <select
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{field.required ? "— เลือก —" : "— ไม่ระบุ —"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
          {text && !known && <option value={text}>{text} (ไม่อยู่ในรายการ)</option>}
        </select>
      );
    }
    if (field.kind === "textarea") {
      return (
        <textarea
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={field.placeholder}
          className={cn(inputClass, "h-auto py-2 resize-none")}
        />
      );
    }
    if (field.kind === "date") {
      return (
        <input
          type="date"
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    }
    const numeric = field.kind === "integer" || field.kind === "numeric";
    return (
      <Input
        value={text}
        disabled={disabled}
        onChange={(e) =>
          onChange(numeric ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)
        }
        inputMode={numeric ? "numeric" : undefined}
        placeholder={field.placeholder}
        className={numeric ? "num" : undefined}
      />
    );
  };

  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-label text-text-muted inline-flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red">*</span>}
        {disabled && <Lock size={10} strokeWidth={2} className="text-text-subtle" />}
      </span>
      {control()}
      {field.hint && <span className="text-label text-text-subtle">{field.hint}</span>}
    </label>
  );
}

/**
 * A collapsible group of fields.
 *
 * Ben chose grouped-with-folding for the add form: 44 fields in one column is unusable on a
 * phone, and roughly a third of them (portal links, price history) cannot be known at the
 * moment a listing is created.
 */
export function ListingSectionBlock({
  section,
  draft,
  onChange,
  canEditGroup,
  defaultOpen,
  exclude,
  children,
}: {
  section: ListingSection;
  draft: Record<string, DraftValue>;
  onChange: (key: string, value: DraftValue) => void;
  /** Whether the viewer may write this permission group. */
  canEditGroup: (group: ListingField["group"]) => boolean;
  defaultOpen: boolean;
  /** Field keys to leave out, because another control on the same screen already owns
      them. The EDIT sheet drops สถานะประกาศ and ไปป์ไลน์เจ้าของ — the จัดการ card sits
      right above it and saves them on a single tap, and one field with two save rules on
      one screen is how a screen starts disagreeing with itself. The ADD form passes
      nothing, because there is no จัดการ card on a listing that does not exist yet. */
  exclude?: ReadonlySet<string>;
  /** Extra content for the section — the project picker, the photo picker. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const all = fieldsInSection(section.key);
  const fields = exclude ? all.filter((f) => !exclude.has(f.key)) : all;
  // A section excluded down to nothing would render as a header opening onto an empty box.
  // Neither current caller can reach this; it is here so the next one cannot either.
  if (!fields.length && !children) return null;
  // How many of this section's fields already carry something — so a folded section can say
  // it is not empty rather than hiding data.
  const filled = fields.filter((f) => {
    const v = draft[f.key];
    return f.kind === "boolean" ? v === true : !!v;
  }).length;

  return (
    // ⚠️ `shrink-0` is load-bearing. These sit in a flex column with a capped height, so
    // without it flex shrinks each section to fit and the rounded corners' overflow-hidden
    // CLIPS the fields that no longer fit — you could not see or scroll to them
    // (Ben, 2026-08-23: "เปิดแล้วเห็นไม่หมด"). The form scrolls; the sections do not.
    <div className="shrink-0 rounded-md border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 h-10 bg-surface-2/60 hover:bg-surface-2 transition-colors text-left"
      >
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={cn("text-text-subtle transition-transform", !open && "-rotate-90")}
        />
        <span className="text-small font-medium">{section.label}</span>
        {filled > 0 && (
          <span className="num text-label text-accent">กรอกแล้ว {filled}</span>
        )}
        {section.hint && (
          <span className="text-label text-text-subtle ml-auto hidden sm:inline">
            {section.hint}
          </span>
        )}
      </button>
      {open && (
        <div className="p-3 flex flex-col gap-3">
          {children}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={cn(f.span === 1 ? "col-span-1" : "col-span-2 sm:col-span-1")}>
                <ListingFieldInput
                  field={f}
                  value={draft[f.key] ?? ""}
                  onChange={(v) => onChange(f.key, v)}
                  disabled={!canEditGroup(f.group)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
