"use client";

import * as React from "react";
import {
  Plus,
  ClipboardList,
  CheckSquare,
  Paperclip,
  CalendarClock,
  GripVertical,
  Link as LinkIcon,
  Repeat,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { saveChecklistTemplates } from "@/lib/mutations/checklists";
import {
  TIER_LABEL,
  DEFAULT_REPEAT_DAYS,
  type ChecklistItemType,
  type ChecklistTemplate,
  type ChecklistTemplateItem,
  type FocusTier,
} from "@/lib/checklists";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { cn } from "@/lib/cn";

// Settings ▸ เช็คลิสต์ทรัพย์ (gated checklists.manage). Create/edit the value-add checklist
// templates for A-List / Exclusive listings: name, which tier(s) they apply to, and their
// items (each a task / document / date step assigned to a role).
//
// Edited as a draft and committed with บันทึก, like the probation ladder. Saving per keystroke
// would write a template with no tier selected and a cadence step with no interval - both of
// which the table refuses outright - while the CEO was still halfway through building it.
//
// Deleting a template cascades to its steps and, through them, to every listing's progress on
// those steps. That is correct (a step that no longer exists cannot be half-done) but it is
// why the delete confirmations say how many steps are going with it.

const TYPE_META: { type: ChecklistItemType; label: string; icon: typeof CheckSquare }[] = [
  { type: "task", label: "งาน", icon: CheckSquare },
  { type: "document", label: "เอกสาร", icon: Paperclip },
  { type: "date", label: "กำหนดวันที่", icon: CalendarClock },
  { type: "link", label: "ลิงก์", icon: LinkIcon },
  { type: "cadence", label: "โพสต์ซ้ำ", icon: Repeat },
];

const TIERS: FocusTier[] = ["exclusive", "a_list"];
const TIER_ACTIVE: Record<FocusTier, string> = {
  exclusive: "bg-accent-wash text-accent border-accent",
  a_list: "bg-amber-bg text-amber border-amber",
};

/** Client-only stable keys - a template or step added here has no DB id until it is saved. */
type ItemDraft = ChecklistTemplateItem & { key: string };
type TplDraft = Omit<ChecklistTemplate, "items"> & { key: string; items: ItemDraft[] };

const toDraft = (list: ChecklistTemplate[]): TplDraft[] =>
  list.map((t, ti) => ({
    ...t,
    key: t.id != null ? `t${t.id}` : `tnew_${ti}`,
    items: t.items.map((i, ii) => ({ ...i, key: i.id != null ? `i${i.id}` : `inew_${ti}_${ii}` })),
  }));

const stripKeys = (list: TplDraft[]): ChecklistTemplate[] =>
  list.map(({ key, items, ...t }) => ({ ...t, items: items.map(({ key: _k, ...i }) => i) }));

export function ChecklistTemplatesManager({
  templates: saved = [],
  roles = [],
}: {
  templates?: ChecklistTemplate[];
  /** Assignable roles, from the `roles` table - a step's role is an FK to it. */
  roles?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState<TplDraft[]>(() => toDraft(saved));
  const [selectedKey, setSelectedKey] = React.useState<string>(() => toDraft(saved)[0]?.key ?? "");
  const [seq, setSeq] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const savedJson = React.useMemo(() => JSON.stringify(saved), [saved]);
  const dirty = React.useMemo(
    () => JSON.stringify(stripKeys(templates)) !== savedJson,
    [templates, savedJson]
  );
  const working = busy || pending;

  const selected = templates.find((t) => t.key === selectedKey) ?? templates[0];

  // Deliberately excludes `items`: patching a draft with a keyless item list would strip the
  // client keys the editor identifies rows by. Items are edited through patchItem/addItem.
  const patchTemplate = (key: string, p: Partial<Omit<ChecklistTemplate, "items">>) =>
    setTemplates((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t)));

  const toggleTier = (key: string, tier: FocusTier) =>
    setTemplates((ts) =>
      ts.map((t) =>
        t.key === key
          ? {
              ...t,
              appliesTo: t.appliesTo.includes(tier)
                ? t.appliesTo.filter((x) => x !== tier)
                : [...t.appliesTo, tier],
            }
          : t
      )
    );

  const patchItem = (tplKey: string, itemKey: string, p: Partial<ChecklistTemplateItem>) =>
    setTemplates((ts) =>
      ts.map((t) =>
        t.key === tplKey
          ? { ...t, items: t.items.map((i) => (i.key === itemKey ? { ...i, ...p } : i)) }
          : t
      )
    );

  const addItem = (tplKey: string) => {
    const key = `inew_${seq}`;
    setSeq((n) => n + 1);
    setTemplates((ts) =>
      ts.map((t) =>
        t.key === tplKey
          ? {
              ...t,
              items: [...t.items, { key, id: null, label: "งานใหม่", type: "task", role: null }],
            }
          : t
      )
    );
  };

  const deleteItem = (tplKey: string, itemKey: string) =>
    setTemplates((ts) =>
      ts.map((t) =>
        t.key === tplKey ? { ...t, items: t.items.filter((i) => i.key !== itemKey) } : t
      )
    );

  const createTemplate = () => {
    const key = `tnew_${seq}`;
    setSeq((n) => n + 1);
    const fresh: TplDraft = {
      key,
      id: null,
      name: "เทมเพลตใหม่",
      appliesTo: ["a_list"],
      items: [],
    };
    setTemplates((ts) => [...ts, fresh]);
    setSelectedKey(key);
  };

  const deleteTemplate = (key: string) => {
    setTemplates((ts) => ts.filter((t) => t.key !== key));
    if (selectedKey === key) setSelectedKey(templates.find((t) => t.key !== key)?.key ?? "");
  };

  // Always try/catch - a rejected action is not a { ok:false } result, and swallowing it would
  // leave the bar reading "กำลังบันทึก…" over a save that never happened.
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await saveChecklistTemplates(stripKeys(templates));
      if (!res.ok) setError(res.error);
      else start(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const commitBar = (
    <>
      {error && <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>}
      <div className="sticky bottom-0 flex items-center gap-2 py-3 bg-background border-t border-border">
        <Button size="sm" onClick={() => void save()} disabled={!dirty || working}>
          {working ? "กำลังบันทึก…" : "บันทึกเช็คลิสต์"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setTemplates(toDraft(saved));
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
    </>
  );

  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <Card className="p-6 text-center text-small text-text-subtle">
          ยังไม่มีเทมเพลต —{" "}
          <button onClick={createTemplate} className="text-accent font-medium hover:underline">
            สร้างเทมเพลตแรก
          </button>
        </Card>
        {commitBar}
      </div>
    );
  }

  return (
   <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-4 items-start">
      {/* Template list */}
      <Card className="overflow-hidden">
        <div className="px-3 h-11 flex items-center justify-between border-b border-border">
          <span className="text-label uppercase text-text-subtle">
            เทมเพลต ({templates.length})
          </span>
        </div>
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.key}>
              <button
                onClick={() => setSelectedKey(t.key)}
                className={cn(
                  "w-full text-left px-3 py-2.5 transition-colors",
                  t.key === selected.key ? "bg-accent-wash" : "hover:bg-surface-hover"
                )}
              >
                <div className="text-body font-medium truncate">{t.name}</div>
                <div className="text-label text-text-subtle truncate flex items-center gap-1 mt-0.5">
                  {t.appliesTo.length ? (
                    t.appliesTo.map((tier) => (
                      <Pill key={tier} tone={tier === "exclusive" ? "accent" : "amber"}>
                        {TIER_LABEL[tier]}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-red">ยังไม่ได้เลือกระดับ</span>
                  )}
                  <span className="num ml-1">· {t.items.length} ข้อ</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={createTemplate}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors"
        >
          <Plus size={15} strokeWidth={2} /> สร้างเทมเพลต
        </button>
      </Card>

      {/* Template editor */}
      <div className="flex flex-col gap-4 min-w-0">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent-wash text-accent grid place-items-center shrink-0">
              <ClipboardList size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 flex flex-col gap-2.5">
              <Input
                value={selected.name}
                onChange={(e) => patchTemplate(selected.key, { name: e.target.value })}
                className="font-semibold h-8 max-w-xs"
                aria-label="ชื่อเทมเพลต"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-small text-text-muted">ใช้กับ</span>
                {TIERS.map((tier) => {
                  const on = selected.appliesTo.includes(tier);
                  return (
                    <button
                      key={tier}
                      onClick={() => toggleTier(selected.key, tier)}
                      className={cn(
                        "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                        on ? TIER_ACTIVE[tier] : "border-border-strong text-text-muted hover:bg-surface-2"
                      )}
                    >
                      {on ? "✓ " : ""}
                      {TIER_LABEL[tier]}
                    </button>
                  );
                })}
              </div>
            </div>
            <ConfirmDelete
              onDelete={() => deleteTemplate(selected.key)}
              label="ลบเทมเพลต"
              confirmLabel={`ลบ “${selected.name}”?`}
              warning={
                selected.items.length > 0
                  ? `เทมเพลตนี้มี ${selected.items.length} ข้อ — ทรัพย์ที่ใช้อยู่จะไม่แสดงเช็คลิสต์นี้อีก`
                  : "เทมเพลตนี้ยังไม่มีข้อ — ลบได้อย่างปลอดภัย"
              }
            />
          </div>
        </Card>

        {/* Items */}
        <Card>
          <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
            <ClipboardList size={15} strokeWidth={1.75} className="text-text-muted" />
            <span className="text-h3">รายการงาน</span>
            <span className="num text-label text-text-subtle">({selected.items.length})</span>
          </div>
          {selected.items.length === 0 ? (
            <div className="px-4 py-6 text-center text-small text-text-subtle">
              ยังไม่มีข้อ — เพิ่มงานแรกด้านล่าง
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {selected.items.map((it) => (
                <li key={it.key} className="flex items-center gap-2 px-3 py-2.5">
                  <GripVertical size={15} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                  <Input
                    value={it.label}
                    onChange={(e) => patchItem(selected.key, it.key, { label: e.target.value })}
                    className="h-8 flex-1 min-w-0"
                    aria-label="ชื่องาน"
                  />
                  <Select
                    value={it.type}
                    onChange={(e) => {
                      const type = e.target.value as ChecklistItemType;
                      patchItem(selected.key, it.key, {
                        type,
                        repeatDays:
                          type === "cadence" ? (it.repeatDays ?? DEFAULT_REPEAT_DAYS) : undefined,
                      });
                    }}
                    aria-label="ประเภท"
                    className="w-24"
                  >
                    {TYPE_META.map((m) => (
                      <option key={m.type} value={m.type}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  {it.type === "cadence" && (
                    <label className="text-label text-text-subtle inline-flex items-center gap-1 shrink-0">
                      ทุก
                      <Input
                        value={String(it.repeatDays ?? DEFAULT_REPEAT_DAYS)}
                        onChange={(e) =>
                          patchItem(selected.key, it.key, {
                            repeatDays:
                              Number(e.target.value.replace(/[^\d]/g, "")) || DEFAULT_REPEAT_DAYS,
                          })
                        }
                        inputMode="numeric"
                        className="h-8 w-11 num text-center px-1"
                        aria-label="โพสต์ซ้ำทุกกี่วัน"
                      />
                      วัน
                    </label>
                  )}
                  <Select
                    value={it.role ?? ""}
                    onChange={(e) =>
                      patchItem(selected.key, it.key, { role: e.target.value || null })
                    }
                    aria-label="ผู้รับผิดชอบ"
                    className="w-36"
                  >
                    <option value="">ไม่ระบุ</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  <ConfirmDelete
                    onDelete={() => deleteItem(selected.key, it.key)}
                    label="ลบงาน"
                    confirmLabel={`ลบ “${it.label}”?`}
                    warning="ลบข้อนี้ออกจากเทมเพลต — ทรัพย์ที่ใช้อยู่จะไม่แสดงข้อนี้อีก"
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => addItem(selected.key)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors"
          >
            <Plus size={15} strokeWidth={2} /> เพิ่มงาน
          </button>
        </Card>
      </div>
    </div>
    {commitBar}
   </div>
  );
}

// Native select styled to match the Input primitive.
function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 rounded-md border border-border-strong bg-surface px-2 text-body text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring shrink-0",
        className
      )}
      {...props}
    />
  );
}
