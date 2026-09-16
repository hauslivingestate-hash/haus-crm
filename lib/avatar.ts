/* Staff profile photos — where the file lives and how a stored path becomes a URL.
 *
 * ── THE ROW STORES A PATH, NOT A URL ────────────────────────────────────────────
 * `main_1_hr.avatar_path` holds `S-001/lm3k9f.webp`. A public URL embeds the project ref,
 * so storing one would bake this project's hostname into every employee row and orphan all
 * of them the day the project moves. The URL is derived here instead, from the same env var
 * the rest of the app reads.
 *
 * ── CLIENT-SAFE ON PURPOSE ──────────────────────────────────────────────────────
 * Avatars render inside client components (the roster, the topbar, the ทีม table), so this
 * file must not pull in the server Supabase client. It is plain string work — no network,
 * no session — which is also why it is cheap to call once per row.
 *
 * ── WHY THE BUCKET IS PUBLIC ────────────────────────────────────────────────────
 * See the `employee_avatars` migration. Avatars appear in list tables; a signed URL per row
 * per request would cost a round trip per face and defeat browser and CDN caching. The
 * trade is real: anyone holding a URL can fetch that image. So a filename carries a random
 * segment and is never guessable from the employee code alone.
 */

import { SUPABASE_URL } from "@/lib/supabaseConfig";

export const AVATAR_BUCKET = "avatars";

/** `S-001/lm3k9f.webp` → the public URL. Null in, null out, so a person with no photo
    falls through to the initials the Avatar component already draws. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/** The storage path for a NEW photo.
 *
 *  Always a new random name, never a fixed one per employee. Two reasons, and the second
 *  is the one that bites: the random segment is what stops a URL being guessed from an
 *  employee code, AND it is the cache-buster. Overwriting a fixed path would leave every
 *  browser and the CDN serving the previous face from cache for as long as they felt like
 *  it, which looks exactly like "the upload silently failed". */
export function newAvatarPath(employeeCode: string, ext: string): string {
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${employeeCode}/${rand}.${ext}`;
}

/** The employee a stored path belongs to — the first segment. Used server-side to refuse a
    client-supplied path filed under someone else. */
export function ownerOfAvatarPath(path: string): string {
  return path.split("/")[0] ?? "";
}
