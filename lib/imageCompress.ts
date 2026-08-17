// Browser-side image compression, run before anything is uploaded.
//
// Ben, 2026-08-17: sales upload their own listing photos, 20 per listing, each under a set
// size — so the shrinking has to happen on their phone, not on the server. A 12MP phone
// photo is 3–8 MB; at 20 per listing across 360 listings that is tens of gigabytes of
// originals for images that are never displayed above ~1600px.
//
// This is a DISPLAY copy, not an archive. The full-resolution originals stay in the Google
// Drive albums (main_4.photo_album_link, 360 listings), which is what marketing sends to
// DDproperty and Livinginsider.
//
// No dependency: canvas + toBlob is enough and ships nothing extra to the phone.

export const PHOTO_MAX_EDGE = 1920;
export const PHOTO_QUALITY = 0.82;
/** Target after compression. A phone photo typically lands at 200–350 KB. */
export const PHOTO_TARGET_BYTES = 1024 * 1024; // 1 MB
/** What we accept off the camera roll before compressing. */
export const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PHOTOS_PER_LISTING = 20;

export interface CompressResult {
  blob: Blob;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  /** For showing the saving in the UI. */
  originalBytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("เปิดไฟล์รูปไม่ได้"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Shrink to `PHOTO_MAX_EDGE` on the long side and re-encode.
 *
 * Prefers WebP (~30% smaller than JPEG at the same visual quality, supported everywhere
 * that matters now) and falls back to JPEG if the browser will not produce one — Safari
 * did not until 14, and `toBlob` silently hands back a PNG instead of failing, which would
 * upload something LARGER than the original.
 *
 * If the first pass is still over target it re-encodes at a lower quality rather than
 * rejecting the photo; a rep whose upload is refused will just stop uploading photos.
 */
export async function compressPhoto(file: File): Promise<CompressResult> {
  if (!file.type.startsWith("image/")) throw new Error("ไฟล์นี้ไม่ใช่รูปภาพ");
  if (file.size > PHOTO_MAX_INPUT_BYTES) {
    throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(PHOTO_MAX_INPUT_BYTES / 1024 / 1024)} MB`);
  }

  const img = await loadImage(file);
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
  ctx.drawImage(img, 0, 0, width, height);

  let blob = await toBlob(canvas, "image/webp", PHOTO_QUALITY);
  let ext: CompressResult["ext"] = "webp";
  // toBlob falls back to PNG rather than erroring when webp is unsupported — a PNG of a
  // photograph is bigger than the JPEG we started with, so check the type it gave back.
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", PHOTO_QUALITY);
    ext = "jpg";
  }
  if (!blob) throw new Error("บีบอัดรูปไม่สำเร็จ");

  // Second pass for the occasional very detailed photo.
  if (blob.size > PHOTO_TARGET_BYTES) {
    const retry = await toBlob(canvas, ext === "webp" ? "image/webp" : "image/jpeg", 0.7);
    if (retry && retry.size < blob.size) blob = retry;
  }

  return { blob, ext, width, height, originalBytes: file.size };
}

/** "2.4 MB" / "312 KB" — for the before/after line in the uploader. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
