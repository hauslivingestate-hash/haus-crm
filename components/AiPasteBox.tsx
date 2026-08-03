"use client";

import * as React from "react";
import { Sparkles, Info, Loader2, Check } from "lucide-react";
import { parseLeadText, LEAD_PARSE_HINTS, type LeadDraft } from "@/lib/ai/parseLead";
import { cn } from "@/lib/cn";

// Paste LINE/message/broker text → pre-fill the intake form. The AI ONLY pre-fills; the
// admin reviews and edits before saving (it never persists). Design-first: the parse is a
// heuristic stub today (see lib/ai/parseLead) — same UX + contract as the real OpenAI wiring.
export function AiPasteBox({ onFilled }: { onFilled: (draft: LeadDraft, note: string) => void }) {
  const [raw, setRaw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [showHints, setShowHints] = React.useState(false);

  const run = async () => {
    if (!raw.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await parseLeadText(raw);
    setBusy(false);
    if (res.ok) {
      onFilled(res.draft, res.note);
      setNote(res.note);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} strokeWidth={2} className="text-accent" />
        <span className="text-small font-medium">วางข้อความเพื่อกรอกอัตโนมัติ</span>
        <span className="num text-[9px] uppercase tracking-wide text-text-subtle bg-surface rounded px-1 py-0.5 border border-border">AI</span>
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
          {LEAD_PARSE_HINTS.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={2}
        placeholder="เช่น: คุณเบิร์ด สนใจคอนโดอโศก 2 ห้องนอน งบ 6 ล้าน โทรมา 081-234-5678"
        className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-small resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={!raw.trim() || busy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent text-text-onaccent text-small font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={2} />}
          {busy ? "กำลังแยกข้อมูล…" : "แยกข้อมูล"}
        </button>
        {note && (
          <span className="text-label text-green inline-flex items-center gap-1 min-w-0">
            <Check size={13} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">{note}</span>
          </span>
        )}
        {error && <span className="text-label text-red">{error}</span>}
      </div>
    </div>
  );
}
