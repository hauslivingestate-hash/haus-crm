"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  Paperclip,
  CalendarClock,
  X,
  ListChecks,
  Link as LinkIcon,
  Repeat,
  ExternalLink,
} from "lucide-react";
import { useChecklists, type ChecklistItemState } from "@/components/ChecklistProvider";
import { useRbac } from "@/components/RbacProvider";
import {
  roleLabel,
  roleTone,
  TIER_LABEL,
  CHECKLIST_ROLES,
  DEFAULT_REPEAT_DAYS,
  type ChecklistTemplate,
  type ChecklistTemplateItem,
} from "@/lib/checklists";
import { potentialGroup, type PotentialGroup } from "@/lib/status";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

// Value-add checklist for a high-value listing (A-List / Exclusive). Reads the applicable
// templates from ChecklistProvider and lets the team tick tasks, attach documents, paste
// portal/copy links, and track re-post cadence (turns red when overdue — mirrors the Listing
// Support sheet). Renders nothing for Normal listings. Client component in the server page.
export function ListingChecklist({
  listingId,
  potential,
}: {
  listingId: string;
  potential: string | null | undefined;
}) {
  const { templatesFor, aListDateFor, setAListDate } = useChecklists();
  const templates = templatesFor(potential);
  const [roleFilter, setRoleFilter] = React.useState<string>("all");

  if (templates.length === 0) return null; // Normal listing → no checklist

  const tier = potentialGroup(potential) as Exclude<PotentialGroup, "normal">;
  const allItems = templates.flatMap((t) => t.items);
  const rolesPresent = CHECKLIST_ROLES.filter((r) => allItems.some((i) => i.role === r.id));
  const aListDate = aListDateFor(listingId);

  return (
    // Section divider — separates this full-width workflow block from the info grid above.
    <div className="border-t border-border pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks size={16} strokeWidth={1.75} className="text-accent" />
            เช็คลิสต์เพิ่มมูลค่า
            <Pill tone={tier === "exclusive" ? "accent" : "amber"}>{TIER_LABEL[tier]}</Pill>
          </CardTitle>
          <Progress items={allItems} listingId={listingId} />
        </CardHeader>

        {/* Listing metadata — "Date A List" (when it entered A-List). A-List tier only; the
            Exclusive agreement window lives in its own sidebar card (ExclusiveAgreementCard). */}
        {tier === "a_list" && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <span className="text-small text-text-subtle">ขึ้น A List</span>
            <input
              type="date"
              value={aListDate ?? ""}
              onChange={(e) => setAListDate(listingId, e.target.value || null)}
              className="h-7 rounded-md border border-border-strong bg-surface px-2 num text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        )}

        {/* Role filter — lets each team focus on their own steps */}
        {rolesPresent.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border flex-wrap">
            <span className="text-label text-text-subtle mr-1">ทีม</span>
            <RoleChip active={roleFilter === "all"} onClick={() => setRoleFilter("all")}>
              ทั้งหมด
            </RoleChip>
            {rolesPresent.map((r) => (
              <RoleChip
                key={r.id}
                active={roleFilter === r.id}
                onClick={() => setRoleFilter(roleFilter === r.id ? "all" : r.id)}
              >
                {r.label}
              </RoleChip>
            ))}
          </div>
        )}

        <div className="divide-y divide-border">
          {templates.map((t) => (
            <TemplateSection
              key={t.id}
              template={t}
              listingId={listingId}
              roleFilter={roleFilter}
              showName={templates.length > 1}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function Progress({ items, listingId }: { items: ChecklistTemplateItem[]; listingId: string }) {
  const { stateFor } = useChecklists();
  const done = items.filter((i) => isDone(i, stateFor(listingId, i.id))).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="num text-small text-text-muted">
        {done} / {items.length}
      </span>
      <div className="h-1.5 w-24 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TemplateSection({
  template,
  listingId,
  roleFilter,
  showName,
}: {
  template: ChecklistTemplate;
  listingId: string;
  roleFilter: string;
  showName: boolean;
}) {
  const items =
    roleFilter === "all" ? template.items : template.items.filter((i) => i.role === roleFilter);
  if (items.length === 0) return null;

  return (
    <div>
      {showName && (
        <div className="px-4 pt-3 pb-1 text-label uppercase tracking-wide text-text-subtle">
          {template.name}
        </div>
      )}
      <ul>
        {items.map((it) => (
          <ChecklistRow key={it.id} item={it} listingId={listingId} />
        ))}
      </ul>
    </div>
  );
}

function ChecklistRow({ item, listingId }: { item: ChecklistTemplateItem; listingId: string }) {
  const { stateFor, patchState } = useChecklists();
  const { currentUser } = useRbac();
  const st = stateFor(listingId, item.id);
  const done = isDone(item, st);
  const clickable = item.type === "task" || item.type === "date"; // others complete via their control

  const stamp = () => ({ completedAt: new Date().toISOString(), completedBy: currentUser.id });
  const toggleTask = () =>
    patchState(listingId, item.id, done ? { completedAt: null, completedBy: null } : stamp());

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) patchState(listingId, item.id, { docName: f.name, ...stamp() });
    e.target.value = "";
  };
  const removeDoc = () =>
    patchState(listingId, item.id, { docName: null, completedAt: null, completedBy: null });

  const repeatDays = item.repeatDays ?? DEFAULT_REPEAT_DAYS;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        onClick={clickable ? toggleTask : undefined}
        disabled={!clickable}
        aria-label={done ? "ทำแล้ว" : "ยังไม่ทำ"}
        className={cn("shrink-0 transition-colors", clickable ? "hover:text-green" : "cursor-default")}
      >
        {done ? (
          <CheckCircle2 size={18} strokeWidth={2} className="text-green" />
        ) : (
          <Circle size={18} strokeWidth={1.75} className="text-text-subtle" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className={cn("text-body", done && "text-text-muted line-through")}>{item.label}</div>

        {/* Document — attach a file (preview only) */}
        {item.type === "document" && (
          <div className="mt-0.5 text-label">
            {st.docName ? (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <Paperclip size={11} strokeWidth={1.75} /> {st.docName}
                <button
                  onClick={removeDoc}
                  className="ml-1 text-text-subtle hover:text-red transition-colors inline-flex items-center"
                  aria-label="ลบไฟล์"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            ) : (
              <label className="inline-flex items-center gap-1 text-accent hover:underline cursor-pointer">
                <Paperclip size={11} strokeWidth={1.75} /> แนบไฟล์
                <input type="file" onChange={onFile} className="hidden" />
              </label>
            )}
          </div>
        )}

        {/* Link — paste a URL (copy template / portal post) */}
        {item.type === "link" && (
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="url"
              placeholder="วางลิงก์…"
              value={st.url ?? ""}
              onChange={(e) => patchState(listingId, item.id, { url: e.target.value || null })}
              className="h-7 rounded-md border border-border-strong bg-surface px-2 text-small text-text w-full max-w-[340px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {st.url && (
              <a
                href={st.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent shrink-0 hover:opacity-80"
                aria-label="เปิดลิงก์"
              >
                <ExternalLink size={14} strokeWidth={1.75} />
              </a>
            )}
          </div>
        )}

        {/* One-time due date */}
        {item.type === "date" && (
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-text-subtle">
              <CalendarClock size={12} strokeWidth={1.75} />
            </span>
            <input
              type="date"
              value={st.dueDate ?? ""}
              onChange={(e) => patchState(listingId, item.id, { dueDate: e.target.value || null })}
              className="h-7 rounded-md border border-border-strong bg-surface px-2 num text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {st.dueDate && !done && <DueBadge dueDate={st.dueDate} />}
          </div>
        )}

        {/* Cadence — last-posted date + re-post reminder (red when overdue) */}
        {item.type === "cadence" && (
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-text-subtle">
              <Repeat size={12} strokeWidth={1.75} />
            </span>
            <input
              type="date"
              value={st.dueDate ?? ""}
              onChange={(e) => patchState(listingId, item.id, { dueDate: e.target.value || null })}
              className="h-7 rounded-md border border-border-strong bg-surface px-2 num text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {st.dueDate ? (
              <CadenceBadge dateStr={st.dueDate} repeatDays={repeatDays} />
            ) : (
              <span className="text-label text-text-subtle">โพสต์ซ้ำทุก {repeatDays} วัน</span>
            )}
          </div>
        )}
      </div>

      {item.role && <Pill tone={roleTone(item.role)}>{roleLabel(item.role)}</Pill>}
    </li>
  );
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const diff = -daysSince(dueDate); // days until due (negative = overdue)
  const { text, tone } =
    diff < 0
      ? { text: `เลยกำหนด ${-diff} วัน`, tone: "red" as const }
      : diff === 0
        ? { text: "ครบกำหนดวันนี้", tone: "amber" as const }
        : diff <= 3
          ? { text: `อีก ${diff} วัน`, tone: "amber" as const }
          : { text: `อีก ${diff} วัน`, tone: "neutral" as const };
  return (
    <Pill tone={tone}>
      <CalendarClock size={11} strokeWidth={1.75} /> {text}
    </Pill>
  );
}

function CadenceBadge({ dateStr, repeatDays }: { dateStr: string; repeatDays: number }) {
  const remain = repeatDays - daysSince(dateStr); // days until re-post due
  const { text, tone } =
    remain < 0
      ? { text: `ต้องโพสต์ซ้ำ (เลย ${-remain} วัน)`, tone: "red" as const }
      : remain === 0
        ? { text: "ครบกำหนดโพสต์ซ้ำวันนี้", tone: "amber" as const }
        : { text: `โพสต์ซ้ำใน ${remain} วัน`, tone: remain <= 1 ? ("amber" as const) : ("green" as const) };
  return (
    <Pill tone={tone}>
      <Repeat size={11} strokeWidth={1.75} /> {text}
    </Pill>
  );
}

function RoleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-small font-medium rounded-md px-2.5 py-1 border transition-colors",
        active
          ? "bg-text text-background border-text"
          : "border-border-strong text-text-muted hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}

// Whole days between `dateStr` (YYYY-MM-DD) and today. Positive = in the past.
function daysSince(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

// "Done" depends on the item type: task/date checked off · document attached · link pasted ·
// cadence posted within its repeat window.
function isDone(item: ChecklistTemplateItem, st: ChecklistItemState): boolean {
  switch (item.type) {
    case "document":
      return !!st.docName;
    case "link":
      return !!st.url;
    case "cadence":
      return !!st.dueDate && daysSince(st.dueDate) <= (item.repeatDays ?? DEFAULT_REPEAT_DAYS);
    default:
      return !!st.completedAt; // task, date
  }
}
