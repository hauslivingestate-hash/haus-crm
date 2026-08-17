"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Trash2, Star, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  compressPhoto,
  formatBytes,
  MAX_PHOTOS_PER_LISTING,
  PHOTO_MAX_EDGE,
} from "@/lib/imageCompress";
import {
  addListingPhoto,
  deleteListingPhoto,
  setListingCover,
} from "@/lib/mutations/listingPhotos";
import { cn } from "@/lib/cn";

// รูปทรัพย์ — sales upload their own, up to 20 per listing.
//
// The file goes straight from here to Supabase Storage; only the resulting path goes
// through a server action. Pushing several MB through the action would double the transfer
// off a phone connection and run into the request body limit.
//
// Every photo is resized to 1920px and re-encoded as WebP BEFORE leaving the device — see
// lib/imageCompress.ts for why (and for what happens on browsers with no WebP encoder).

export interface ListingPhoto {
  photo_id: number;
  photo_url: string;
  sort_order: number | null;
}

export function ListingPhotoManager({
  listingId,
  photos,
  canEdit,
}: {
  listingId: string;
  photos: ListingPhoto[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const working = busy || refreshing;

  const remaining = MAX_PHOTOS_PER_LISTING - photos.length;

  const upload = async (files: FileList) => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    if (files.length > chosen.length) {
      setError(`เลือกได้อีก ${remaining} รูป — ส่วนที่เกินถูกข้าม`);
    }

    let done = 0;
    for (const file of chosen) {
      try {
        setProgress(`กำลังบีบอัด ${done + 1}/${chosen.length}…`);
        const out = await compressPhoto(file);

        // Path carries the listing so the server action can verify it, plus a random
        // suffix — two phones uploading "IMG_0001.jpg" at once must not collide.
        const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${out.ext}`;
        const path = `${listingId}/${name}`;

        setProgress(
          `กำลังอัปโหลด ${done + 1}/${chosen.length} · ${formatBytes(out.originalBytes)} → ${formatBytes(out.blob.size)}`
        );
        const { error: upErr } = await supabase.storage
          .from("listing-photos")
          .upload(path, out.blob, { contentType: out.blob.type, upsert: false });
        if (upErr) {
          setError(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);
          break;
        }

        const res = await addListingPhoto(listingId, path);
        if (!res.ok) {
          setError(res.error);
          break;
        }
        done++;
      } catch (e) {
        setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
        break;
      }
    }

    setProgress(null);
    setBusy(false);
    if (done) startRefresh(() => router.refresh());
  };

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else startRefresh(() => router.refresh());
    } catch (e) {
      // A rejected action would otherwise leave the grid looking changed.
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
        <span className="text-h3">รูปทรัพย์</span>
        <span className="num text-label text-text-subtle">
          {photos.length}/{MAX_PHOTOS_PER_LISTING}
        </span>
        {canEdit && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={working || remaining <= 0}
            className="ml-auto h-8 px-3 rounded-md bg-accent text-text-onaccent text-small font-medium inline-flex items-center gap-1.5 hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {working ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <ImagePlus size={14} strokeWidth={2} />
            )}
            {remaining > 0 ? "เพิ่มรูป" : "ครบ 20 รูปแล้ว"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
      </div>

      {(progress || error) && (
        <div
          className={cn(
            "px-4 py-2 text-small border-b border-border flex items-center gap-1.5",
            error ? "text-red bg-red-bg/40" : "text-text-muted"
          )}
        >
          {error ? <AlertCircle size={14} strokeWidth={2} /> : <Loader2 size={14} className="animate-spin" />}
          {error ?? progress}
        </div>
      )}

      <CardContent>
        {photos.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-small text-text-subtle">ยังไม่มีรูป</p>
            {canEdit && (
              <p className="text-label text-text-subtle mt-1">
                รูปจะถูกย่อเหลือ <span className="num">{PHOTO_MAX_EDGE}</span> px
                และบีบอัดให้อัตโนมัติก่อนอัปโหลด — เลือกจากมือถือได้เลย
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div
                key={p.photo_id}
                className="relative aspect-[4/3] rounded-md overflow-hidden border border-border bg-surface-2 group"
              >
                <Image
                  src={p.photo_url}
                  alt={`รูปทรัพย์ ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 text-label font-medium rounded px-1.5 py-0.5 bg-black/60 text-white">
                    หน้าปก
                  </span>
                )}
                {canEdit && (
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {i !== 0 && (
                      <button
                        onClick={() => void run(() => setListingCover(p.photo_id))}
                        disabled={working}
                        title="ตั้งเป็นหน้าปก"
                        aria-label="ตั้งเป็นหน้าปก"
                        className="flex-1 h-7 grid place-items-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
                      >
                        <Star size={13} strokeWidth={2} />
                      </button>
                    )}
                    <button
                      onClick={() => void run(() => deleteListingPhoto(p.photo_id))}
                      disabled={working}
                      title="ลบรูป"
                      aria-label="ลบรูป"
                      className="flex-1 h-7 grid place-items-center rounded bg-black/60 text-white hover:bg-red disabled:opacity-50"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
