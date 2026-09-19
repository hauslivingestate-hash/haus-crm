"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { editFbGroupPost, recordFbGroupPost, setBoardStep, setExclusiveDates } from "@/lib/mutations/support";
import {
  FB_GROUP_DAYS,
  FB_GROUP_SLOTS,
  PIN_ALERT_DAYS,
  isUrl,
  type FbBoardRow,
} from "@/lib/supportRules";
import { daysSince } from "@/lib/checklists";
import { formatBaht, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/* Facebook Post (Ben, 2026-09-19): every live A-List / Exclusive listing laid out as a row,
   Exclusive first, each tier grouped by sale. Exclusive carries three extra date columns.
   Every cell writes straight to the database; the row stays disabled until the refresh has
   landed (the two write-path rules in CLAUDE.md, Phase 5 #6). */

type Result = { ok: true } | { ok: false; error: string };

function useRowAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<Result>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      startRefresh(() => router.refresh());
      return true;
    } catch {
      setError("บันทึกไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วลองใหม่");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy: busy || refreshing, error };
}

export function FacebookBoard({ rows }: { rows: FbBoardRow[] }) {
  const exclusive = rows.filter((r) => r.tier === "exclusive");
  const aList = rows.filter((r) => r.tier === "a_list");
  const due = rows.filter((r) => r.groupOverdue).length;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-small text-text-muted">
        ทรัพย์ที่ประกาศอยู่ (Posted) · Exclusive {exclusive.length} · A-List {aList.length} · ถึงรอบโพสต์กลุ่ม{" "}
        <span className={cn(due && "text-red font-medium")}>{due}</span> · โพสต์กลุ่มทุก {FB_GROUP_DAYS} วัน เก็บลิงก์{" "}
        {FB_GROUP_SLOTS} โพสต์ล่าสุด
      </p>
      <Tier title="Exclusive" rows={exclusive} exclusive />
      <Tier title="A-List" rows={aList} exclusive={false} />
    </div>
  );
}

function Tier({ title, rows, exclusive }: { title: string; rows: FbBoardRow[]; exclusive: boolean }) {
  // Rows arrive sorted by sale already; cut them into runs.
  const groups: { sale: string; rows: FbBoardRow[] }[] = [];
  for (const r of rows) {
    const sale = r.saleName ?? "ไม่ระบุเซล";
    const last = groups[groups.length - 1];
    if (last && last.sale === sale) last.rows.push(r);
    else groups.push({ sale, rows: [r] });
  }
  const cols = exclusive ? 16 : 13;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h2">
        {title} <span className="text-text-subtle font-normal">· {rows.length}</span>
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-small border-collapse">
          <thead className="bg-surface-2 text-text-muted">
            <tr className="text-left">
              <Th>Listing ID</Th>
              {exclusive && (
                <>
                  <Th>วันเริ่มสัญญา</Th>
                  <Th>วันสิ้นสุดสัญญา</Th>
                  <Th>วันที่ปักหมุด</Th>
                </>
              )}
              <Th>Project name</Th>
              <Th className="text-right">Price</Th>
              <Th>Template Link</Th>
              <Th className="text-center">Marketplace</Th>
              <Th className="text-center">Profile</Th>
              <Th className="text-center">Page</Th>
              {Array.from({ length: FB_GROUP_SLOTS }, (_, i) => (
                <Th key={i} className="text-center">
                  Group {i + 1}
                </Th>
              ))}
              <Th>โพสต์กลุ่มใหม่</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="p-6 text-center text-text-subtle">
                  ไม่มีทรัพย์ {title} ที่ประกาศอยู่
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <React.Fragment key={g.sale}>
                <tr className="bg-accent-wash/40">
                  <td colSpan={cols} className="px-3 py-1.5 text-body font-semibold text-text">
                    {g.sale} <span className="text-text-subtle font-normal">· {g.rows.length}</span>
                  </td>
                </tr>
                {g.rows.map((r) => (
                  <BoardRow key={r.listingId} row={r} exclusive={exclusive} cols={cols} />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 font-medium whitespace-nowrap border-b border-border", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 align-middle whitespace-nowrap border-b border-border", className)}>{children}</td>;
}

function BoardRow({ row, exclusive, cols }: { row: FbBoardRow; exclusive: boolean; cols: number }) {
  const { run, busy, error } = useRowAction();
  const pinAge = row.pinnedOn ? daysSince(row.pinnedOn) : null;
  const pinLate = pinAge != null && pinAge > PIN_ALERT_DAYS;
  const newest = row.lastGroupPost;

  return (
    <>
      <tr className={cn("hover:bg-surface-2/60", busy && "opacity-60")}>
        <Td>
          <Link href={`/listings/${row.listingId}`} className="font-semibold text-accent-ink hover:underline num">
            {row.listingId}
          </Link>
        </Td>
        {exclusive && (
          <>
            <Td>
              <DateCell
                value={row.agreementStart}
                disabled={busy}
                onCommit={(v) => run(() => setExclusiveDates(row.listingId, { agreementStart: v }))}
              />
            </Td>
            <Td>
              <DateCell
                value={row.agreementEnd}
                disabled={busy}
                onCommit={(v) => run(() => setExclusiveDates(row.listingId, { agreementEnd: v }))}
              />
            </Td>
            <Td className={cn(pinLate && "bg-red-bg")}>
              <DateCell
                value={row.pinnedOn}
                disabled={busy}
                className={cn(pinLate && "text-red font-semibold")}
                onCommit={(v) => run(() => setExclusiveDates(row.listingId, { pinnedOn: v }))}
              />
              {pinAge != null && (
                <div className={cn("text-label", pinLate ? "text-red" : "text-text-subtle")}>{pinAge} วัน</div>
              )}
            </Td>
          </>
        )}
        <Td className="max-w-56 truncate">{row.projectName ?? "—"}</Td>
        <Td className="text-right num">{formatBaht(row.price)}</Td>
        <Td>
          <LinkCell
            value={row.templateLink}
            disabled={busy}
            onCommit={(v) => run(() => setBoardStep(row.listingId, "template_link", v))}
          />
        </Td>
        {(["marketplace", "profile", "page"] as const).map((k) => (
          <Td key={k} className="text-center">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)] cursor-pointer"
              checked={row[k]}
              disabled={busy}
              onChange={(e) => run(() => setBoardStep(row.listingId, k, e.target.checked))}
            />
          </Td>
        ))}
        {Array.from({ length: FB_GROUP_SLOTS }, (_, i) => {
          const post = row.groupPosts.find((p) => p.slot === i + 1);
          return (
            <Td key={i} className="text-center">
              {post ? (
                <GroupSlotCell
                  post={post}
                  newest={post.postedOn === newest}
                  disabled={busy}
                  onSave={(url) => run(() => editFbGroupPost(row.listingId, post.slot, url))}
                />
              ) : (
                <span className="text-text-subtle">—</span>
              )}
            </Td>
          );
        })}
        <Td className={cn(row.groupOverdue && "bg-red-bg")}>
          <NewPostCell
            overdue={row.groupOverdue}
            last={row.lastGroupPost}
            disabled={busy}
            onPost={(url) => run(() => recordFbGroupPost(row.listingId, url))}
          />
        </Td>
      </tr>
      {error && (
        <tr>
          <td colSpan={cols} className="px-3 py-1.5 text-small text-red bg-red-bg border-b border-border">
            {row.listingId}: {error}
          </td>
        </tr>
      )}
    </>
  );
}

/** A date that saves when the field is left. Cleared = null. */
function DateCell({
  value,
  disabled,
  className,
  onCommit,
}: {
  value: string | null;
  disabled: boolean;
  className?: string;
  onCommit: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      key={value ?? ""}
      disabled={disabled}
      // On blur, not on change: typing a year digit by digit fires change events for
      // years like 0002, and each one would be saved.
      onBlur={(e) => {
        const v = e.target.value || null;
        if (v !== value) onCommit(v);
      }}
      className={cn("h-7 rounded border border-border bg-surface px-1.5 text-small num", className)}
    />
  );
}

/** Template Link: shows the link; click ✎ to paste a new one, saved on blur / Enter. */
function LinkCell({
  value,
  disabled,
  onCommit,
}: {
  value: string | null;
  disabled: boolean;
  onCommit: (v: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const save = async () => {
    setEditing(false);
    if (draft.trim() === (value ?? "")) return;
    const ok = await onCommit(draft.trim());
    if (!ok) setDraft(value ?? "");
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        placeholder="วางลิงก์ Template"
        className="h-7 w-48 rounded border border-border-strong bg-surface px-1.5 text-small"
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      {value ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline inline-flex items-center gap-1">
          เปิด <ExternalLink size={11} />
        </a>
      ) : (
        <span className="text-text-subtle">—</span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className="text-text-subtle hover:text-text text-label underline"
      >
        {value ? "แก้" : "ใส่ลิงก์"}
      </button>
    </span>
  );
}

/** Paste a new group-post link; it lands in the next slot (or over the oldest). */
function NewPostCell({
  overdue,
  last,
  disabled,
  onPost,
}: {
  overdue: boolean;
  last: string | null;
  disabled: boolean;
  onPost: (url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = React.useState("");
  const status = last == null ? "ยังไม่เคยโพสต์" : overdue ? `เกินรอบ · ${daysSince(last)} วัน` : `อีก ${FB_GROUP_DAYS - daysSince(last)} วัน`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="วางลิงก์โพสต์"
          disabled={disabled}
          className="h-7 w-40 rounded border border-border bg-surface px-1.5 text-small"
        />
        <button
          type="button"
          disabled={disabled || !isUrl(url)}
          onClick={async () => {
            if (await onPost(url)) setUrl("");
          }}
          className="h-7 w-7 grid place-items-center rounded bg-accent text-text-onaccent disabled:opacity-40"
          aria-label="บันทึกโพสต์"
        >
          <Plus size={14} />
        </button>
      </div>
      <span className={cn("text-label", overdue ? "text-red font-medium" : "text-text-subtle")}>{status}</span>
    </div>
  );
}

/** One of the five group-post slots: open the link, or ✎ to fix a mistyped link / remove it. */
function GroupSlotCell({
  post,
  newest,
  disabled,
  onSave,
}: {
  post: { slot: number; url: string; postedOn: string };
  newest: boolean;
  disabled: boolean;
  onSave: (url: string | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(post.url);

  if (editing) {
    const close = () => {
      setDraft(post.url);
      setEditing(false);
    };
    return (
      <div className="flex flex-col items-stretch gap-1 min-w-52">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="h-7 rounded border border-border-strong bg-surface px-1.5 text-small"
        />
        <div className="flex items-center justify-end gap-1.5 text-label">
          <button
            type="button"
            disabled={disabled}
            onClick={async () => {
              if (!window.confirm(`ลบลิงก์ช่อง Group ${post.slot} (${formatDate(post.postedOn)})?`)) return;
              if (await onSave(null)) setEditing(false);
            }}
            className="px-2 h-6 rounded text-red hover:bg-red-bg"
          >
            ลบ
          </button>
          <button type="button" onClick={close} className="px-2 h-6 rounded text-text-muted hover:bg-surface-2">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={disabled || !isUrl(draft) || draft.trim() === post.url}
            onClick={async () => {
              if (await onSave(draft)) setEditing(false);
            }}
            className="px-2 h-6 rounded bg-accent text-text-onaccent disabled:opacity-40"
          >
            บันทึก
          </button>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={post.url}
        target="_blank"
        rel="noreferrer"
        className={cn("inline-flex items-center gap-1 hover:underline", newest ? "text-accent-ink font-semibold" : "text-text-muted")}
        title={post.url}
      >
        {formatDate(post.postedOn).slice(0, 5)} <ExternalLink size={11} />
      </a>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(post.url);
          setEditing(true);
        }}
        className="text-text-subtle hover:text-text"
        aria-label={`แก้ลิงก์ Group ${post.slot}`}
        title="แก้หรือลบลิงก์"
      >
        <Pencil size={11} />
      </button>
    </span>
  );
}
