"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, Home, Search, Plus, AlertCircle, UserRound, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useRbac } from "@/components/RbacProvider";
import { useMasterData } from "@/components/MasterDataProvider";
import { searchProjects, type ProjectHit } from "@/lib/search";
import { createListing, createProject } from "@/lib/mutations/listings";
import {
  LISTING_SECTIONS,
  emptyListingDraft,
  type ListingFieldGroup,
} from "@/lib/listingFields";
import { ListingSectionBlock, type DraftValue } from "@/components/ListingFieldInput";
import {
  ListingPhotoPicker,
  uploadStaged,
  type StagedPhoto,
} from "@/components/ListingPhotoPicker";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// เพิ่มทรัพย์ — the same field set as แก้ไขทรัพย์, from lib/listingFields.ts.
//
// Ben, 2026-08-23: the two screens were missing thirty fields' worth of each other because
// each kept its own hand-written list. They share one now, so a new column appears on both.
//
// Sections fold: ข้อมูลหลัก is open and the rest start closed. Forty-four inputs in one
// column is unusable on a phone, and about a third of them (portal links, price history)
// cannot be known at the moment a listing is sourced. A folded section that already holds
// something says so in its header rather than hiding it.
//
// Still bespoke rather than generated:
//   • the project picker — a search over 308 projects with inline creation, and the only
//     thing that gives a listing a name (v_main_listing.listing_name = the project's Thai name)
//   • the photo picker — files are staged and uploaded after the insert, since the storage
//     path needs the listing_id the trigger mints
export function ListingForm({
  open,
  onClose,
  ownerName,
}: {
  open: boolean;
  onClose: () => void;
  /** Nickname of the signed-in person — the listing is filed under them, no picker. */
  ownerName: string;
}) {
  const router = useRouter();
  const { can } = useRbac();
  const [draft, setDraft] = React.useState<Record<string, DraftValue>>(() => emptyListingDraft());
  const [projectId, setProjectId] = React.useState("");
  const [projectLabel, setProjectLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<StagedPhoto[]>([]);
  const [progress, setProgress] = React.useState<string | null>(null);
  // Portal to <body>: this form is triggered from a button inside the backdrop-blur Topbar,
  // and backdrop-filter establishes a containing block for position:fixed — without the
  // portal the overlay would be positioned relative to the header, not the viewport.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setDraft(emptyListingDraft());
      setProjectId("");
      setProjectLabel("");
      setBusy(false);
      setError(null);
      setCreatedId(null);
      setPhotos([]);
      setProgress(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const setField = (key: string, value: DraftValue) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Presentation only — the same split is enforced in createListing.
  const canEditGroup = (group: ListingFieldGroup) =>
    group === "marketing"
      ? can("listings.marketing") || can("roles.manage")
      : can("listings.create") || can("listings.edit") || can("roles.manage");

  // Type + zone are what the listing code is built from, so they are the real minimum.
  const canSave = !!draft.property_type && !!draft.zone && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);

    try {
      const result = await createListing({ project_id: projectId, values: draft });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // The listing is saved from here on. A photo failure costs photos, not the listing —
      // saying "failed" would invite a duplicate submission.
      if (photos.length) {
        const up = await uploadStaged(result.listingId, photos, setProgress);
        setProgress(null);
        if (up.error) {
          setError(
            `บันทึกทรัพย์ ${result.listingId} แล้ว แต่อัปโหลดรูปได้ ${up.uploaded}/${photos.length} — เพิ่มรูปที่เหลือได้ที่หน้าทรัพย์ (${up.error})`
          );
        }
      }

      setCreatedId(result.listingId);
      setDraft(emptyListingDraft());
      setProjectId("");
      setProjectLabel("");
      setPhotos([]);
      router.refresh();
    } catch (err) {
      // A rejected server action is not the same as { ok: false }. Without this the form
      // sat on "กำลังบันทึก…" with nothing saved and nothing said — which is exactly what
      // it did the first time this rewrite was tested.
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-2xl bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop flex flex-col max-h-[92vh]"
      >
        {/* Header and footer stay put; only the middle scrolls, so บันทึกทรัพย์ is always
            reachable no matter how many sections are open. */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-accent-wash grid place-items-center shrink-0">
              <Home size={16} strokeWidth={2} className="text-accent" />
            </span>
            <div className="leading-tight">
              <div className="text-h2">เพิ่มทรัพย์ใหม่</div>
              <div className="text-label text-text-subtle">รหัสทรัพย์สร้างอัตโนมัติจากประเภท + โซน</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-3">
        {/* Filed under whoever is adding it — shown, not chosen. */}
        <div className="shrink-0 h-9 px-3 rounded-md border border-border bg-surface-2 text-body text-text-muted flex items-center gap-2">
          <UserRound size={14} strokeWidth={1.75} className="text-text-subtle" />
          ผู้ดูแล: {ownerName}
          <span className="text-label text-text-subtle ml-auto">บันทึกในชื่อคุณอัตโนมัติ</span>
        </div>

        {LISTING_SECTIONS.map((section) => (
          <ListingSectionBlock
            key={section.key}
            section={section}
            draft={draft}
            onChange={setField}
            canEditGroup={canEditGroup}
            defaultOpen={section.openOnCreate}
          >
            {section.key === "basics" && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-label text-text-muted">โครงการ / หมู่บ้าน</span>
                  <ProjectCombobox
                    value={projectLabel}
                    propertyType={String(draft.property_type ?? "")}
                    zone={String(draft.zone ?? "")}
                    onPick={(id, label) => {
                      setProjectId(id);
                      setProjectLabel(label);
                    }}
                    onError={setError}
                  />
                  <span className="text-label text-text-subtle">
                    ชื่อทรัพย์ที่โชว์ในระบบคือชื่อโครงการ — ถ้าไม่เลือก ทรัพย์นี้จะไม่มีชื่อ
                  </span>
                </label>
                <ListingPhotoPicker photos={photos} onChange={setPhotos} disabled={busy} />
              </>
            )}
          </ListingSectionBlock>
        ))}

        {progress && (
          <div className="rounded-md px-3 py-2 text-small border bg-surface-2 text-text-muted border-border inline-flex items-center gap-1.5">
            <Loader2 size={14} strokeWidth={2} className="animate-spin" /> {progress}
          </div>
        )}
        {error && (
          <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-start gap-1.5">
            <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {createdId && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> เพิ่มทรัพย์แล้ว · รหัส <span className="num font-medium">{createdId}</span>
          </div>
        )}

        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border-strong text-text-muted font-medium hover:bg-surface-2 transition-colors">
            ปิด
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="h-10 px-5 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? "กำลังบันทึก…" : "บันทึกทรัพย์"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// Searchable project picker over the real 308 projects, with inline creation for one that
// isn't on file yet. Creating from here is allowed for plain agents by design — main_3's
// INSERT policy accepts `listings.create`, because otherwise an agent hitting a new village
// would be stuck filing a nameless listing.
function ProjectCombobox({
  value,
  propertyType,
  zone,
  onPick,
  onError,
}: {
  value: string;
  propertyType: string;
  zone: string;
  onPick: (projectId: string, label: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [matches, setMatches] = React.useState<ProjectHit[]>([]);
  const [creating, setCreating] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const query = q.trim();

  // Debounced, with a staleness guard so a slower earlier response can't overwrite a newer one.
  React.useEffect(() => {
    if (!open) return;
    let stale = false;
    const t = setTimeout(async () => {
      const hits = await searchProjects(query);
      if (!stale) setMatches(hits);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, open, query]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (projectId: string, label: string) => {
    onPick(projectId, label);
    setQ("");
    setOpen(false);
  };

  async function createAndPick() {
    if (!query || creating) return;
    setCreating(true);
    onError(null);
    const result = await createProject({
      nameThai: query,
      propertyType: propertyType || null,
      zone: zone || null,
    });
    setCreating(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    pick(result.projectId, query);
  }

  const exactExists = matches.some((m) => m.label.trim().toLowerCase() === query.toLowerCase());

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={open ? q : value}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="ค้นหาชื่อโครงการ / หมู่บ้าน…"
          className={cn(field, "pl-8")}
        />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-md border border-border bg-surface shadow-pop max-h-56 overflow-y-auto">
          {value && (
            <button type="button" onClick={() => pick("", "")} className="w-full text-left px-3 py-2 text-small text-text-subtle hover:bg-surface-hover">
              — ล้าง —
            </button>
          )}
          {matches.map((m) => (
            <button
              key={m.projectId}
              type="button"
              onClick={() => pick(m.projectId, m.label)}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
            >
              <div className="text-small truncate">{m.label}</div>
              <div className="text-label text-text-subtle num">{m.projectId}</div>
            </button>
          ))}
          {query && !exactExists && (
            <button
              type="button"
              onClick={createAndPick}
              disabled={creating}
              className="w-full text-left px-3 py-2 border-t border-border text-small text-accent hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={13} strokeWidth={2} />
              {creating ? "กำลังสร้าง…" : `สร้างโครงการใหม่ “${query}”`}
            </button>
          )}
          {!query && matches.length === 0 && (
            <div className="px-3 py-3 text-label text-text-subtle">พิมพ์เพื่อค้นหาโครงการ</div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small text-text-muted">{label}</span>
      {children}
    </label>
  );
}

// Labeled group divided by a hairline — chunks the form into scannable sections (Shelter-style).
function Section({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3", !first && "border-t border-border pt-4")}>
      <span className="text-small font-medium text-text-muted">{title}</span>
      {children}
    </div>
  );
}
