"use client";

/* การปิดการขาย — where a sale records a deal, and the only place the company's revenue
   is entered.

   Since 2026-09-10 a deal is a CASE (closed_case), not five columns on the lead. The card
   shows the lead's live case — or its latest failed one, so a lead whose deal fell
   through says so — and the form writes a case back.

   WHAT IT ASKS FOR IS DELIBERATELY SHORT. Only what the person closing actually knows.
   Everything else is READ-ONLY CONTEXT pulled from the listing, or worked out: the case
   id, who is credited, the status. Asking a sale to retype a number the database already
   holds is how the two copies start to disagree.

   STATUS IS NEVER A DROPDOWN. Entering a transfer date IS saying the money arrived; the
   card tells you what it is about to record instead of asking twice. The one exception is
   ดีลไม่จบ — nothing in the data can know a deal fell through, so that is a button, with
   a confirmation, because it is the one click on this card that cannot be undone by
   re-saving.

   THE ASKING PRICE SITS NEXT TO THE CLOSING PRICE on purpose (Ben, 2026-09-06). Seeing
   the gap as you type it is the cheapest possible check against a typo. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, AlertTriangle, Hourglass, LoaderCircle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRbac } from "@/components/RbacProvider";
import { saveDealClose } from "@/lib/mutations/deals";
import { removeLeadLastMatch } from "@/lib/mutations/lastMatch";
import {
  CASE_STATUS_LABEL,
  CLOSED_DEAL_STAGES,
  DEAL_GAP_LABEL,
  DEAL_KIND_LABEL,
  SALE_COMMISSION_RATE,
  SOLD_LISTING_STATUS,
  caseGaps,
  type ClosedCase,
  type DealKind,
} from "@/lib/deals";
import { formatBaht, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  leadId: string;
  /** Who the lead belongs to — the primary agent on a new case. */
  leadSaleId: string | null;
  /** The case to show and edit. Null = this lead has never closed. */
  deal: ClosedCase | null;
  pipelineStage: string | null;
  listingCode: string | null;
  askingPrice: number | null;
  listingStatus: string | null;
  lastMatch: { last_match_id: string; last_match_price: number | null } | null;
  /** For the co-agent picker. */
  agents: { employeeCode: string; nickname: string }[];
}

const label = "text-small text-text-muted mb-1.5";
const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function CloseDealCard(props: Props) {
  const router = useRouter();
  const { can } = useRbac();
  const editable = can("leads.edit") || can("leads.assign");
  const { deal } = props;

  const closed = !!deal || CLOSED_DEAL_STAGES.has(props.pipelineStage ?? "");
  const gaps = deal ? caseGaps(deal) : [];

  const [open, setOpen] = React.useState(false);
  const [confirmFail, setConfirmFail] = React.useState(false);
  const [dealType, setDealType] = React.useState<DealKind>(deal?.deal_type ?? "sale");
  const [price, setPrice] = React.useState(deal?.closing_price == null ? "" : String(deal.closing_price));
  const [closingDate, setClosingDate] = React.useState(deal?.closing_date ?? "");
  const [forecast, setForecast] = React.useState(deal?.forecast_revenue == null ? "" : String(deal.forecast_revenue));
  const [transferDate, setTransferDate] = React.useState(deal?.transfer_date ?? "");
  const [real, setReal] = React.useState(deal?.real_revenue == null ? "" : String(deal.real_revenue));
  const [remark, setRemark] = React.useState(deal?.remark ?? "");
  const co = deal?.agents.find((a) => !a.is_primary) ?? null;
  const [coCode, setCoCode] = React.useState(co?.employee_code ?? "");
  const [coForecast, setCoForecast] = React.useState(co?.forecast_share == null ? "" : String(co.forecast_share));
  const [coReal, setCoReal] = React.useState(co?.real_share == null ? "" : String(co.real_share));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // Re-seed from the server after a save or a navigation, so a cancelled edit shows
  // what is stored and not what was half-typed.
  React.useEffect(() => {
    setDealType(deal?.deal_type ?? "sale");
    setPrice(deal?.closing_price == null ? "" : String(deal.closing_price));
    setClosingDate(deal?.closing_date ?? "");
    setForecast(deal?.forecast_revenue == null ? "" : String(deal.forecast_revenue));
    setTransferDate(deal?.transfer_date ?? "");
    setReal(deal?.real_revenue == null ? "" : String(deal.real_revenue));
    setRemark(deal?.remark ?? "");
    const c = deal?.agents.find((a) => !a.is_primary) ?? null;
    setCoCode(c?.employee_code ?? "");
    setCoForecast(c?.forecast_share == null ? "" : String(c.forecast_share));
    setCoReal(c?.real_share == null ? "" : String(c.real_share));
  }, [deal]);

  // An open lead nobody has closed shows nothing at all — a blank closing form on every
  // live lead in the company is noise, and it invites a half-filled row.
  if (!closed && !open && !editable) return null;

  const priceNum = Number(price.replace(/,/g, ""));
  const showGap = Number.isFinite(priceNum) && priceNum > 0 && props.askingPrice != null;
  const gapAmount = showGap ? priceNum - (props.askingPrice ?? 0) : 0;
  const suggestedForecast =
    dealType === "sale" && Number.isFinite(priceNum) && priceNum > 0
      ? Math.round(priceNum * SALE_COMMISSION_RATE)
      : null;
  const willBe = transferDate ? "success" : "pending";

  const primaryCode = deal?.agents.find((a) => a.is_primary)?.employee_code ?? props.leadSaleId;
  const nameOf = (code: string | null | undefined) =>
    code ? props.agents.find((a) => a.employeeCode === code)?.nickname ?? code : "—";

  async function save(markFailed = false) {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await saveDealClose(props.leadId, {
      caseId: deal?.case_id ?? null,
      dealType,
      closingPrice: price,
      closingDate,
      forecastRevenue: forecast,
      transferDate,
      realRevenue: real,
      remark,
      coAgent: coCode ? { employeeCode: coCode, forecastShare: coForecast, realShare: coReal } : null,
      markFailed,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.listingUpdated) setNote(`อัปเดตทรัพย์ ${props.listingCode} เป็น Sold Completed แล้ว`);
    setOpen(false);
    setConfirmFail(false);
    router.refresh();
  }

  /* The undo. Offered only while the lead is NOT closed and an entry is still there — i.e.
     someone recorded a sale and has since reopened the deal, which leaves the market log
     claiming a property sold that did not. */
  const orphanedMatch = !closed && props.lastMatch ? props.lastMatch : null;

  async function removeMatch() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await removeLeadLastMatch(props.leadId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNote("ลบบันทึก Last Match แล้ว");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote size={16} strokeWidth={1.75} className="text-green" />
          การปิดการขาย
          {deal && <span className="num text-small font-normal text-text-subtle">{deal.case_id}</span>}
        </CardTitle>
        {editable && !open && (
          <Button size="sm" variant={gaps.length ? "primary" : "secondary"} onClick={() => setOpen(true)}>
            {deal ? "แก้ไข" : "บันทึกการปิด"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {orphanedMatch && editable && (
          <div className="flex flex-col gap-2 rounded-md border border-amber/40 bg-amber/10 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" />
              <div className="text-small">
                <div className="font-medium">ดีลนี้เปิดใหม่แล้ว แต่ยังมีบันทึกใน Last Match</div>
                <div className="text-text-muted">
                  บันทึก <span className="num">{orphanedMatch.last_match_id}</span>
                  {orphanedMatch.last_match_price != null && (
                    <> ราคา <span className="num">{formatBaht(orphanedMatch.last_match_price)}</span></>
                  )}{" "}
                  ยังบอกว่าทรัพย์นี้ขายไปแล้ว — ถ้าดีลไม่จบจริง ควรลบออก
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end">
              <Button size="sm" variant="secondary" onClick={removeMatch} disabled={busy}>
                {busy ? <LoaderCircle size={13} className="animate-spin" /> : null}
                ลบบันทึก
              </Button>
            </div>
          </div>
        )}

        {/* The nag, in place. The bell tells you a deal is short; this says which part. */}
        {gaps.length > 0 && !open && (
          <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 px-3 py-2">
            <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" />
            <div className="text-small">
              <div className="font-medium">ดีลนี้ยังกรอกข้อมูลไม่ครบ</div>
              <div className="text-text-muted">ขาด: {gaps.map((g) => DEAL_GAP_LABEL[g]).join(" · ")}</div>
            </div>
          </div>
        )}

        {open ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className={label}>ประเภทดีล</div>
              <div className="inline-flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5">
                {(["sale", "rent"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDealType(k)}
                    aria-pressed={dealType === k}
                    className={cn(
                      "h-7 rounded-[7px] px-3 text-small transition-colors",
                      dealType === k ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text"
                    )}
                  >
                    {DEAL_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={label}>
                ราคาปิดจริง (บาท)
                {props.askingPrice != null && (
                  <span className="text-text-subtle"> · ตั้งขาย {formatBaht(props.askingPrice)}</span>
                )}
              </div>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="เช่น 6500000" className="w-full num" />
              {showGap && gapAmount !== 0 && (
                <div className={cn("mt-1 text-label num", gapAmount < 0 ? "text-red" : "text-green")}>
                  {gapAmount < 0 ? "ต่ำกว่าตั้งขาย " : "สูงกว่าตั้งขาย "}
                  {formatBaht(Math.abs(gapAmount))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={label}>วันที่ปิด (เซ็นสัญญา)</div>
                <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="w-full" />
              </div>
              <div>
                <div className={label}>
                  คอมมิชชั่นที่คาดว่าจะได้ (บาท)
                  {suggestedForecast != null && !forecast && (
                    <span className="text-text-subtle"> · 3% = {formatBaht(suggestedForecast)}</span>
                  )}
                </div>
                <Input
                  value={forecast}
                  onChange={(e) => setForecast(e.target.value)}
                  inputMode="numeric"
                  placeholder={suggestedForecast != null ? String(suggestedForecast) : "เช่น 195000"}
                  className="w-full num"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={label}>
                  วันที่โอน <span className="text-text-subtle">· ยังไม่โอนเว้นว่าง</span>
                </div>
                <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full" />
              </div>
              <div>
                <div className={label}>
                  ยอดที่ได้รับจริง (บาท) <span className="text-text-subtle">· ถ้าต่างจากที่คาด</span>
                </div>
                <Input value={real} onChange={(e) => setReal(e.target.value)} inputMode="numeric" placeholder={forecast || "เท่าที่คาด"} className="w-full num" />
              </div>
            </div>

            {/* Co-broke. A second agent and their share of each figure, in baht — the
                register's own splits are not always even. Blank shares = half each. */}
            <div>
              <div className={label}>
                โคเอเจนต์ <span className="text-text-subtle">· ถ้าปิดร่วมกับคนอื่นในบริษัท</span>
              </div>
              <select value={coCode} onChange={(e) => setCoCode(e.target.value)} className={field}>
                <option value="">— ไม่มี —</option>
                {props.agents
                  .filter((a) => a.employeeCode !== primaryCode)
                  .map((a) => (
                    <option key={a.employeeCode} value={a.employeeCode}>
                      {a.nickname}
                    </option>
                  ))}
              </select>
              {coCode && (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className={label}>ส่วนแบ่งของ {nameOf(coCode)} (บาท)</div>
                    <Input value={coForecast} onChange={(e) => setCoForecast(e.target.value)} inputMode="numeric" placeholder="เว้นว่าง = ครึ่งหนึ่ง" className="w-full num" />
                  </div>
                  <div>
                    <div className={label}>จากยอดที่ได้รับจริง</div>
                    <Input value={coReal} onChange={(e) => setCoReal(e.target.value)} inputMode="numeric" placeholder="เว้นว่าง = ครึ่งหนึ่ง" className="w-full num" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className={label}>หมายเหตุ</div>
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full" />
            </div>

            {error && <div className="text-small text-red">{error}</div>}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void save(false)} disabled={busy}>
                {busy && <LoaderCircle size={14} className="animate-spin" />}
                บันทึกเป็น &quot;{CASE_STATUS_LABEL[willBe]}&quot;
              </Button>
              <Button variant="ghost" onClick={() => { setOpen(false); setConfirmFail(false); }} disabled={busy}>
                ยกเลิก
              </Button>
              {deal && deal.status !== "fail" && !confirmFail && (
                <button
                  type="button"
                  onClick={() => setConfirmFail(true)}
                  disabled={busy}
                  className="ml-auto inline-flex items-center gap-1 text-small text-text-muted transition-colors hover:text-red"
                >
                  <XCircle size={13} strokeWidth={1.75} /> ดีลไม่จบ
                </button>
              )}
            </div>
            {confirmFail && (
              <div className="flex flex-col gap-2 rounded-md border border-red/30 bg-red-bg/50 px-3 py-2.5 text-small">
                <div>
                  <div className="font-medium">บันทึกว่าดีลนี้ไม่จบ?</div>
                  <div className="text-text-muted">
                    เคส {deal?.case_id} จะไม่ถูกนับเป็นรายได้อีก ทั้งที่คาดและที่รับจริง · ขั้นตอนของลีดและสถานะทรัพย์จะไม่ถูกเปลี่ยนให้อัตโนมัติ
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end">
                  <Button size="sm" variant="secondary" onClick={() => setConfirmFail(false)} disabled={busy}>ไม่ใช่</Button>
                  <Button size="sm" onClick={() => void save(true)} disabled={busy}>ใช่ ดีลไม่จบ</Button>
                </div>
              </div>
            )}
            {props.listingCode && willBe !== "pending" ? null : props.listingCode && (
              <p className="text-label text-text-subtle">
                เมื่อบันทึก ระบบจะตั้งสเตจเป็น Win และอัปเดตทรัพย์ {props.listingCode} เป็น Sold Completed ให้อัตโนมัติ
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-body">
            {deal && (
              <Row label="สถานะ">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-small font-medium",
                    deal.status === "success" && "bg-green-bg text-green",
                    deal.status === "pending" && "bg-amber-bg text-amber",
                    deal.status === "fail" && "bg-red-bg text-red"
                  )}
                >
                  {deal.status === "pending" && <Hourglass size={12} strokeWidth={1.75} />}
                  {CASE_STATUS_LABEL[deal.status]}
                  {deal.deal_type === "rent" && " · เช่า"}
                </span>
              </Row>
            )}
            <Row label="ราคาปิด">
              {deal?.closing_price != null ? <span className="num font-semibold">{formatBaht(deal.closing_price)}</span> : <Missing />}
            </Row>
            {props.askingPrice != null && (
              <Row label="ตั้งขาย">
                <span className="num text-text-muted">{formatBaht(props.askingPrice)}</span>
              </Row>
            )}
            <Row label="คอมมิชชั่นที่คาด">
              {deal?.forecast_revenue != null ? <span className="num font-semibold">{formatBaht(deal.forecast_revenue)}</span> : <Missing />}
            </Row>
            {deal?.status === "success" && (
              <Row label="ได้รับจริง">
                {deal.real_revenue != null ? (
                  <span className="num font-semibold text-green">{formatBaht(deal.real_revenue)}</span>
                ) : (
                  <Missing />
                )}
              </Row>
            )}
            <Row label="วันที่ปิด">
              {deal?.closing_date ? <span className="num">{formatDate(deal.closing_date)}</span> : <Missing />}
            </Row>
            <Row label="วันที่โอน">
              {deal?.transfer_date ? (
                <span className="num">{formatDate(deal.transfer_date)}</span>
              ) : deal?.status === "pending" ? (
                <span className="inline-flex items-center gap-1 text-small text-text-muted">
                  <Hourglass size={12} strokeWidth={1.75} /> รอโอน
                </span>
              ) : (
                <span className="text-text-subtle">—</span>
              )}
            </Row>
            {deal && deal.agents.length > 1 && (
              <Row label="แบ่งคอม">
                <span className="num text-text-muted">
                  {deal.agents
                    .map((a) => `${nameOf(a.employee_code)} ${a.forecast_share != null ? formatBaht(a.forecast_share) : "—"}`)
                    .join(" · ")}
                </span>
              </Row>
            )}
            {deal?.remark && (
              <Row label="หมายเหตุ">
                <span className="text-text-muted">{deal.remark}</span>
              </Row>
            )}
            {deal && deal.status !== "fail" && props.listingCode && props.listingStatus !== SOLD_LISTING_STATUS && (
              <div className="text-label text-text-subtle">
                ทรัพย์ {props.listingCode} ยังเป็น &quot;{props.listingStatus ?? "—"}&quot; — กด &quot;แก้ไข&quot; แล้วบันทึกเพื่ออัปเดตเป็น Sold Completed
              </div>
            )}
            {note && (
              <div className="flex items-center gap-1.5 text-small text-green">
                <Check size={13} strokeWidth={2} /> {note}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-small text-text-muted">{l}</span>
      {children}
    </div>
  );
}

/** A gap, shown as a gap. An em-dash would read as "nothing to record here", which is the
    opposite of what a missing closing price means. */
function Missing() {
  return <span className="text-small text-amber">ยังไม่กรอก</span>;
}
