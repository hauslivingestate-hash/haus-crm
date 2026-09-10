"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ConfirmDelete, usageWarning } from "@/components/ui/ConfirmDelete";
import { useRouter } from "next/navigation";
import { useMasterData, type RefItem } from "@/components/MasterDataProvider";
import { type AttachMode } from "@/lib/actions";
import {
  addLookupValue,
  renameLookupValue,
  deleteLookupValue,
  saveLeadTag,
  deleteLeadTag,
  type LookupTable,
} from "@/lib/mutations/reference";
import {
  KIND_LABEL,
  SOURCE_LABEL,
  type KpiTemplate,
  type TemplateKind,
  type TemplateSource,
} from "@/lib/masterdata";
import { saveKpiTemplates } from "@/lib/mutations/kpiTemplates";
import { TAG_TONE_CLASS, TAG_TONE_ORDER, type LeadTag, type TagTone } from "@/lib/tags";
import { cn } from "@/lib/cn";

// ---- Server-backed vocabulary list -----------------------------------------
//
// Every list on this screen writes to its own lookup table. They used to write to React
// state, which made the delete-confirm's promise true for exactly one page view.
//
// WARNING: the PK of these tables IS the label (project convention: dropdowns show words,
// not numbers), and every FK to them is ON UPDATE CASCADE. Renaming here therefore rewrites
// the value on every row that holds it — a typo fixed once is fixed everywhere, and a
// rename to a different word RECLASSIFIES existing rows. Committed on blur rather than per
// keystroke, so a half-typed word is never written.

/** Shared busy/error plumbing — same shape as every other write surface in the app. */
function useRefWriter() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return false;
        }
        startRefresh(() => router.refresh());
        return true;
      } catch (e) {
        // A rejected action would otherwise leave the row looking saved.
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  return { run, busy: saving || refreshing, error };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>;
}

function VocabList({
  table,
  items,
  placeholder,
  warnFor,
}: {
  table: LookupTable;
  items: RefItem[];
  placeholder: string;
  warnFor?: (label: string) => React.ReactNode;
}) {
  const { run, busy, error } = useRefWriter();
  const [draft, setDraft] = React.useState("");
  // Local echo of what is being typed, so the input does not fight the server value.
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  React.useEffect(() => setEdits({}), [items]);

  const add = async () => {
    const v = draft.trim();
    if (!v || busy) return;
    if (await run(() => addLookupValue(table, v))) setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ErrorNote error={error} />
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <Input
            value={edits[it.id] ?? it.label}
            disabled={busy}
            onChange={(e) => setEdits((p) => ({ ...p, [it.id]: e.target.value }))}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== it.label) void run(() => renameLookupValue(table, it.label, next));
            }}
            className="flex-1"
          />
          <ConfirmDelete
            onDelete={() => void run(() => deleteLookupValue(table, it.label))}
            confirmLabel={`ลบ “${it.label}”?`}
            warning={warnFor?.(it.label)}
          />
        </div>
      ))}
      <div className="flex itemsetms-center gap-2 pt-1">
        <Input
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder={placeholder}
          className="flex-1"
        />
        <button
          onClick={() => void add()}
          disabled={busy}
          aria-label="เพิ่ม"
          className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0 disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ---- Titled reference-list card (one controlled vocabulary) -----------------
function RefListCard({
  title,
  note,
  table,
  items,
  placeholder,
  warnFor,
}: {
  title: string;
  note?: string;
  table: LookupTable;
  items: RefItem[];
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
        <VocabList table={table} items={items} placeholder={placeholder} warnFor={warnFor} />
      </CardContent>
    </Card>
  );
}

// ---- Property types ---------------------------------------------------------
// Live list (provider) — the intake form's ประเภททรัพย์ selects read the same list.
// `usage` = live count of listings per property type (from v_main_listing, computed
// server-side on /settings) so the delete confirm states the real impact.
export function PropertyTypesManager({
  usage,
  codes = {},
}: {
  usage?: Record<string, number>;
  /** name → the single letter that starts a listing_id of this type. */
  codes?: Record<string, string>;
}) {
  const { propertyTypes } = useMasterData();
  const { run, busy, error } = useRefWriter();
  const [draft, setDraft] = React.useState("");
  const [draftCode, setDraftCode] = React.useState("");
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  React.useEffect(() => setEdits({}), [propertyTypes]);

  const add = async () => {
    const v = draft.trim();
    if (!v || busy) return;
    if (await run(() => addLookupValue("property_type", v, draftCode))) {
      setDraft("");
      setDraftCode("");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <ErrorNote error={error} />
        {propertyTypes.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            {/* The code is fixed after creation: it is baked into every listing_id already
                issued for this type, and changing it would not rewrite them. */}
            <span
              className="num w-9 h-9 shrink-0 grid place-items-center rounded-md border border-border bg-surface-2 text-text-subtle"
              title="ตัวแรกของรหัสทรัพย์"
            >
              {codes[it.label] ?? "—"}
            </span>
            <Input
              value={edits[it.id] ?? it.label}
              disabled={busy}
              onChange={(e) => setEdits((p) => ({ ...p, [it.id]: e.target.value }))}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== it.label)
                  void run(() => renameLookupValue("property_type", it.label, next));
              }}
              className="flex-1"
            />
            <ConfirmDelete
              onDelete={() => void run(() => deleteLookupValue("property_type", it.label))}
              confirmLabel={`ลบ “${it.label}”?`}
              warning={usageWarning(usage ? (usage[it.label] ?? 0) : null, "ทรัพย์")}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={draftCode}
            disabled={busy}
            onChange={(e) => setDraftCode(e.target.value.toUpperCase().slice(0, 1))}
            placeholder="C"
            aria-label="รหัส 1 ตัวอักษร"
            className="w-9 num text-center px-0 shrink-0"
          />
          <Input
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
            placeholder="เพิ่มประเภททรัพย์…"
            className="flex-1"
          />
          <button
            onClick={() => void add()}
            disabled={busy}
            aria-label="เพิ่ม"
            className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0 disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="text-label text-text-subtle pt-1">
          รหัส 1 ตัวอักษรคือตัวแรกของรหัสทรัพย์ (C<span className="text-text-muted">ASK</span>020 =
          คอนโด + อโศก) · ใช้ซ้ำกันได้ (บ้านเดี่ยว/บ้านแฝด ใช้ H เหมือนกัน) แต่ตั้งแล้วเปลี่ยนไม่ได้
        </p>
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
  const { sources, contactBys, genders, nationalities, pipelineStages, ownerStages } = useMasterData();
  // The real count is checked server-side before deleting — that is what actually refuses
  // the removal. This is only the advance warning on the confirm.
  const inUse = () => usageWarning(null, "ลีด");
  return (
    <div className="flex flex-col gap-4">
      {/* THE TWO PIPELINES. Order here is the order on the board and in the pills, and it
          is what decides whether the activity composer treats a move as forwards — so the
          list is sorted by sort_order, never alphabetically.

          Renaming is safe: both columns are ON UPDATE CASCADE, so every lead or listing on
          a stage follows it to the new name. Deleting one that is still in use is refused
          by the database. */}
      <RefListCard
        title="ขั้นตอน (ลูกค้า)"
        note="ไปป์ไลน์ฝั่งผู้ซื้อ — เรียงตามลำดับการขาย"
        table="pipeline_stage"
        items={pipelineStages}
        placeholder="เพิ่มขั้นตอน…"
        warnFor={inUse}
      />
      <RefListCard
        title="ไปป์ไลน์เจ้าของ"
        note="ความคืบหน้ากับเจ้าของทรัพย์ — คนละเรื่องกับ 'สถานะประกาศ' ที่บอกว่าประกาศยังขายอยู่ไหม"
        table="owner_stage"
        items={ownerStages}
        placeholder="เพิ่มขั้นตอน…"
        warnFor={() => usageWarning(null, "ทรัพย์")}
      />
      <RefListCard title="Marketing Channel" note="ช่องทางที่ลีดเข้ามา" table="marketing_channel" items={sources} placeholder="เพิ่มช่องทาง…" warnFor={inUse} />
      <RefListCard title="Contact By" note="วิธี/กล่องที่ติดต่อเข้ามา" table="contact_by" items={contactBys} placeholder="เพิ่มวิธีติดต่อ…" warnFor={inUse} />
      <RefListCard title="เพศ" table="gender" items={genders} placeholder="เพิ่ม…" warnFor={inUse} />
      <RefListCard title="สัญชาติ" table="nationality" items={nationalities} placeholder="เพิ่มสัญชาติ…" warnFor={inUse} />
    </div>
  );
}

// ---- Lead group tag (CEO-governed, single-select) ---------------------------
// Unlike the RefItem lists above, a tag stores its COLOUR: the whole point of a company
// standard is that everyone sees the same tag the same colour, so the tone is chosen here
// rather than derived from a hash. One tag per lead (CEO: "ติดได้คนเดียว"), so this list is
// a set of mutually exclusive groups — see lib/tags.ts.
export function LeadTagsManager() {
  const { leadTags } = useMasterData();
  const { run, busy, error } = useRefWriter();
  const [draft, setDraft] = React.useState("");
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  React.useEffect(() => setEdits({}), [leadTags]);

  const add = async () => {
    const label = draft.trim();
    if (!label || busy) return;
    if (leadTags.some((t) => t.label === label)) return;
    // The id is what main_6_buyer_crm.tag_id stores, so it must be stable and must not
    // change when the label is later edited. Derived once, here, and never again.
    const id = `tag_${Date.now().toString(36)}`;
    const tone = TAG_TONE_ORDER[leadTags.length % TAG_TONE_ORDER.length];
    if (await run(() => saveLeadTag(id, label, tone, true))) setDraft("");
  };

  return (
    <Card>
      <div className="px-4 py-3 border-b border-border">
        <div className="text-h3">แท็กกลุ่มลูกค้า</div>
        <p className="text-label text-text-subtle mt-0.5">
          ลูกค้า 1 คนติดได้ 1 แท็ก · เซลส์เลือกจากรายการนี้เท่านั้น สร้างเองไม่ได้
        </p>
      </div>
      <CardContent className="flex flex-col gap-1.5">
        <ErrorNote error={error} />
        {leadTags.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <Input
              value={edits[t.id] ?? t.label}
              disabled={busy}
              onChange={(e) => setEdits((p) => ({ ...p, [t.id]: e.target.value }))}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== t.label) void run(() => saveLeadTag(t.id, next, t.tone, false));
              }}
              className="flex-1"
            />
            <TonePicker
              value={t.tone}
              onChange={(tone) => void run(() => saveLeadTag(t.id, t.label, tone, false))}
              label={t.label}
            />
            <ConfirmDelete
              onDelete={() => void run(() => deleteLeadTag(t.id))}
              confirmLabel={`ลบ “${t.label}”?`}
              warning={usageWarning(null, "ลีด")}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
            placeholder="เพิ่มแท็ก…"
            className="flex-1"
          />
          <button
            onClick={() => void add()}
            disabled={busy}
            aria-label="เพิ่ม"
            className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0 disabled:opacity-50"
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

export function ActionTypesManager({
  actionTypes = [],
  usage = {},
}: {
  /** From `action_type` — the governed list every activity, task, target and rank
   *  criterion is an FK to. */
  actionTypes?: { name: string; group: string; attach: AttachMode }[];
  /** Rows in `activities` per action, for the delete confirm. */
  usage?: Record<string, number>;
}) {
  // Grouped the way the table says, not the way the seed said. The seed was missing three
  // rows the table has — including Owner Talk, the company's first KPI.
  const groups = React.useMemo(() => {
    const m = new Map<string, { group: string; attach: AttachMode; items: RefItem[] }>();
    for (const a of actionTypes) {
      const g = m.get(a.group) ?? { group: a.group, attach: a.attach, items: [] };
      g.items.push({ id: a.name, label: a.name });
      m.set(a.group, g);
    }
    return [...m.values()];
  }, [actionTypes]);

  if (!groups.length) {
    return (
      <Card className="p-6 text-center text-small text-text-subtle">ยังไม่มีประเภทกิจกรรม</Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <Card key={g.group}>
          <div className="px-4 h-11 flex items-center justify-between border-b border-border">
            <span className="text-h3">{g.group}</span>
            <Pill tone={ATTACH_LABEL[g.attach].tone}>{ATTACH_LABEL[g.attach].label}</Pill>
          </div>
          <CardContent>
            <VocabList
              table="action_type"
              items={g.items}
              placeholder="เพิ่มกิจกรรม…"
              warnFor={(it) => usageWarning(usage[it] ?? 0, "กิจกรรมที่บันทึกไว้")}
            />
          </CardContent>
        </Card>
      ))}
      <p className="text-label text-text-subtle">
        กิจกรรมที่เพิ่มใหม่จะเข้ากลุ่ม “อื่นๆ” และไปอยู่ในหมวด “งานอื่นๆ” ของแดชบอร์ด — การจัดกลุ่ม ลำดับ
        ฝั่ง (<span className="num">side</span>) ขั้นตอนที่ผูก (<span className="num">stage_name</span>) และ
        การซ่อนจากแดชบอร์ด (<span className="num">on_dashboard</span>) ต้องแก้ที่ตาราง
        <span className="num"> action_type</span> โดยตรง
      </p>
    </div>
  );
}

// ---- KPI target templates ---------------------------------------------------
// Settings ▸ เป้าหมาย KPI (gated masterdata.govern — CEO). The presets a leader picks from
// when setting a month's targets; each row is the shape of one `targets` row minus the
// person and the month.
//
// Edited as a draft and committed with บันทึก, like the probation ladder: switching a row's
// source to กิจกรรม leaves it without an action for a moment, and `kpi_template` refuses that
// combination outright. Saving per keystroke would surface it as an error mid-typing.

/** A draft row. `key` is client-only — a new row has no id until the DB gives it one. */
type KpiDraft = KpiTemplate & { key: string };

export function KpiTemplatesManager({
  actionTypes = [],
  templates = [],
}: {
  actionTypes?: { name: string; group: string }[];
  templates?: KpiTemplate[];
}) {
  const router = useRouter();
  const toDraft = React.useCallback(
    (list: KpiTemplate[]): KpiDraft[] =>
      list.map((t, i) => ({ ...t, key: t.id != null ? `k${t.id}` : `new_${i}` })),
    []
  );
  const [rows, setRows] = React.useState<KpiDraft[]>(() => toDraft(templates));
  const [seq, setSeq] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  // The saved version, for the dirty flag and for ยกเลิกการแก้ไข.
  const saved = React.useMemo(() => JSON.stringify(templates), [templates]);
  const dirty = React.useMemo(
    () => JSON.stringify(rows.map(({ key, ...t }) => t)) !== saved,
    [rows, saved]
  );

  // From `action_type`, not the seed. No exclusions any more: every action in the table is
  // loggable work, so every one of them can carry a KPI.
  const actionOptions = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of actionTypes) {
      const arr = m.get(a.group) ?? [];
      arr.push(a.name);
      m.set(a.group, arr);
    }
    return [...m].map(([group, items]) => ({ group, items }));
  }, [actionTypes]);

  const addRow = () => {
    setSeq((n) => n + 1);
    setRows((rs) => [
      ...rs,
      {
        key: `new_${seq}`,
        id: null,
        label: "เป้าหมายใหม่",
        kind: "count",
        source: "activity",
        activityType: actionOptions[0]?.items[0] ?? "Call",
        defaultTarget: 0,
      },
    ]);
  };

  const patch = (key: string, p: Partial<KpiTemplate>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  // Source switch keeps activityType coherent: activity gets a default action;
  // pipeline/manual carry none.
  const setSource = (r: KpiDraft, source: TemplateSource) =>
    patch(r.key, {
      source,
      activityType:
        source === "activity" ? (r.activityType ?? actionOptions[0]?.items[0] ?? "Call") : undefined,
    });

  // Always try/catch: a rejected action is not a { ok: false } result, and an uncaught one
  // leaves the bar reading "กำลังบันทึก…" with nothing saved and nothing said.
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await saveKpiTemplates(rows.map(({ key, ...t }) => t));
      if (!res.ok) setError(res.error);
      else start(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const working = busy || pending;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 flex-wrap">
            <Input
              value={r.label}
              onChange={(e) => patch(r.key, { label: e.target.value })}
              className="flex-1 min-w-[140px]"
            />
            <Select
              value={r.kind}
              onChange={(e) => patch(r.key, { kind: e.target.value as TemplateKind })}
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
                value={r.activityType ?? ""}
                onChange={(e) => patch(r.key, { activityType: e.target.value })}
                aria-label="กิจกรรมที่นับ"
                className="w-36"
              >
                {actionOptions.map((g) => (
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
              onChange={(e) => patch(r.key, { defaultTarget: Number(e.target.value) || 0 })}
              className="w-24 num text-right"
              inputMode="numeric"
              aria-label="เป้าเริ่มต้น"
            />
            <ConfirmDelete
              onDelete={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              confirmLabel={`ลบ “${r.label}”?`}
              warning="เป้าหมายที่ตั้งจากเทมเพลตนี้ไว้แล้วจะไม่ถูกลบ แต่หัวหน้าจะตั้งเป้าจากเทมเพลตนี้ใหม่ไม่ได้อีก"
            />
          </div>
        ))}
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={addRow} disabled={working}>
            <Plus size={13} strokeWidth={2} /> เพิ่มเทมเพลตเป้าหมาย
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red/30 bg-red-bg/50 p-2.5 text-small text-red">
            {error}
          </div>
        )}

        {/* Commit bar — the list is a draft until this is pressed. */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button size="sm" onClick={() => void save()} disabled={!dirty || working}>
            {working ? "กำลังบันทึก…" : "บันทึกเทมเพลต"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRows(toDraft(templates));
              setError(null);
            }}
            disabled={!dirty || working}
          >
            ยกเลิกการแก้ไข
          </Button>
          <span className="text-label text-text-subtle ml-1">
            {dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกแล้ว"}
          </span>
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
