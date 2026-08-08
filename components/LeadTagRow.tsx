"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { useMasterData } from "@/components/MasterDataProvider";
import { setLeadTag } from "@/lib/mutations/leads";
import { findTag, TAG_TONE_CLASS } from "@/lib/tags";
import { cn } from "@/lib/cn";

// The lead's group tag on the DETAIL page. `tagId` comes from the server-fetched lead row
// (main_6_buyer_crm.tag_id) — the vocabulary (which tags exist) is still the seeded list in
// MasterDataProvider, which matches lead_tags_ref in the DB, so only the write side needed
// wiring here.
//
// Same rules as the leads table (LeadsBrowser.tsx): ONE tag per lead, chosen from the
// CEO-governed list, no create path. Optimistic locally, then persisted — on failure the
// parent server data wins on the next refresh anyway.
export function LeadTagRow({ leadId, tagId }: { leadId: string; tagId: string | null }) {
  const router = useRouter();
  const { leadTags } = useMasterData();
  const [current, setCurrent] = React.useState(tagId);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setCurrent(tagId), [tagId]);

  async function pick(next: string | null) {
    setOpen(false);
    const prev = current;
    setCurrent(next);
    const result = await setLeadTag(leadId, next);
    if (!result.ok) {
      setCurrent(prev);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  const tag = findTag(leadTags, current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={tag ? `เปลี่ยนแท็ก (${tag.label})` : "เลือกแท็ก"}
      >
        {tag ? (
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-label font-medium",
              TAG_TONE_CLASS[tag.tone]
            )}
          >
            {tag.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-1.5 py-0.5 text-label text-text-subtle hover:text-accent hover:border-accent transition-colors">
            <Plus size={11} strokeWidth={2} /> แท็ก
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-52 rounded-lg border border-border bg-surface shadow-pop p-2 flex flex-col gap-0.5">
            <div className="px-2 pt-1 pb-1.5 text-label text-text-subtle">เลือกได้ 1 แท็ก</div>
            {leadTags.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover transition-colors text-left"
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-label font-medium",
                    TAG_TONE_CLASS[t.tone]
                  )}
                >
                  {t.label}
                </span>
                {tag?.id === t.id && <Check size={14} strokeWidth={2.5} className="text-accent shrink-0" />}
              </button>
            ))}
            {leadTags.length === 0 && (
              <div className="px-2 py-3 text-center text-label text-text-subtle">
                ยังไม่มีแท็ก — ตั้งค่าที่ ตั้งค่า → แท็ก Lead
              </div>
            )}
            {tag && (
              <button
                onClick={() => pick(null)}
                className="mt-1 border-t border-border pt-2 px-2 pb-1 text-left text-small text-text-muted hover:text-accent transition-colors"
              >
                เอาแท็กออก
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
