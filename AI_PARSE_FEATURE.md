# HAUS CRM — วางข้อความให้ AI อ่าน (paste-to-form + parse queue)

**Status:** Built and wired. Needs `OPENAI_API_KEY` set before it can actually parse.
**Last updated:** 2026-09-17

Replaces the design-first stub in `lib/ai/parseLead.ts` (regex heuristics, a 550 ms fake
delay, leads only, no queue) with a real OpenAI extraction behind a durable queue, for both
leads and listings.

---

## 1. What it does

Paste raw Thai text — a LINE conversation, a broker's listing blurb — and the intake form
fills itself in. Two entry points, same machinery:

- **The paste box inside the form** (`AiPasteBox`) — where you already are.
- **The floating tray** (`ParseTray`, bottom-right) — paste from any page, several messages
  in a row, review them later.

The AI only ever **pre-fills**. It never saves. A person reviews and edits before บันทึก.

---

## 2. Why a queue and not a promise

This is the part that was asked for, and it is the whole design.

A paste used to be a promise living in the browser tab: you had to sit in the form until it
returned, and switching to LINE to copy the next message could kill it outright — mobile
Safari suspends backgrounded tabs. Intake is *several messages at a time*, so that rhythm
was exactly wrong.

Here **a paste is a row**. `enqueueParse` inserts into `ai_job` and returns in milliseconds;
the extraction runs in `after()` and finishes on the server whether or not anyone is still
watching. The draft is waiting on any page, any device, after any refresh.

Consequences that fall out of that:

| | |
|---|---|
| Paste the next message immediately | the box clears itself on send |
| Close the form mid-parse | the result lands in the tray |
| Lock the phone, switch to LINE | unaffected — the work is on the server |
| Refresh | the tray re-reads the rows |
| Serverless function dies mid-parse | `ai_job_sweep()` turns it into a retryable error after 3 min |
| Retry a failure | same row, re-queued — the tray never grows a duplicate |

---

## 3. No service-role key

The obvious objection to "finish the work after the response" is that the session is gone by
then, so the write-back needs a key that bypasses RLS.

It does not. Next.js exposes `cookies()` inside an `after()` callback **when it is used in a
Route Handler or a Server Function**, and every export of `lib/ai/jobs.ts` is a Server
Function. So the runner builds an ordinary session-aware client, `auth.uid()` is still set
inside Postgres, and the `ai_job` policies apply to it exactly as to the request that queued
the job.

(Verified against the Next.js `after` docs, 2026-09-17. Stable since 15.1; this app is on
15.5. Works on Vercel — where this deploys — on a Node server and in Docker. **Not** on a
static export. The callback is bounded by the route's max duration.)

The alternative was putting a God-mode credential in the app to solve a problem we don't
have.

---

## 4. The AI reads; code decides

The model does exactly one job: turn prose into fields. It never does record matching,
because the measured finding (Klaichan, from Shelter before it) is that it gets record
identity wrong about a fifth of the time.

`lib/ai/parse.ts` is what turns a model answer into values the database will accept:

- **every enum value is re-checked** against the live lookup table. The JSON schema
  constrains the model; this verifies it. They disagree whenever a list changed mid-flight.
- **Thai zone name → `zone_id`.** The model is shown อโศก; the column stores `ASK`.
- **project name → `project_id`**, exact-normalised then containment, against both name
  columns (sheet data put Thai names in the English column often enough to matter). No
  match → the name survives as text and says so.
- **a listing code naming nothing is dropped**, because `listing_code` is a real FK and
  `createLead` would otherwise fail on a raw Postgres constraint message.
- **a phone that already belongs to a lead raises a duplicate warning** (advisory — RLS
  scopes that read to your own leads unless you hold `leads.view_all`).

Every vocabulary is read **live, per call**. A channel added in ตั้งค่า is extractable
immediately; a retired one stops being suggested. That is not tidiness — the schema is what
the model is *allowed* to return, so a frozen list would be a frozen feature.

---

## 5. Files

| File | |
|---|---|
| `lib/ai/types.ts` | The contract. **Zero imports** — client and server both read it. |
| `lib/ai/model.ts` | The tier and its price. **Zero imports** — the settings panel reads it. |
| `lib/ai/extract.ts` | `server-only`. The OpenAI call, strict JSON schema, the prompts. |
| `lib/ai/parse.ts` | `server-only`. Validation + deterministic matching. |
| `lib/ai/jobs.ts` | `"use server"`. `enqueueParse` / `retryJob` / `listJobs` / `closeJob`. |
| `lib/ai/usage.ts` | `server-only`. Spend + draft outcomes for ตั้งค่า ▸ AI. |
| `components/ParseQueueProvider.tsx` | Mirrors the rows. Polls only while something is in flight. |
| `components/ParseTray.tsx` | The floating button, the status chip, the job list, the paste sheet. |
| `components/AiPasteBox.tsx` | The in-form box. Enqueues; watches its own job. |
| `components/FabDock.tsx` | The bottom-right stack — tray above เพิ่มลีด, each self-gating. |
| `components/ListingReviewHost.tsx` | Lets a listing draft be reviewed from any page. |
| `components/AiUsagePanel.tsx` | ตั้งค่า ▸ AI. |

**Two zero-import modules, deliberately.** `ParseTray` and `AiUsagePanel` are client
components; a client file importing a *value* from a module whose import graph reaches
`server-only` or `next/headers` drags it into the browser bundle and breaks the build.
`tsc` does not catch it. `lib/activityHeatmap.ts` exists for the same reason after exactly
that bug (2026-09-16).

### The listing fields come from the registry

`AI_LISTING_HINTS` in `extract.ts` names 24 columns, keyed to `lib/listingFields.ts`. The
JSON type, the label and the allowed values are all **derived** from that registry, and an
assertion fails at import if a key stops existing. `ListingParseDraft.values` is keyed the
same way, so `ListingForm` applies it with no mapping table in between.

The other 18 fields are not facts about the property — they are our workflow (portal links,
whether the sign is up, price history, the owner pipeline). Asking the model for those
invites it to invent them and costs output tokens on every call.

---

## 6. Permissions

Two keys, not one — in ตั้งค่า ▸ บทบาท & สิทธิ์ with everything else, so changing them is a
checkbox and not a migration:

| Key | Default |
|---|---|
| `ai.parse_lead` — ให้ AI อ่านข้อความลีด | **Admin ON**, CEO + ผู้ดูแลระบบ ON |
| `ai.parse_listing` — ให้ AI อ่านข้อความทรัพย์ | **Sales OFF**, CEO + ผู้ดูแลระบบ only |

Ben, 2026-09-17: lead parsing is a back-office leverage tool Admin should have from day one;
listing parsing starts off for sales until the spend is proven. One key could not express
that.

Enforced in three places that agree: the `ai_job` INSERT policy (per kind), `requireParsePermission`
in the action, and the UI.

**The UI adds one gate the database does not:** it also requires `leads.create` /
`listings.create`. Without somewhere for the draft to land, the tray would be a dead end
with a bill attached.

Not granted, and worth a decision: **Listing Support** is the obvious next candidate for
`ai.parse_lead` — same back-office intake job as Admin. Left off because it wasn't asked for.

---

## 7. Cost

`gpt-4.1`, $2.00 / $8.00 per million tokens. Roughly **฿0.10 per parse**; 50 a day ≈ **฿150
a month**.

`ai_usage` stores **tokens, not baht** — a stored baht figure becomes a historical fiction
the moment a tier changes. ตั้งค่า ▸ AI multiplies at read time and shows the ≈ baht with
the assumed FX rate printed beside it (`AI_USD_THB` in `lib/ai/model.ts`).

The panel also shows **saved vs discarded**, which is the only honest read on whether the
extractor is good enough to keep paying for. A rising discard rate is the signal to change
the prompt or drop a tier — not something to find out from a bill.

`gpt-4.1-mini` is priced in `MODEL_PRICING` and is ~5× cheaper. Extraction into a fixed
schema is near the easiest thing a model does, so it is worth measuring against 4.1 once
there is real traffic. One line to swap.

---

## 8. Before it works

1. **`OPENAI_API_KEY`** in `.env.local` locally and in Vercel → Settings → Environment
   Variables. No `NEXT_PUBLIC_` prefix. Without it the queue still runs and every job fails
   with "ยังไม่ได้ตั้งค่า AI (ไม่มี API key) — แจ้งผู้ดูแลระบบ", which is retryable.
2. Nothing else. The tables, policies and permissions are applied.

---

## 9. Known limits

- **The prompts are untested against real HAUS messages.** They were written from the field
  registry and the Klaichan/Shelter precedent, not from a corpus of actual LINE pastes.
  Expect a tuning pass on `extract.ts` after the first week — that is what the discard rate
  in ตั้งค่า ▸ AI is for.
- **`after()` + `cookies()` is verified from the docs, not from a run against this app.**
  If it were wrong the failure is visible and safe, not silent: the runner's UPDATE would
  match no row under RLS, the job would stay `queued`, and the sweep would surface it as a
  retryable error after three minutes.
- **The duplicate-phone check is scoped by RLS.** For an account without `leads.view_all` a
  "no duplicate" result is a false negative, not a promise.
- **Owner records are not matched.** A listing's owner name/phone/LINE pre-fill the fields;
  they do not pre-select an existing `main_2_owner` row the way Klaichan pre-selects a
  contact. `create_owner` owns that path and it was out of scope here.
- **The tray polls at 2s while something is in flight**, and not at all otherwise. Fine for
  one or two people pasting; if a dozen do it at once, revisit.
