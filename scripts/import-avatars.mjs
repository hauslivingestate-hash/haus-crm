#!/usr/bin/env node
/**
 * One-off: import staff profile photos from a folder into the `avatars` bucket.
 *
 * Written to move the six headshots out of the HAUS V2 dashboard
 * (its public/avatars/*.png, keyed by nickname) rather than re-uploading them by hand.
 *
 * ── IT SIGNS IN AS A REAL USER, NOT AS THE SERVICE ROLE ─────────────────────────
 * It uses the publishable key plus your own email and password, so every write goes
 * through the exact RLS the app enforces: `avatars_insert` on storage.objects and the
 * people.manage / roles.manage gate. If your account cannot set photos in the UI, this
 * script cannot either — which is the point. No admin key is needed, and nothing here can
 * do more than you can.
 *
 * ── FILES ARE NAMED BY EMPLOYEE CODE ────────────────────────────────────────────
 * `<dir>/C-001.webp`, `<dir>/S-001.webp`, … Already square and resized: this script does
 * no image processing, it only uploads what it is given. Keep the photos OUT of the repo —
 * it is public.
 *
 * ── SAFE BY DEFAULT ─────────────────────────────────────────────────────────────
 * Anyone who already has a photo is SKIPPED. Pass --replace to overwrite them (the old
 * file is then deleted, exactly as the app does). --dry-run shows the plan and writes
 * nothing.
 *
 * Usage:
 *   HAUS_EMAIL=you@example.com HAUS_PASSWORD='…' \
 *     node scripts/import-avatars.mjs <dir> [--replace] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jpufhxzvqfrdcblfmrmu.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MXdGWde2_RvLAWQrJ0ORWw_K18B0rvc";
const BUCKET = "avatars";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const replace = args.includes("--replace");
const dryRun = args.includes("--dry-run");

const email = process.env.HAUS_EMAIL;
const password = process.env.HAUS_PASSWORD;

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!dir) die("Give the folder holding the photos, e.g. node scripts/import-avatars.mjs ./photos");
if (!email || !password) die("Set HAUS_EMAIL and HAUS_PASSWORD (your own app login).");

// Same rule as lib/avatar.ts newAvatarPath(): a fresh random name every time, so a URL
// cannot be guessed from an employee code and a replaced photo is never served from cache.
const newPath = (code, ext) =>
  `${code}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

const CONTENT_TYPE = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) die(`Sign-in failed: ${signInError.message}`);

const { data: identity, error: idError } = await supabase.rpc("my_identity");
if (idError) die(`Could not read your identity: ${idError.message}`);
const me = identity?.[0];
if (!me) die("Your login is not linked to an employee row.");
const perms = new Set(me.permissions ?? []);
if (!(perms.has("people.manage") || perms.has("roles.manage"))) {
  die(`${me.nickname} (${me.employee_code}) may not set profile photos. Sign in as someone with people.manage.`);
}
console.log(`Signed in as ${me.nickname} (${me.employee_code})${dryRun ? " · DRY RUN" : ""}\n`);

const files = (await readdir(dir))
  .filter((f) => /\.(webp|jpe?g|png)$/i.test(f))
  .sort();
if (!files.length) die(`No image files in ${dir}`);

let done = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const code = path.basename(file, path.extname(file));

  const { data: row, error: readError } = await supabase
    .from("main_1_hr")
    .select("employee_code,nickname,avatar_path")
    .eq("employee_code", code)
    .maybeSingle();

  if (readError) {
    console.log(`✖ ${code}  read failed: ${readError.message}`);
    failed++;
    continue;
  }
  if (!row) {
    console.log(`✖ ${code}  no employee with that code — filename must be the employee code`);
    failed++;
    continue;
  }
  const label = `${code} (${row.nickname})`;

  if (row.avatar_path && !replace) {
    console.log(`– ${label}  already has a photo — skipped (use --replace to overwrite)`);
    skipped++;
    continue;
  }
  if (dryRun) {
    console.log(`→ ${label}  would ${row.avatar_path ? "REPLACE" : "set"} from ${file}`);
    done++;
    continue;
  }

  const body = await readFile(path.join(dir, file));
  const target = newPath(code, ext);

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(target, body, { contentType: CONTENT_TYPE[ext], upsert: false });
  if (upError) {
    console.log(`✖ ${label}  upload failed: ${upError.message}`);
    failed++;
    continue;
  }

  const { error: setError } = await supabase
    .from("main_1_hr")
    .update({ avatar_path: target })
    .eq("employee_code", code);
  if (setError) {
    // The row refused it, so the object is orphaned — clean up rather than leave it in the
    // bucket with nothing pointing at it. Same rule as lib/mutations/avatar.ts.
    await supabase.storage.from(BUCKET).remove([target]);
    console.log(`✖ ${label}  could not save the path: ${setError.message}`);
    failed++;
    continue;
  }

  if (row.avatar_path && row.avatar_path !== target) {
    await supabase.storage.from(BUCKET).remove([row.avatar_path]);
  }

  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: code,
    action: "set_avatar",
    changed_by: me.employee_code,
    before: { avatar_path: row.avatar_path },
    after: { avatar_path: target, remark: "imported from the HAUS V2 dashboard avatars" },
  });

  console.log(`✔ ${label}  ${row.avatar_path ? "replaced" : "set"} → ${target}`);
  done++;
}

await supabase.auth.signOut();
console.log(`\n${done} set · ${skipped} skipped · ${failed} failed`);
process.exit(failed ? 1 : 0);
