"use client";

import * as React from "react";
import { Megaphone, Copy, Check, X } from "lucide-react";
import type { ListingRow } from "@/lib/queries";
import { useCopyTemplates } from "@/components/CopyTemplatesProvider";
import { listingCopy } from "@/lib/listingCopy";
import { cn } from "@/lib/cn";
import { useTopmostEscape } from "@/lib/overlayStack";

// "สร้างคำโฆษณา" — reveals the server/template-generated ad copy for a listing in a drawer,
// split into the three ready-to-paste blocks (Headline · Normal · DDproperty), each with
// copy-to-clipboard. Reads live templates from CopyTemplatesProvider (Settings edits flow here).
export function ListingCopyButton({ listing }: { listing: ListingRow }) {
  const { templates } = useCopyTemplates();
  const [open, setOpen] = React.useState(false);
  const copy = React.useMemo(() => listingCopy(listing, templates), [listing, templates]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full h-9 rounded-md border border-border-strong text-body font-medium text-text hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Megaphone size={15} strokeWidth={1.75} /> สร้างคำโฆษณา
      </button>
      {open && <CopyDrawer copy={copy} onClose={() => setOpen(false)} />}
    </>
  );
}

function CopyDrawer({
  copy,
  onClose,
}: {
  copy: { headline: string; normal: string; dd: string };
  onClose: () => void;
}) {
  // Escape is handled by the overlay stack, not by a bare document listener: this sheet
  // can open INSIDE the detail drawer, and two listeners meant one key press closed both.
  // See lib/overlayStack.ts.
  useTopmostEscape(onClose);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-h2 flex items-center gap-2">
              <Megaphone size={18} strokeWidth={1.75} className="text-accent" />
              คำโฆษณา
            </div>
            <p className="text-small text-text-muted mt-0.5">คัดลอกไปโพสต์ตามช่องทาง</p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <CopyBlock label="หัวข้อ (Headline)" text={copy.headline} />
        <CopyBlock label="โพสต์ทั่วไป · Facebook / Livinginsider / PropertyHub" text={copy.normal} />
        <CopyBlock label="DDproperty" text={copy.dd} />
      </div>
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = React.useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-small text-text-muted">{label}</span>
        <button
          onClick={doCopy}
          className={cn(
            "text-label inline-flex items-center gap-1 transition-colors",
            copied ? "text-green" : "text-accent hover:underline"
          )}
        >
          {copied ? (
            <>
              <Check size={12} strokeWidth={2.5} /> คัดลอกแล้ว
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={1.75} /> คัดลอก
            </>
          )}
        </button>
      </div>
      <pre className="text-small text-text whitespace-pre-wrap font-sans bg-surface-2 border border-border rounded-md p-3 max-h-56 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}
