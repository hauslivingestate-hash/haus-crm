"use client";

/* The always-there half of the AI queue: a paste button, a status chip, and the list.
 *
 * ── THE RHYTHM THIS IS BUILT FOR ────────────────────────────────────────────────
 * Lead intake is LINE → CRM, several messages at a time. The paste sheet matches that:
 * choose ทรัพย์ or ลีด, paste, send, and the box clears itself and waits for the next one.
 * It deliberately does NOT close on send — batching is the reason it exists, and re-opening
 * a sheet five times is exactly the friction being removed.
 *
 * The chip beside it is the only place a running parse is visible, and it never interrupts:
 * no toast steals focus mid-edit somewhere else. The count just changes and waits to be
 * tapped.
 */

import * as React from "react";
import {
  AlertCircle,
  ClipboardPaste,
  Loader2,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useParseQueue } from "@/components/ParseQueueProvider";
import { PARSE_KIND_LABEL, type ParseJob, type ParseKind } from "@/lib/ai/types";
import { cn } from "@/lib/cn";

const PLACEHOLDER: Record<ParseKind, string> = {
  listing: "วางข้อความฝากขาย/โพสต์โบรกเกอร์จาก LINE…",
  lead: "วางแชทลูกค้าจาก LINE…",
};

export function ParseTray() {
  const { jobs, working, ready, failed, enabled, canParse, open, close, retry } = useParseQueue();
  const [sheet, setSheet] = React.useState(false);
  const [list, setList] = React.useState(false);

  // The whole tray — paste button, chip, list — belongs to the ai.parse.* pair. Without
  // either there is nothing to queue and nothing to review, so this is one early return
  // rather than three gated fragments.
  if (!enabled) return null;

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        {list && jobs.length > 0 && (
          <JobList
            onClose={() => setList(false)}
            onOpen={(j) => {
              setList(false);
              open(j);
            }}
            onDiscard={(id) => close(id, "discarded")}
            onRetry={retry}
          />
        )}

        <div className="flex items-center gap-2">
          {jobs.length > 0 && (
            <button
              type="button"
              onClick={() => setList((v) => !v)}
              aria-expanded={list}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 h-9 text-small font-medium shadow-pop transition-colors hover:bg-surface-hover",
                failed > 0 ? "text-red" : working > 0 ? "text-text-muted" : "text-green"
              )}
            >
              {working > 0 ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> กำลังอ่าน {working}
                </>
              ) : failed > 0 ? (
                <>
                  <AlertCircle size={14} /> อ่านไม่สำเร็จ {failed}
                </>
              ) : (
                <>
                  <Sparkles size={14} /> พร้อมตรวจ {ready.length}
                </>
              )}
            </button>
          )}

          {/* The point of the tray: paste from anywhere, not only from inside เพิ่มลีด. */}
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-label="วางข้อความให้ AI อ่าน"
            className="size-12 grid place-items-center rounded-full border border-border bg-surface text-accent shadow-pop hover:bg-surface-hover transition-colors"
          >
            <ClipboardPaste size={19} strokeWidth={2} />
          </button>
        </div>
      </div>

      {sheet && <PasteSheet onClose={() => setSheet(false)} canParse={canParse} />}
    </>
  );
}

/** Paste, send, paste again. */
function PasteSheet({
  onClose,
  canParse,
}: {
  onClose: () => void;
  canParse: (kind: ParseKind) => boolean;
}) {
  const { enqueue } = useParseQueue();
  const kinds = (["lead", "listing"] as ParseKind[]).filter(canParse);
  const [kind, setKind] = React.useState<ParseKind>(kinds[0] ?? "lead");
  const [raw, setRaw] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(0);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!raw.trim() || sending) return;
    setSending(true);
    setErr(null);
    try {
      await enqueue(kind, raw);
      setRaw("");
      setSent((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} strokeWidth={2} className="text-accent" />
            <span className="text-h2">วางข้อความให้ AI อ่าน</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* One kind granted → no toggle. A picker with a single option is a label. */}
        {kinds.length > 1 && (
          <div className="flex gap-1.5">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex-1 h-9 rounded-md border text-small font-medium transition-colors",
                  kind === k
                    ? "bg-text text-background border-text"
                    : "border-border-strong text-text-muted hover:bg-surface-2"
                )}
              >
                {PARSE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          autoFocus
          placeholder={PLACEHOLDER[kind]}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-small resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />

        <div className="flex items-center gap-3">
          <span className="text-label text-text-subtle min-w-0">
            {err ? (
              <span className="text-red font-medium">{err}</span>
            ) : sent > 0 ? (
              <>ส่งแล้ว {sent} ข้อความ · วางข้อความถัดไปได้เลย</>
            ) : (
              "ปิดหน้านี้ได้ระหว่างรอ — AI อ่านต่อให้เอง"
            )}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={sending || !raw.trim()}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-text-onaccent text-small font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            ส่งให้ AI อ่าน
          </button>
        </div>
      </div>
    </div>
  );
}

function JobList({
  onClose,
  onOpen,
  onDiscard,
  onRetry,
}: {
  onClose: () => void;
  onOpen: (job: ParseJob) => void;
  onDiscard: (id: number) => void;
  onRetry: (id: number) => Promise<void>;
}) {
  const { jobs } = useParseQueue();
  return (
    <div className="w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-small font-medium">ข้อความที่ AI อ่าน</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="size-7 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
      <ul className="max-h-[50vh] overflow-y-auto p-1.5 flex flex-col gap-0.5">
        {jobs.map((j) => (
          <li key={j.id} className="rounded-md px-2 py-2 hover:bg-surface-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                {j.status === "done" ? (
                  <Sparkles size={14} className="text-green" />
                ) : j.status === "error" ? (
                  <AlertCircle size={14} className="text-red" />
                ) : (
                  <Loader2 size={14} className="animate-spin text-text-subtle" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium">{j.title}</p>
                <p className="text-label text-text-subtle truncate">
                  {PARSE_KIND_LABEL[j.kind]} ·{" "}
                  {j.status === "done"
                    ? j.note ?? "พร้อมตรวจ"
                    : j.status === "error"
                      ? j.error
                      : "กำลังอ่าน…"}
                </p>
              </div>
            </div>
            <div className="mt-1.5 flex justify-end gap-1.5">
              {j.status === "done" && (
                <button
                  type="button"
                  onClick={() => onOpen(j)}
                  className="h-7 px-2.5 rounded-md bg-accent text-text-onaccent text-label font-medium hover:bg-accent-hover transition-colors"
                >
                  ตรวจและบันทึก
                </button>
              )}
              {j.status === "error" && (
                <button
                  type="button"
                  onClick={() => onRetry(j.id)}
                  className="h-7 px-2.5 rounded-md border border-border-strong text-text-muted text-label font-medium inline-flex items-center gap-1 hover:bg-surface-2 transition-colors"
                >
                  <RotateCw size={11} /> ลองใหม่
                </button>
              )}
              {/* Nothing to bin while it is still being read — cancelling mid-flight would
                  leave the `after()` callback writing to a row nobody is watching. */}
              {j.status !== "queued" && j.status !== "running" && (
                <button
                  type="button"
                  onClick={() => onDiscard(j.id)}
                  aria-label="ทิ้ง"
                  title="ทิ้ง"
                  className="size-7 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-red transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
