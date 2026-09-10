"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  LoaderCircle,
  Plus,
  User,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { GradeChip } from "@/components/ui/GradeChip";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { useTopmostEscape } from "@/lib/overlayStack";
import { followUpKey, type FollowUpDetail, type FollowUpRow, type OverdueFollowUps } from "@/lib/followUps";
import { fetchFollowUpDetail, logFollowUp, promoteToPlan } from "@/lib/mutations/followUps";

/* ติดตามเกินกำหนด — the records past their follow-up window.
 *
 * ── A WORKLIST, NOT A REPORT ────────────────────────────────────────────────────
 * Every row carries the two things you would otherwise leave the page to do:
 *
 *   ✓  บันทึก   log the follow-up now. The row leaves, because the record moved —
 *               nothing here is "marked done", overdue-ness simply stops being true.
 *   +  แผน      promote it onto today's plan as a linked task. Ticking THAT logs the
 *               activity, so the row leaves later, by the same route.
 *
 * The version this replaced was a list of links. You clicked into a lead, did the thing,
 * came back, and the list had re-sorted itself under you — on a six-agent call list that
 * is the difference between a working surface and a report.
 *
 * ── THE DRAWER, NOT THE RECORD ──────────────────────────────────────────────────
 * Tapping a name opens the last few conversations in place, with the phone number as a
 * real `tel:` link. Klaichan reached this the long way: they answered "ไม่เห็นว่าต้อง
 * คุยยังไงต่อ" by linking to the record, then found that takes you off a list that
 * re-sorts itself, so coming back means finding your place again. Opening the full record
 * is still one tap from inside the drawer.
 *
 * ── PROMOTED ROWS STAY VISIBLE ──────────────────────────────────────────────────
 * Marked อยู่ในแผน rather than hidden. A list that shrinks when you claim a row reads as
 * shorter than the work actually is.
 *
 * ── A GRADE WITH NO WINDOW IS SILENT ────────────────────────────────────────────
 * Ben, 2026-09-06. So this card shrinks the moment somebody decides a grade should stop
 * nagging, and an unconfigured grade never nags at all.
 */
export function FollowUpCard({ data }: { data: OverdueFollowUps }) {
  const router = useRouter();
  const total = data.totalLeads + data.totalListings;

  /* Optimistically hidden rows. The server revalidates, but the row should leave under
     the finger rather than a round trip later. Only LOGGING hides a row, and logging is
     the one action here that cannot be undone — so this set never has to give anything
     back. */
  const [gone, setGone] = React.useState<Set<string>>(new Set());
  /* Locally claimed rows, so + flips to อยู่ในแผน immediately. Separate from `gone`
     because a promoted row stays on the list. */
  const [claimed, setClaimed] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  /* The row whose history is open. Held here rather than in Row so only one drawer can
     exist at a time — a call list with two open is a list you have lost your place in,
     which is the thing this fixes. */
  const [open, setOpen] = React.useState<FollowUpRow | null>(null);

  const rows = data.rows.filter((r) => !gone.has(followUpKey(r)));

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ติดตามเกินกำหนด</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body text-text-muted">
            ตามครบทุกรายแล้ว — ไม่มีลีดหรือทรัพย์ที่เลยกำหนดติดตาม
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ติดตามเกินกำหนด</CardTitle>
        <span
          title={`ลีด ${data.totalLeads} · ทรัพย์ ${data.totalListings}`}
          className="num rounded-md bg-red-bg px-2 py-0.5 text-small font-semibold text-red"
        >
          {total}
        </span>
      </CardHeader>

      <CardContent>
        <p className="-mt-1 mb-2.5 text-small text-text-subtle">
          เลยกำหนดตามเกรด · ลีด {data.totalLeads} · ทรัพย์ {data.totalListings}
        </p>

        {error && (
          <p
            role="alert"
            className="mb-2.5 flex items-start gap-1.5 rounded-md bg-red-bg px-3 py-2 text-small text-red"
          >
            <AlertTriangle size={13} strokeWidth={2} className="mt-px shrink-0" /> {error}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <Row
              key={followUpKey(r)}
              row={r}
              claimed={r.onPlan || claimed.has(followUpKey(r))}
              onLogged={() => {
                setGone((g) => new Set(g).add(followUpKey(r)));
                // The card's own totals come from the server, so pull them back into line
                // once the write has landed.
                router.refresh();
              }}
              onClaimed={() => {
                setClaimed((c) => new Set(c).add(followUpKey(r)));
                router.refresh();
              }}
              onError={setError}
              onOpen={setOpen}
            />
          ))}
        </ul>

        {/* The cap is stated, never silent — "8 จาก 27" is a different message from "8".
            Both links land unfiltered: /leads and /listings hold their filters in client
            state, so a `?sla=overdue` parameter would look like a deep link and do
            nothing. Both pages already badge and sort overdue rows to the top. */}
        {total > rows.length && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
            <span className="text-text-subtle">
              แสดง {rows.length} จาก {total} รายการ
            </span>
            <Link href="/leads" className="font-medium text-accent hover:text-accent-hover">
              ดูลีดทั้งหมด
            </Link>
            <Link href="/listings" className="font-medium text-accent hover:text-accent-hover">
              ดูทรัพย์ทั้งหมด
            </Link>
          </div>
        )}

        <p className="mt-3 text-small text-text-subtle">
          รอบติดตามตั้งตามเกรด — แก้ได้ที่ ตั้งค่า → สีสถานะ &amp; SLA · เกรดที่ไม่ได้ตั้งรอบจะไม่เตือน
        </p>
      </CardContent>

      {open && <FollowUpDrawer row={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function Row({
  row,
  claimed,
  onLogged,
  onClaimed,
  onError,
  onOpen,
}: {
  row: FollowUpRow;
  claimed: boolean;
  onLogged: () => void;
  onClaimed: () => void;
  onError: (m: string | null) => void;
  onOpen: (row: FollowUpRow) => void;
}) {
  const [pending, start] = React.useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after: () => void) =>
    start(async () => {
      onError(null);
      try {
        const res = await fn();
        if (!res.ok) onError(res.error);
        else after();
      } catch {
        onError("บันทึกไม่สำเร็จ — ลองอีกครั้ง");
      }
    });

  return (
    <li className={cn("flex items-center gap-2 py-2", pending && "opacity-50")}>
      <GradeChip grade={row.grade ?? "—"} />

      {/* WHICH SIDE, stated rather than inferred. An owner filed under a nickname and a
          lead named after the project they want look identical, and the two mean
          different work. The grade chip cannot carry it — both sides are graded. */}
      {row.side === "lead" ? (
        <User size={12} strokeWidth={1.75} className="shrink-0 text-text-subtle" aria-label="ลีด" />
      ) : (
        <Building2 size={12} strokeWidth={1.75} className="shrink-0 text-text-subtle" aria-label="ทรัพย์" />
      )}

      <button
        type="button"
        onClick={() => onOpen(row)}
        title={`ดูประวัติ ${row.name}${row.subtitle ? ` · ${row.subtitle}` : ""}`}
        className="min-w-0 flex-1 text-left leading-tight"
      >
        <span className="block truncate text-body text-text hover:text-accent hover:underline">
          {row.name}
        </span>
        {row.subtitle && (
          <span className="block truncate text-label text-text-subtle">
            {row.side === "lead" ? `สนใจ ${row.subtitle}` : row.subtitle}
          </span>
        )}
      </button>

      {/* Days OVER the window, not days since contact. "เกิน 9 วัน" is actionable against
          the grade's own promise; "ติดต่อล่าสุด 12 วันก่อน" means nothing until you also
          remember what the window was. */}
      <span
        className={cn("num shrink-0 text-small font-medium", row.days === null ? "text-red" : "text-amber")}
        title={
          row.days === null
            ? `ยังไม่เคยติดตาม · รอบติดตาม ${row.window} วัน`
            : `ติดต่อล่าสุด ${row.days} วันก่อน · รอบติดตาม ${row.window} วัน`
        }
      >
        {row.days === null ? "ยังไม่เคยตาม" : `เกิน ${row.over} วัน`}
      </span>

      {claimed ? (
        <span className="shrink-0 rounded-md bg-accent-wash px-1.5 py-0.5 text-label font-medium text-accent">
          อยู่ในแผน
        </span>
      ) : (
        <button
          type="button"
          onClick={() => run(() => promoteToPlan(row.side, row.id, row.name), onClaimed)}
          disabled={pending}
          aria-label={`เพิ่ม ${row.name} ลงแผนวันนี้`}
          title="เพิ่มลงแผนวันนี้ — ติ๊กในแผนแล้วระบบจะบันทึกการติดตามให้เอง"
          className="grid size-7 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent-wash disabled:opacity-40"
        >
          <Plus size={15} strokeWidth={2} />
        </button>
      )}

      <button
        type="button"
        onClick={() => run(() => logFollowUp(row.side, row.id), onLogged)}
        disabled={pending}
        aria-label={`บันทึกว่าติดตาม ${row.name} แล้ว`}
        title="บันทึกการติดตามเดี๋ยวนี้"
        className="grid size-7 shrink-0 place-items-center rounded-md text-green transition-colors hover:bg-green-bg disabled:opacity-40"
      >
        <Check size={15} strokeWidth={2} />
      </button>
    </li>
  );
}

/* ---- the history, without leaving the page --------------------------------------
   Four things, because that is what a call needs with a phone already in the hand: who,
   how to reach them, where the record stands, and what was said last. Anything more IS
   the record, and opening it is one tap from the footer — this is the thing that stops
   you having to. */
function FollowUpDrawer({ row, onClose }: { row: FollowUpRow; onClose: () => void }) {
  const [detail, setDetail] = React.useState<FollowUpDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  useTopmostEscape(onClose);

  React.useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    fetchFollowUpDetail(row.side, row.id)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError("โหลดประวัติไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [row.side, row.id]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const href = row.side === "lead" ? `/leads/${row.id}` : `/listings/${row.id}`;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full flex-col gap-3.5 overflow-y-auto rounded-t-xl border border-border bg-surface p-5 shadow-pop sm:max-w-md sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-h2 truncate">{row.name}</div>
            <p className="mt-0.5 text-small text-text-subtle">
              {row.side === "lead" ? "ลีด" : "เจ้าของทรัพย์"} ·{" "}
              {row.days === null ? "ยังไม่เคยติดตาม" : `เกินกำหนด ${row.over} วัน`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-8 shrink-0 place-items-center rounded-md text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {error && <p className="rounded-md bg-red-bg px-3 py-2 text-small text-red">{error}</p>}
        {!detail && !error && (
          <p className="flex items-center gap-2 py-6 text-small text-text-subtle">
            <LoaderCircle size={14} className="animate-spin" /> กำลังโหลด…
          </p>
        )}

        {detail && (
          <>
            {/* HOW TO REACH THEM, as a real link: tapping a number on a phone should dial
                it, which is the entire situation this list is for. */}
            <div className="flex flex-wrap items-center gap-2 text-small">
              {detail.phone ? (
                <a
                  href={`tel:${detail.phone}`}
                  className="num rounded-md bg-accent-wash px-3 py-1.5 font-medium text-accent"
                >
                  {detail.phone}
                </a>
              ) : (
                <span className="rounded-md bg-surface-2 px-3 py-1.5 text-text-subtle">ไม่มีเบอร์</span>
              )}
              {detail.lineId && (
                <span className="rounded-md bg-surface-2 px-3 py-1.5 text-text-muted">LINE {detail.lineId}</span>
              )}
              {detail.state && (
                <span className="rounded-md bg-surface-2 px-3 py-1.5 text-text-muted">{detail.state}</span>
              )}
            </div>

            {detail.subtitle && (
              <p className="text-small text-text-muted">
                {row.side === "lead" ? `สนใจ ${detail.subtitle}` : detail.subtitle}
              </p>
            )}

            <div>
              <h3 className="mb-1.5 text-body font-medium">คุยอะไรไปล่าสุด</h3>
              {detail.recent.length === 0 ? (
                <p className="rounded-md bg-surface-2 px-3 py-2.5 text-small text-text-muted">
                  ยังไม่เคยบันทึกการติดตาม — นี่คือครั้งแรก
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {detail.recent.map((a) => (
                    <li key={a.id} className="py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-label font-medium text-text-muted">{a.kind ?? "โน้ต"}</span>
                        <span className="num shrink-0 text-label text-text-subtle">{formatDate(a.date)}</span>
                      </div>
                      {a.note && <p className="mt-0.5 whitespace-pre-wrap text-body">{a.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              href={href}
              className="inline-flex items-center gap-1.5 self-start text-small font-medium text-accent hover:text-accent-hover"
            >
              เปิดข้อมูลทั้งหมด <ArrowUpRight size={13} strokeWidth={2} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
