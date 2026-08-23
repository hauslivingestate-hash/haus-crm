"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Paperclip,
  CalendarClock,
  ListChecks,
  Repeat,
  ExternalLink,
} from "lucide-react";
import { useChecklists } from "@/components/ChecklistProvider";
import { setChecklistItemState } from "@/lib/mutations/checklists";
import {
  roleLabel,
  roleTone,
  daysSince,
  isDone,
  TIER_LABEL,
  DEFAULT_REPEAT_DAYS,
  EMPTY_ITEM_STATE,
  type ChecklistItemState,
  type ChecklistTemplate,
  type ChecklistTemplateItem,
  type ProgressMap,
} from "@/lib/checklists";
import { potentialGroup, type PotentialGroup } from "@/lib/status";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

// Value-add checklist for a high-value listing (A-List / Exclusive). Templates come from the
// provider, progress from the page, and every change writes to `listing_checklist_item`.
// Renders nothing for Normal listings.
//
// Text fields (links, notes) commit on BLUR, not per keystroke — a half-typed URL is not a
// link, and every keystroke would be a round trip. Ticks and dates commit immediately, since
// there is no half-state to wait for.

interface Ctx {
  progress: ProgressMap;
  roles: { id: string; name: string }[];
  save: (itemId: number, patch: Partial<ChecklistItemState>) => void;
  busyItem: number | null;
  error: string | null;
  canEdit: boolean;
}
const RowCtx = React.createContext<Ctx | null>(null);
const useRow = () => {
  const c = React.useContext(RowCtx);
  if (!c) throw new Error("checklist row outside provider");
  return c;
};

export function ListingChecklist({
  listingId,
  potential,
  progress,
  roles,
  canEdit,
}: {
  listingId: string;
  potential: string | null | undefined;
  /** Saved state keyed by template_item_id. */
  progress: ProgressMap;
  /** Roles from the DB, for the responsibility chips. */
  roles: { id: string; name: string }[];
  /** Whether this viewer may tick anything — the whole card is read-only otherwise. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const { templatesFor } = useChecklists();
  const templates = templatesFor(potential);
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [busyItem, setBusyItem] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Optimistic layer: the tick should land under the finger, not after the round trip.
  const [optimistic, setOptimistic] = React.useState<ProgressMap>({});
  const [, start] = React.useTransition();

  // Server state wins once it arrives — drop any optimistic entry the refresh has caught up to.
  React.useEffect(() => setOptimistic({}), [progress]);

  const merged = React.useMemo<ProgressMap>(
    () => ({ ...progress, ...optimistic }),
    [progress, optimistic]
  );

  const save = React.useCallback(
    (itemId: number, patch: Partial<ChecklistItemState>) => {
      const before = merged[itemId] ?? EMPTY_ITEM_STATE;
      setOptimistic((o) => ({ ...o, [itemId]: { ...before, ...patch } }));
      setBusyItem(itemId);
      setError(null);
      void (async () => {
        try {
          const res = await setChecklistItemState(listingId, itemId, patch);
          if (!res.ok) {
            // Roll the optimistic tick back — leaving it would claim a save that never was.
            setOptimistic((o) => ({ ...o, [itemId]: before }));
            setError(res.error);
            return;
          }
          start(() => router.refresh());
        } catch (e) {
          setOptimistic((o) => ({ ...o, [itemId]: before }));
          setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
        } finally {
          setBusyItem(null);
        }
      })();
    },
    [listingId, merged, router]
  );

  if (templates.length === 0) return null; // Normal listing → no checklist

  const tier = potentialGroup(potential) as Exclude<PotentialGroup, "normal">;
  const allItems = templates.flatMap((t) => t.items);
  const rolesPresent = roles.filter((r) => allItems.some((i) => i.role === r.id));

  return (
    // Section divider — separates this full-width workflow block from the info grid above.
    <div className="border-t border-border pt-4">
      <RowCtx.Provider value={{ progress: merged, roles, save, busyItem, error, canEdit }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks size={16} strokeWidth={1.75} className="text-accent" />
              เช็คลิสต์เพิ่มมูลค่า
              <Pill tone={tier === "exclusive" ? "accent" : "amber"}>{TIER_LABEL[tier]}</Pill>
            </CardTitle>
            <Progress items={allItems} progress={merged} />
          </CardHeader>

          {error && (
            <div className="px-4 py-2 border-b border-border text-small text-red bg-red-bg/40">
              {error}
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
                  {r.name}
                </RoleChip>
              ))}
            </div>
          )}

          <div className="divide-y divide-border">
            {templates.map((t) => (
              <TemplateSection
                key={t.id}
                template={t}
                roleFilter={roleFilter}
                showName={templates.length > 1}
              />
            ))}
          </div>
        </Card>
      </RowCtx.Provider>
    </div>
  );
}

function Progress({ items, progress }: { items: ChecklistTemplateItem[]; progress: ProgressMap }) {
  const done = items.filter(
    (i) => i.id != null && isDone(i, progress[i.id] ?? EMPTY_ITEM_STATE)
  ).length;
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
  roleFilter,
  showName,
}: {
  template: ChecklistTemplate;
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
          <ChecklistRow key={it.id} item={it} />
        ))}
      </ul>
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistTemplateItem }) {
  const { progress, roles, save, busyItem, canEdit } = useRow();
  if (item.id == null) return null;
  const itemId = item.id;
  const st = progress[itemId] ?? EMPTY_ITEM_STATE;
  const done = isDone(item, st);
  const busy = busyItem === itemId;
  // link/document/cadence complete via their own control, not the circle
  const clickable = canEdit && (item.type === "task" || item.type === "date");

  const toggleTask = () =>
    save(itemId, { completedAt: done ? null : new Date().toISOString() });

  const repeatDays = item.repeatDays ?? DEFAULT_REPEAT_DAYS;

  return (
    <li className={cn("flex items-center gap-3 px-4 py-2.5", busy && "opacity-60")}>
      <button
        type="button"
        onClick={clickable ? toggleTask : undefined}
        disabled={!clickable || busy}
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

        {/* Document — a Google Drive link, not an upload. Deeds and ID-card copies stay in
            Drive; the app only records where they are. */}
        {item.type === "document" && (
          <UrlField
            itemId={itemId}
            value={st.url}
            placeholder="วางลิงก์ Google Drive…"
            icon={<Paperclip size={11} strokeWidth={1.75} />}
            disabled={!canEdit || busy}
            save={save}
          />
        )}

        {/* Link — paste a URL (copy template / portal post) */}
        {item.type === "link" && (
          <UrlField
            itemId={itemId}
            value={st.url}
            placeholder="วางลิงก์…"
            disabled={!canEdit || busy}
            save={save}
          />
        )}

        {/* One-time due date */}
        {item.type === "date" && (
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-text-subtle">
              <CalendarClock size={12} strokeWidth={1.75} />
            </span>
            <DateInput
              value={st.dueDate}
              disabled={!canEdit || busy}
              onChange={(v) => save(itemId, { dueDate: v })}
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
            <DateInput
              value={st.dueDate}
              disabled={!canEdit || busy}
              onChange={(v) => save(itemId, { dueDate: v })}
            />
            {st.dueDate ? (
              <CadenceBadge dateStr={st.dueDate} repeatDays={repeatDays} />
            ) : (
              <span className="text-label text-text-subtle">โพสต์ซ้ำทุก {repeatDays} วัน</span>
            )}
          </div>
        )}
      </div>

      {item.role && <Pill tone={roleTone(item.role)}>{roleLabel(item.role, roles)}</Pill>}
    </li>
  );
}

/** A URL field that commits on blur — a half-typed link is not a link. */
function UrlField({
  itemId,
  value,
  placeholder,
  icon,
  disabled,
  save,
}: {
  itemId: number;
  value: string | null;
  placeholder: string;
  icon?: React.ReactNode;
  disabled: boolean;
  save: (itemId: number, patch: Partial<ChecklistItemState>) => void;
}) {
  const [draft, setDraft] = React.useState(value ?? "");
  // Follow the server when it changes underneath (another tab, another teammate).
  React.useEffect(() => setDraft(value ?? ""), [value]);

  const commit = () => {
    const next = draft.trim() || null;
    if (next !== (value ?? null)) save(itemId, { url: next });
  };

  return (
    <div className="mt-1 flex items-center gap-1.5">
      {icon && <span className="text-text-subtle shrink-0">{icon}</span>}
      <input
        type="url"
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-7 rounded-md border border-border-strong bg-surface px-2 text-small text-text w-full max-w-[340px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
      />
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="text-accent shrink-0 hover:opacity-80"
          aria-label="เปิดลิงก์"
        >
          <ExternalLink size={14} strokeWidth={1.75} />
        </a>
      )}
    </div>
  );
}

function DateInput({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-7 rounded-md border border-border-strong bg-surface px-2 num text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
    />
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
