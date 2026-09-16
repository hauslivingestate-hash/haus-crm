"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressAvatar } from "@/lib/imageCompress";
import { AVATAR_BUCKET, newAvatarPath } from "@/lib/avatar";
import { removeEmployeeAvatar, setEmployeeAvatar } from "@/lib/mutations/avatar";
import { cn } from "@/lib/cn";

/* รูปโปรไฟล์ — the avatar on the ทีม record, made clickable for HR/CEO.
 *
 * Same two-step upload as รูปทรัพย์: the file goes browser → Storage directly and only the
 * resulting PATH goes through a server action. See lib/mutations/avatar.ts.
 *
 * ── IT IS THE AVATAR, NOT A FIELD IN THE FORM ───────────────────────────────────
 * Saving a photo does NOT wait for บันทึก, and it is available in view mode. A picture is
 * one decision with one outcome, unlike the twenty text fields around it where a half-typed
 * edit has to be cancellable. Tying it to the form's Save was what the previous attempt did,
 * and the preview vanished every time because there was nowhere to save it to.
 *
 * ── NO PHOTO ON AN UNSAVED PERSON ───────────────────────────────────────────────
 * A new employee has no code until the trigger mints one, and the storage path is keyed on
 * that code. So the picker is inert on เพิ่มพนักงาน and says why, rather than uploading to a
 * folder named after an empty string.
 */
export function AvatarPicker({
  employeeCode,
  nickname,
  src,
  canEdit,
}: {
  /** Empty on an unsaved new employee — the picker disables itself. */
  employeeCode: string;
  nickname: string;
  src: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const working = busy || refreshing;
  const usable = canEdit && !!employeeCode;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const out = await compressAvatar(file);
      const path = newAvatarPath(employeeCode, out.ext);

      const supabase = supabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, out.blob, { contentType: out.blob.type, upsert: false });
      if (upErr) {
        setError(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);
        return;
      }

      const res = await setEmployeeAvatar(employeeCode, path);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      startRefresh(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await removeEmployeeAvatar(employeeCode);
      if (!res.ok) setError(res.error);
      else startRefresh(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative shrink-0">
        <Avatar name={nickname || "?"} src={src} tone="accent" className="h-16 w-16 text-h3" />

        {usable && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={working}
            aria-label={src ? `เปลี่ยนรูปของ ${nickname}` : `เพิ่มรูปของ ${nickname}`}
            title={src ? "เปลี่ยนรูป" : "เพิ่มรูป"}
            className={cn(
              "absolute inset-0 grid place-items-center rounded-full transition-opacity",
              "bg-black/55 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // Always visible while there is no photo — an invisible hover target on an
              // empty avatar is a feature nobody discovers.
              src ? "opacity-0 hover:opacity-100 focus-visible:opacity-100" : "opacity-100",
              working && "opacity-100"
            )}
          >
            {working ? (
              <Loader2 size={18} strokeWidth={2} className="animate-spin" />
            ) : (
              <Camera size={18} strokeWidth={1.75} />
            )}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = ""; // allow re-picking the same file after a failure
          }}
        />
      </div>

      {usable && src && !working && (
        <button
          type="button"
          onClick={() => void remove()}
          className="inline-flex items-center gap-1 text-label text-text-subtle transition-colors hover:text-red"
        >
          <Trash2 size={11} strokeWidth={2} /> ลบรูป
        </button>
      )}
      {canEdit && !employeeCode && (
        <span className="max-w-[7rem] text-center text-label text-text-subtle">
          เพิ่มรูปได้หลังบันทึก
        </span>
      )}
      {error && <span className="max-w-[9rem] text-center text-label text-red">{error}</span>}
    </div>
  );
}
