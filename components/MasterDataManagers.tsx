"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ConfirmDelete, usageWarning } from "@/components/ui/ConfirmDelete";
import { useMasterData, type RefItem } from "@/components/MasterDataProvider";
import { listActivities, ACTION_GROUPS, NOTE_ACTION, type AttachMode } from "@/lib/actions";
import {
  KPI_TEMPLATES,
  KIND_LABEL,
  SOURCE_LABEL,
  type KpiTemplate,
  type TemplateKind,
  type TemplateSource,
} from "@/lib/masterdata";
import { TAG_TONE_CLASS, TAG_TONE_ORDER, type LeadTag, type TagTone } from "@/lib/tags";
import { cn } from "@/lib/cn";

// ---- Controlled vocabulary list ---------------------------------------------
// Edits the LIVE list (MasterDataProvider) — so deleting a value here really removes it
// from the intake form's dropdowns, while rows already storing it keep their old value
// (display falls back to the raw value). Seed items keep their ids across label renames;
// new custom items use id = label so raw-value fallbacks render cleanly.
function VocabList({
  items,
  onChange,
  placeholder,
  warnFor,
}: {
  items: RefItem[];
  onChange: (next: RefItem[]) => void;
  placeholder: string;
  warnFor?: (label: string) => React.ReactNode;
}) {
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || items.some((x) => x.label === v)) return;
    onChange([...items, { id: v, label: v }]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <Input
            value={it.label}
            onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))}
            className="flex-1"
          />
          <ConfirmDelete
            onDelete={() => onChange(items.filter((x) => x.id !== it.id))}
            confirmLabel={`ลบ “${it.label}”?`}
            warning={warnFor?.(it.label)}
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="flex-1"
        />
        <button
          onClick={add}
          aria-label="เพิ่ม"
          className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// Uncontrolled variant for lists that are NOT provider-backed yet (action types).
function EditableList({
  seed,
  placeholder,
  warnFor,
}: {
  seed: string[];
  placeholder: string;
  warnFor?: (label: string) => React.ReactNode;
}) {
  const [items, setItems] = React.useState<RefItem[]>(() => seed.map((s) => ({ id: s, label: s })));
  return <VocabList items={items} onChange={setItems} placeholder={placeholder} warnFor={warnFor} />;
}

// ---- Titled reference-list card (one controlled vocabulary) -----------------
function RefListCard({
  title,
  note,
  items,
  onChange,
  placeholder,
  warnFor,
}: {
  title: string;
  note?: string;
  items: RefItem[];
  onChange: (next: RefItem[]) => void;
  placeholder: string;
  warnFor?: (label: string) => React.ReactNode;
}) {
  return (
    <Card>
      <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
        <span className="text-h3">{title}</span>
        {note && <span className="text-label text-text-subtle">· {note}</span>}
      </div>
      <CardContent>
        <VocabList items={items} onChange={onChange} placeholder={placeholder} warnFor={warnFor} />
      </CardContent>
    </Card>
  );
}

// ---- Property types ---------------------------------------------------------
// Live list (provider) — the intake form's ประเภททรัพย์ selects read the same list.
// `usage` = live count of listings per property type (from v_main_listing, computed
// server-side on /settings) so the delete confirm states the real impact.
export function PropertyTypesManager({ usage }: { usage?: Record<string, number> }) {
  const { propertyTypes, setPropertyTypes } = useMasterData();
  return (
    <Card>
      <CardContent>
        <VocabList
          items={propertyTypes}
          onChange={setPropertyTypes}
          placeholder="เพิ่มประเภททรัพย์…"
          warnFor={(label) => usageWarning(usage ? (usage[label] ?? 0) : null, "ทรัพย์")}
        />
      </CardContent>
    </Card>
  );
}

// ---- Lead reference fields (Marketing Channel / Contact By / Gender / Nationality) ----
// Live lists (provider) — the intake form (LeadForm) reads the same lists, so removing a
// channel here immediately removes it from the form. main_6_buyer_crm has no matching
// columns yet → usage isn't countable; the confirm warns to check manually (wire the real
// count once the columns land).
export function LeadReferenceManager() {
  const { sources, setSources, contactBys, setContactBys, genders, setGenders, nationalities, setNationalities } =
    useMasterData();
  const unknownLeadUsage = () => usageWarning(null, "ลีด");
  return (
    <div className="flex flex-col gap-4">
      <RefListCard title="Marketing Channel" note="ช่องทางที่ลีดเข้ามา" items={sources} onChange={setSources} placeholder="เพิ่มช่องทาง…" warnFor={unknownLeadUsage} />
      <RefListCard title="Contact By" note="วิธี/กล่องที่ติดต่อเข้ามา" items={contactBys} onChange={setContactBys} placeholder="เพิ่มวิธีติดต่อ…" warnFor={unknownLeadUsage} />
      <RefListCard title="เพศ" items={genders} onChange={setGenders} placeholder="เพิ่ม…" warnFor={unknownLeadUsage} />
      <RefListCard title="สัญชาติ" items={nationalities} onChange={setNationalities} placeholder="เพิ่มสัญชาติ…" warnFor={unknownLeadUsage} />
    </div>
  );
}

// ---- Lead group tag (CEO-governed, single-select) ---------------------------
// Unlike the RefItem lists above, a tag stores its COLOUR: the whole point of a company
// standard is that everyone sees the same tag the same colour, so the tone is chosen here
// rather than derived from a hash. One tag per lead (CEO: "ติดได้คนเดียว"), so this list is
// a set of mutually exclusive groups — see lib/tags.ts.
export function LeadTagsManager() {
  const { leadTags, setLeadTags } = useMasterData();
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const label = draft.trim();
    if (!label || leadTags.some((t) => t.label === label)) return;
    // New tags get id = label so a raw stored value still renders if the label is edited
    // later; seeded tags keep their stable slug ids.
    const tone = TAG_TONE_ORDER[leadTags.length % TAG_TONE_ORDER.length];
    setLeadTags([...leadTags, { id: label, label, tone }]);
    setDraft("");
  };

  const update = (id: string, patch: Partial<LeadTag>) =>
    setLeadTags(leadTags.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <Card>
      <div className="px-4 py-3 border-b border-border">
        <div className="text-h3">แท็กกลุ่มลูกค้า</div>
        <p className="text-label text-text-subtle mt-0.5">
          ลูกค้า 1 คนติดได้ 1 แท็ก · เซลส์เลือกจากรายการนี้เท่านั้น สร้างเองไม่ได้
        </p>
      </div>
      <CardContent className="flex flex-col gap-1.5">
        {leadTags.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <Input
              value={t.label}
              onChange={(e) => update(t.id, { label: e.target.value })}
              className="flex-1"
            />
            <TonePicker value={t.tone} onChange={(tone) => update(t.id, { tone })} label={t.label} />
            <ConfirmDelete
              onDelete={() => setLeadTags(leadTags.filter((x) => x.id !== t.id))}
              confirmLabel={`ลบ “${t.label}”?`}
              warning={usageWarning(null, "ลีด")}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="เพิ่มแท็ก…"
            className="flex-1"
          />
          <button
            onClick={add}
            aria-label="เพิ่ม"
            className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Live preview — what a sale will actually see in the leads table. */}
        <div className="border-t border-border mt-2 pt-3">
          <div className="text-label text-text-subtle mb-1.5">ตัวอย่างที่เซลส์เห็น</div>
          <div className="flex flex-wrap gap-1.5">
            {leadTags.length === 0 ? (
              <span className="text-small text-text-subtle">ยังไม่มีแท็ก</span>
            ) : (
              leadTags.map((t) => (
                <span
                  key={t.id}
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-label font-medium",
                    TAG_TONE_CLASS[t.tone]
                  )}
                >
                  {t.label || "—"}
                </span>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Six-swatch colour picker — the tag's stored tone. */
function TonePicker({
  value,
  onChange,
  label,
}: {
  value: TagTone;
  onChange: (tone: TagTone) => void;
  label: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`สีของแท็ก ${label}`}
        aria-expanded={open}
        className={cn(
          "size-8 rounded-md border border-border-strong grid place-items-center hover:border-accent transition-colors",
          TAG_TONE_CLASS[value]
        )}
      >
        <span className="size-3 rounded-full bg-current" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+4px)] z-50 flex gap-1 p-1.5 rounded-md border border-border bg-surface shadow-pop">
            {TAG_TONE_ORDER.map((t) => (
              <button
                key={t}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                aria-label={t}
                className={cn(
                  "size-6 rounded grid place-items-center border transition-colors",
                  TAG_TONE_CLASS[t],
                  t === value ? "border-text" : "border-transparent hover:border-border-strong"
                )}
              >
                <span className="size-2.5 rounded-full bg-current" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Action types (grouped, with attach mode) -------------------------------
const ATTACH_LABEL: Record<AttachMode, { label: string; tone: "violet" | "accent" | "blue" | "neutral" }> = {
  lead: { label: "ผูกกับลูกค้า", tone: "violet" },
  listing: { label: "ผูกกับทรัพย์", tone: "accent" },
  either: { label: "ลูกค้า/ทรัพย์", tone: "blue" },
  none: { label: "ทั่วไป", tone: "neutral" },
};

export function ActionTypesManager() {
  // Impact = how many logged activities use each action type (sample log; wire to the real
  // activities table count). Not provider-backed yet — local edit only.
  const usedBy = (name: string) => listActivities().filter((a) => a.action === name).length;
  return (
    <div className="flex flex-col gap-4">
      {ACTION_GROUPS.map((g) => (
        <Card key={g.group}>
          <div className="px-4 h-11 flex items-center justify-between border-b border-border">
            <span className="text-h3">{g.group}</span>
            <Pill tone={ATTACH_LABEL[g.attach].tone}>{ATTACH_LABEL[g.attach].label}</Pill>
          </div>
          <CardContent>
            <EditableList seed={g.items} placeholder="เพิ่มกิจกรรม…" warnFor={(it) => usageWarning(usedBy(it), "กิจกรรมที่บันทึกไว้")} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- KPI target templates ---------------------------------------------------
// Loggable actions only — a KPI on the free-note action makes no sense (same rule as
// the probation rank editor).
const KPI_ACTION_OPTIONS = ACTION_GROUPS.filter((g) => !g.items.includes(NOTE_ACTION));

export function KpiTemplatesManager() {
  const [rows, setRows] = React.useState<KpiTemplate[]>(KPI_TEMPLATES);

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        id: `kt_new_${rs.length}`,
        label: "เป้าหมายใหม่",
        kind: "count",
        source: "activity",
        activityType: "Call",
        defaultTarget: 0,
      },
    ]);

  const patch = (id: string, p: Partial<KpiTemplate>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  // Source switch keeps activityType coherent: activity gets a default action;
  // pipeline/manual carry none.
  const setSource = (r: KpiTemplate, source: TemplateSource) =>
    patch(r.id, {
      source,
      activityType: source === "activity" ? (r.activityType ?? "Call") : undefined,
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 flex-wrap">
            <Input
              value={r.label}
              onChange={(e) => patch(r.id, { label: e.target.value })}
              className="flex-1 min-w-[140px]"
            />
            <Select
              value={r.kind}
              onChange={(e) => patch(r.id, { kind: e.target.value as TemplateKind })}
              aria-label="ชนิดการวัด"
              className="w-28"
            >
              {(Object.keys(KIND_LABEL) as TemplateKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </Select>
            <Select
              value={r.source}
              onChange={(e) => setSource(r, e.target.value as TemplateSource)}
              aria-label="แหล่งข้อมูล"
              className="w-40"
            >
              {(Object.keys(SOURCE_LABEL) as TemplateSource[]).map((s) => (
                <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
              ))}
            </Select>
            {/* The linked action — the metric this template counts (same vocabulary as
                ประเภทกิจกรรม / Rank เซลล์ใหม่). Only for activity-sourced templates. */}
            {r.source === "activity" && (
              <Select
                value={r.activityType ?? "Call"}
                onChange={(e) => patch(r.id, { activityType: e.target.value })}
                aria-label="กิจกรรมที่นับ"
                className="w-36"
              >
                {KPI_ACTION_OPTIONS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
            <Input
              value={String(r.defaultTarget)}
              onChange={(e) => patch(r.id, { defaultTarget: Number(e.target.value) || 0 })}
              className="w-24 num text-right"
              inputMode="numeric"
              aria-label="เป้าเริ่มต้น"
            />
            <ConfirmDelete
              onDelete={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              confirmLabel={`ลบ “${r.label}”?`}
              warning="เป้าหมายที่ตั้งจากเทมเพลตนี้ไว้แล้วจะไม่ถูกลบ แต่หัวหน้าจะตั้งเป้าจากเทมเพลตนี้ใหม่ไม่ได้อีก"
            />
          </div>
        ))}
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Plus size={13} strokeWidth={2} /> เพิ่มเทมเพลตเป้าหมาย
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Native select styled to match the Input primitive (same as SalesRankManager).
function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-md border border-border-strong bg-surface px-2 text-body text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring shrink-0",
        className
      )}
      {...props}
    />
  );
}
