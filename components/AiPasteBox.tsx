"use client";

import * as React from "react";
import { Sparkles, Info, Loader2, Check, AlertCircle } from "lucide-react";
import { useParseQueue } from "@/components/ParseQueueProvider";
import type { ParseKind } from "@/lib/ai/types";

/* Paste LINE/message/broker text → pre-fill the form you are already standing in.
 *
 * ── IT QUEUES, IT DOES NOT WAIT ─────────────────────────────────────────────────
 * This used to await the parse and hold the form busy for the duration. It now hands the
 * text to the queue (lib/ai/jobs.ts) and returns immediately, which is the whole point: the
 * next message can be pasted while the first is still being read, and closing this form — or
 * locking the phone, or switching to LINE — no longer kills the parse.
 *
 * If you DO stay, you get it in place anyway: the box watches its own job and, when it
 * lands, opens it as the reviewed draft, which is the same path the tray uses. One
 * mechanism, so a draft filled from here and a draft filled from the tray behave
 * identically — including being marked `saved` when the form is submitted.
 *
 * The AI only ever pre-fills. It never persists; a person reviews and edits before บันทึก.
 */

const HINTS: Record<ParseKind, string[]> = {
  lead: [
    "ชื่อลูกค้า/เจ้าของ และเบอร์โทร (เช่น คุณเบิร์ด 081-234-5678)",
    "งบหรือราคา — พิมพ์เป็น “3.5 ล้าน” หรือ “฿3,500,000” ก็ได้",
    "ทำเล · ประเภททรัพย์ · รหัสทรัพย์ที่ถามถึง",
    "ช่องทางที่ติดต่อมา (LINE / โทร / Facebook)",
  ],
  listing: [
    "ชื่อโครงการ · ทำเล · ประเภททรัพย์",
    "ห้องนอน/ห้องน้ำ · พื้นที่ ตร.ม. · ชั้น · ทิศ · วิว",
    "ราคาขาย และ/หรือ ค่าเช่าต่อเดือน — “5.9 ล้าน” อ่านได้",
    "ชื่อ เบอร์ และ LINE ของเจ้าของ",
  ],
};

export function AiPasteBox({ kind }: { kind: ParseKind }) {
  const { canParse, enqueue, byId, open } = useParseQueue();
  const [raw, setRaw] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [watching, setWatching] = React.useState<number | null>(null);
  const [showHints, setShowHints] = React.useState(false);

  const job = byId(watching);

  // The job landed while this form was still open → review it here, through the same path
  // the tray uses. `open()` is idempotent for a job that is already the opened one.
  React.useEffect(() => {
    if (job?.status === "done") {
      open(job);
      setWatching(null);
    }
  }, [job, open]);

  if (!canParse(kind)) return null;

  const run = async () => {
    if (!raw.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const id = await enqueue(kind, raw);
      setWatching(id);
      // Cleared on success so the next message can go straight in — the batching rhythm the
      // queue exists for.
      setRaw("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  };

  const busy = sending || (!!job && (job.status === "queued" || job.status === "running"));

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} strokeWidth={2} className="text-accent" />
        <span className="text-small font-medium">วางข้อความเพื่อกรอกอัตโนมัติ</span>
        <span className="num text-[9px] uppercase tracking-wide text-text-subtle bg-surface rounded px-1 py-0.5 border border-border">
          AI
        </span>
        <button
          type="button"
          onClick={() => setShowHints((s) => !s)}
          className="ml-auto inline-flex items-center gap-1 text-label text-text-subtle hover:text-text transition-colors"
        >
          <Info size={12} strokeWidth={1.75} /> อ่านอะไรได้บ้าง
        </button>
      </div>

      {showHints && (
        <ul className="text-label text-text-muted list-disc pl-4 space-y-0.5">
          {HINTS[kind].map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={2}
        placeholder={
          kind === "lead"
            ? "เช่น: คุณเบิร์ด สนใจคอนโดอโศก 2 ห้องนอน งบ 6 ล้าน โทรมา 081-234-5678"
            : "เช่น: ขายคอนโด ลุมพินี พระราม 9 ชั้น 12 1 นอน 35 ตร.ม. 3.2 ล้าน เจ้าของคุณเอ 081-234-5678"
        }
        className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-small resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={!raw.trim() || sending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent text-text-onaccent text-small font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={2} />}
          {sending ? "กำลังส่ง…" : "แยกข้อมูล"}
        </button>

        {/* The status line is the honest version of the old spinner: the work is elsewhere
            now, and saying "ปิดหน้านี้ได้" is the difference between a queue people trust
            and one they sit and watch anyway. */}
        {error ? (
          <span className="text-label text-red inline-flex items-center gap-1 min-w-0">
            <AlertCircle size={13} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">{error}</span>
          </span>
        ) : job?.status === "error" ? (
          <span className="text-label text-red inline-flex items-center gap-1 min-w-0">
            <AlertCircle size={13} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">{job.error}</span>
          </span>
        ) : busy ? (
          <span className="text-label text-text-muted inline-flex items-center gap-1 min-w-0">
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span className="truncate">AI กำลังอ่าน — ปิดหน้านี้ได้ ผลจะรออยู่ในถาด</span>
          </span>
        ) : (
          <span className="text-label text-text-subtle truncate">
            วางได้ทีละหลายข้อความ ไม่ต้องรอ
          </span>
        )}
      </div>
    </div>
  );
}

/** Applied to a draft that came back from the queue — shown above the form it filled. */
export function AiDraftNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <div className="rounded-md px-2.5 py-2 text-label border border-green/30 bg-green-bg text-green inline-flex items-start gap-1.5">
      <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0" />
      <span>{note}</span>
    </div>
  );
}
