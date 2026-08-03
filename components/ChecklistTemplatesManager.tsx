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
import { useChecklists } from "@/components/ChecklistProvider";
import {
  CHECKLIST_ROLES,
  TIER_LABEL,
  DEFAULT_REPEAT_DAYS,
  type ChecklistItemType,
  type FocusTier,
} from "@/lib/checklists";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { cn } from "@/lib/cn";

// Settings ▸ เช็คลิสต์ทรัพย์ (gated checklists.manage). Create/edit the value-add checklist
// templates for A-List / Exclusive listings: name, which tier(s) they apply to, and their
// items (each a task / document / date step assigned to a role). Shares ChecklistProvider so
// edits live-update every listing's checklist. Design-first: in-memory, not persisted.

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

export function ChecklistTemplatesManager() {
  const { templates, setTemplates } = useChecklists();
  const [selectedId, setSelectedId] = React.useState<string>(templates[0]?.id ?? "");
  const [seq, setSeq] = React.useState(1);

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  const patchTemplate = (id: string, p: Partial<(typeof templates)[number]>) =>
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const toggleTier = (id: string, tier: FocusTier) =>
    setTemplates((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              ...t,
              appliesTo: t.appliesTo.includes(tier)
                ? t.appliesTo.filter((x) => x !== tier)
                : [...t.appliesTo, tier],
            }
          : t
      )
    );

  const patchItem = (
    tplId: string,
    itemId: string,
    p: Partial<(typeof templates)[number]["items"][number]>
  ) =>
    setTemplates((ts) =>
      ts.map((t) =>
        t.id === tplId
          ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, ...p } : i)) }
          : t
      )
    );

  const addItem = (tplId: string) => {
    const id = `it_new_${seq}`;
    setSeq((n) => n + 1);
    setTemplates((ts) =>
      ts.map((t) =>
        t.id === tplId
          ? { ...t, items: [...t.items, { id, label: "งานใหม่", type: "task", role: null }] }
          : t
      )
    );
  };

  const deleteItem = (tplId: string, itemId: string) =>
    setTemplates((ts) =>
      ts.map((t) => (t.id === tplId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t))
    );

  const createTemplate = () => {
    const id = `tpl_new_${seq}`;
    setSeq((n) => n + 1);
    setTemplates((ts) => [...ts, { id, name: "เทมเพลตใหม่", appliesTo: ["a_list"], items: [] }]);
    setSelectedId(id);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((ts) => ts.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(templates.find((t) => t.id !== id)?.id ?? "");
  };

  if (!selected) {
    return (
      <Card className="p-6 text-center text-small text-text-subtle">
        ยังไม่มีเทมเพลต —{" "}
        <button onClick={createTemplate} className="text-accent font-medium hover:underline">
          สร้างเทมเพลตแรก
        </button>
      </Card>
    );
  }

  return (
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
            <li key={t.id}>
              <button
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 transition-colors",
                  t.id === selected.id ? "bg-accent-wash" : "hover:bg-surface-hover"
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
                onChange={(e) => patchTemplate(selected.id, { name: e.target.value })}
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
                      onClick={() => toggleTier(selected.id, tier)}
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
              onDelete={() => deleteTemplate(selected.id)}
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
                <li key={it.id} className="flex items-center gap-2 px-3 py-2.5">
                  <GripVertical size={15} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                  <Input
                    value={it.label}
                    onChange={(e) => patchItem(selected.id, it.id, { label: e.target.value })}
                    className="h-8 flex-1 min-w-0"
                    aria-label="ชื่องาน"
                  />
                  <Select
                    value={it.type}
                    onChange={(e) => {
                      const type = e.target.value as ChecklistItemType;
                      patchItem(selected.id, it.id, {
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
                          patchItem(selected.id, it.id, {
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
                      patchItem(selected.id, it.id, { role: e.target.value || null })
                    }
                    aria-label="ผู้รับผิดชอบ"
                    className="w-36"
                  >
                    <option value="">ไม่ระบุ</option>
                    {CHECKLIST_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <ConfirmDelete
                    onDelete={() => deleteItem(selected.id, it.id)}
                    label="ลบงาน"
                    confirmLabel={`ลบ “${it.label}”?`}
                    warning="ลบข้อนี้ออกจากเทมเพลต — ทรัพย์ที่ใช้อยู่จะไม่แสดงข้อนี้อีก"
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => addItem(selected.id)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors"
          >
            <Plus size={15} strokeWidth={2} /> เพิ่มงาน
          </button>
        </Card>
      </div>
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
