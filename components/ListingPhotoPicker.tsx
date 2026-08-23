"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  compressPhoto,
  formatBytes,
  MAX_PHOTOS_PER_LISTING,
  PHOTO_MAX_EDGE,
} from "@/lib/imageCompress";
import { addListingPhoto } from "@/lib/mutations/listingPhotos";
import { cn } from "@/lib/cn";

// Photo picker for the ADD-LISTING form, where ListingPhotoManager cannot be used: there is
// no listing_id until the row is inserted (the trigger mints it from property type + zone),
// and the storage path is keyed on it.
//
// So files are held here, compressed and previewed locally, and uploaded by `uploadStaged`
// once the form has an id back. The rep picks photos in the same pass as everything else
// rather than being sent to the listing page afterwards to do a second job.

export interface StagedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

export function ListingPhotoPicker({
  photos,
  onChange,
  disabled,
}: {
  photos: StagedPhoto[];
  onChange: (next: StagedPhoto[]) => void;
  disabled?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const remaining = MAX_PHOTOS_PER_LISTING - photos.length;

  // Object URLs are leaked memory until revoked; drop them when the picker unmounts.
  React.useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (files: FileList) => {
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, remaining));
    onChange([
      ...photos,
      ...picked.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const remove = (id: string) => {
    const gone = photos.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.previewUrl);
    onChange(photos.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-label text-text-muted">รูปทรัพย์</span>
        <span className="num text-label text-text-subtle">
          {photos.length}/{MAX_PHOTOS_PER_LISTING}
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || remaining <= 0}
          className="ml-auto h-8 px-3 rounded-md border border-border-strong text-small font-medium text-text-muted inline-flex items-center gap-1.5 hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          <ImagePlus size={14} strokeWidth={1.75} />
          {remaining > 0 ? "เลือกรูป" : "ครบ 20 รูปแล้ว"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="relative aspect-square rounded-md overflow-hidden border border-border bg-surface-2"
            >
              {/* Local object URL — next/image would need a configured host and buys
                  nothing for a thumbnail that exists only until submit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute top-0.5 left-0.5 text-label rounded px-1 bg-black/60 text-white">
                  ปก
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={disabled}
                aria-label="เอารูปออก"
                className="absolute top-0.5 right-0.5 size-5 grid place-items-center rounded bg-black/60 text-white hover:bg-red disabled:opacity-50"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className={cn("text-label text-text-subtle", photos.length && "sr-only")}>
        ย่อเหลือ <span className="num">{PHOTO_MAX_EDGE}</span> px และบีบอัดให้อัตโนมัติตอนบันทึก ·
        รูปแรกเป็นหน้าปก
      </p>
    </div>
  );
}

/**
 * Upload the staged photos once the listing exists.
 *
 * Returns how many made it. Called AFTER createListing succeeds, so a failure here costs
 * photos, never the listing — the caller says so rather than pretending the whole save
 * failed and inviting a duplicate.
 */
export async function uploadStaged(
  listingId: string,
  photos: StagedPhoto[],
  onProgress?: (msg: string) => void
): Promise<{ uploaded: number; error: string | null }> {
  const supabase = supabaseBrowser();
  let uploaded = 0;

  for (const [i, p] of photos.entries()) {
    try {
      onProgress?.(`กำลังบีบอัดรูป ${i + 1}/${photos.length}…`);
      const out = await compressPhoto(p.file);
      const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${out.ext}`;
      const path = `${listingId}/${name}`;

      onProgress?.(
        `กำลังอัปโหลดรูป ${i + 1}/${photos.length} · ${formatBytes(out.originalBytes)} → ${formatBytes(out.blob.size)}`
      );
      const { error: upErr } = await supabase.storage
        .from("listing-photos")
        .upload(path, out.blob, { contentType: out.blob.type, upsert: false });
      if (upErr) return { uploaded, error: upErr.message };

      const res = await addListingPhoto(listingId, path);
      if (!res.ok) return { uploaded, error: res.error };
      uploaded++;
    } catch (e) {
      return { uploaded, error: e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ" };
    }
  }
  return { uploaded, error: null };
}
