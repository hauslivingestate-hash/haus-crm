"use server";

/* The AI parse queue — server half.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────────
 * A paste used to be a promise living inside the browser tab: you had to stay in the intake
 * form until it returned, and switching to LINE to copy the next message could kill it
 * outright (mobile Safari suspends backgrounded tabs). Here a paste is a ROW. `enqueueParse`
 * returns in milliseconds and the extraction runs in `after()`, so the work finishes on the
 * server whether or not anyone is still looking at it — and the draft is waiting on any
 * page, any device, after any refresh.
 *
 * ── WHY THERE IS NO SERVICE-ROLE KEY HERE ───────────────────────────────────────
 * The obvious objection to "finish the work after the response" is that the session is gone
 * by then, so the write-back needs a key that bypasses RLS. It does not. Next.js exposes
 * `cookies()` inside an `after()` callback when it is used in a Route Handler or a SERVER
 * FUNCTION, which is what every export below is. So `createClient()` still builds a
 * session-aware client, `auth.uid()` is still set inside Postgres, and the ai_job policies
 * apply to the runner exactly as they do to the request that queued the job.
 *
 * That is worth stating plainly because the alternative was to put a God-mode credential in
 * the app to solve a problem we do not have. (Verified against the Next.js `after` docs,
 * 2026-09-17. `after` is stable since 15.1; this app is on 15.5. It works on Vercel, on a
 * Node server and in Docker — but NOT on a static export, and the callback is bounded by the
 * route's max duration.)
 *
 * Jobs are never deleted: `consumed_at` hides one from the tray and `outcome` records
 * whether the draft became a real record.
 */

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { parseLead, parseListing } from "@/lib/ai/parse";
import { PARSE_PERMISSION, type ParseJob, type ParseKind, type ParseOutcome } from "@/lib/ai/types";

/** How far back the tray looks, in hours. An unsaved draft older than a day is stale enough
 *  that re-pasting beats resurrecting it. */
const TRAY_HOURS = 24;

/** One row as PostgREST returns it. */
interface JobRow {
  id: number;
  kind: ParseKind;
  status: ParseJob["status"];
  raw_text: string;
  draft: ParseJob["draft"];
  note: string | null;
  error: string | null;
  title: string | null;
  created_at: string;
}

const COLUMNS = "id,kind,status,raw_text,draft,note,error,title,created_at";

/** Tray label. Before the parse lands there is only the raw paste, so use its first
 *  meaningful line; afterwards the extracted name is far better. */
function titleFrom(rawText: string): string {
  const line = rawText.split("\n").map((l) => l.trim()).find(Boolean) ?? "ข้อความที่วาง";
  return line.length > 60 ? `${line.slice(0, 60)}…` : line;
}

function toJob(r: JobRow): ParseJob {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    rawText: r.raw_text,
    draft: r.draft ?? null,
    note: r.note,
    error: r.error,
    title: r.title?.trim() || titleFrom(r.raw_text),
    createdAt: r.created_at,
  };
}

/** Signed in with an employee row — enough to READ your own tray or bin a draft you already
 *  have. Creating work is gated separately, because a parse costs money. */
async function requireEmployee(): Promise<string> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) throw new Error("ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
  return auth.employeeCode;
}

/** Queuing a parse spends the company's OpenAI budget, so it is its own permission — and a
 *  separate one per kind, because listing parsing and lead parsing are handed to different
 *  roles. Mirrors the ai_job INSERT policy; the database refuses it either way. */
async function requireParsePermission(kind: ParseKind): Promise<void> {
  const auth = await getAuthContext();
  const perms = new Set(auth?.permissions ?? []);
  if (!perms.has(PARSE_PERMISSION[kind]) && !perms.has("roles.manage")) {
    throw new Error(
      kind === "lead" ? "ไม่มีสิทธิ์ให้ AI อ่านข้อความลีด" : "ไม่มีสิทธิ์ให้ AI อ่านข้อความทรัพย์"
    );
  }
}

/**
 * Do the extraction and write the result back.
 *
 * Runs detached in `after()`, so it must NEVER throw: an escaped error vanishes with the
 * function and leaves the row "running" until the stuck sweep catches it three minutes
 * later. Every path below ends in an UPDATE.
 */
async function runJob(id: number) {
  const supabase = await createClient();

  const { data: started } = await supabase
    .from("ai_job")
    .update({ status: "running", started_at: new Date().toISOString(), error: null })
    .eq("id", id)
    .select("id,kind,raw_text")
    .maybeSingle();
  if (!started) return;

  const row = started as { id: number; kind: ParseKind; raw_text: string };

  try {
    const res = row.kind === "listing"
      ? await parseListing(row.raw_text)
      : await parseLead(row.raw_text);

    if (res.ok) {
      await supabase
        .from("ai_job")
        .update({
          status: "done",
          draft: res.draft,
          note: res.note,
          // Clear any message from a previous attempt — a retry that succeeded must not
          // leave failure text hanging on the row.
          error: null,
          // The extracted name beats the raw first line for both kinds: a listing's project,
          // a lead's person.
          title: res.title?.trim() || titleFrom(row.raw_text),
          finished_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else {
      await supabase
        .from("ai_job")
        .update({ status: "error", error: res.error, finished_at: new Date().toISOString() })
        .eq("id", id);
    }
  } catch {
    // parse.ts already converts every AI failure into { ok: false }. Reaching here means
    // something else broke — the database, the network. Say so in a way that invites a retry
    // rather than leaking an internal message.
    await supabase
      .from("ai_job")
      .update({
        status: "error",
        error: "แยกข้อมูลไม่สำเร็จ กดลองใหม่อีกครั้ง",
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
}

/** Queue a paste. Returns as soon as the row exists — the caller gets a job to watch, not a
 *  parse to wait for. That is the entire point of this feature. */
export async function enqueueParse(
  kind: ParseKind,
  rawText: string
): Promise<{ ok: true; job: ParseJob } | { ok: false; error: string }> {
  try {
    await requireEmployee();
    await requireParsePermission(kind);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ไม่มีสิทธิ์ใช้งาน" };
  }

  const text = rawText.trim();
  if (!text) return { ok: false, error: "กรุณาวางข้อความก่อน" };

  const supabase = await createClient();
  // employee_code is defaulted by the column, never sent: a job cannot be filed under
  // someone else even if this action is called directly.
  const { data, error } = await supabase
    .from("ai_job")
    .insert({ kind, raw_text: text, title: titleFrom(text) })
    .select(COLUMNS)
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "ส่งให้ AI อ่านไม่สำเร็จ" };

  after(() => runJob((data as JobRow).id));
  return { ok: true, job: toJob(data as JobRow) };
}

/** Re-run a failed parse IN PLACE. One row per paste stays one row per paste, so the tray
 *  doesn't grow a duplicate every time a retry is needed. */
export async function retryJob(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  // Read the kind first: a retry is a fresh API call, so it spends the same budget as a new
  // paste and is gated the same way.
  const { data: existing } = await supabase
    .from("ai_job")
    .select("id,kind")
    .eq("id", id)
    .is("consumed_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "ไม่พบรายการนี้" };

  try {
    await requireParsePermission((existing as { kind: ParseKind }).kind);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ไม่มีสิทธิ์ใช้งาน" };
  }

  const { data, error } = await supabase
    .from("ai_job")
    .update({
      status: "queued",
      error: null,
      draft: null,
      note: null,
      finished_at: null,
      // Restarts the stuck clock. Without this the row keeps its original created_at, so the
      // sweep would condemn the retry the instant it was queued.
      started_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "ลองใหม่ไม่สำเร็จ" };

  after(() => runJob(id));
  return { ok: true };
}

/**
 * Everything still waiting: unconsumed, from the last day, newest first.
 *
 * Sweeps abandoned jobs to `error` first — see ai_job_sweep() for why that rule cannot be
 * written as a PostgREST filter.
 */
export async function listJobs(): Promise<ParseJob[]> {
  await requireEmployee();
  const supabase = await createClient();

  await supabase.rpc("ai_job_sweep");

  const since = new Date(Date.now() - TRAY_HOURS * 3_600_000).toISOString();
  const { data } = await supabase
    .from("ai_job")
    .select(COLUMNS)
    .is("consumed_at", null)
    .gt("created_at", since)
    .order("created_at", { ascending: false });

  return ((data ?? []) as JobRow[]).map(toJob);
}

/** Take a job out of the tray. `saved` means the draft became a real record; `discarded`
 *  means it was thrown away. The difference is the only honest read on whether the
 *  extractor is good enough, so it is stored rather than inferred later. */
export async function closeJob(id: number, outcome: ParseOutcome): Promise<void> {
  await requireEmployee();
  const supabase = await createClient();
  await supabase
    .from("ai_job")
    .update({ consumed_at: new Date().toISOString(), outcome })
    .eq("id", id);
}
