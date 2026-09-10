"use client";

/* การปิดการขาย — where a sale records a deal, and the only place the company's revenue
   is entered.

   This card replaced a read-only pair of rows (commission + closing date) that displayed
   numbers nothing in the app could write. The data got in by spreadsheet import, which is
   the "old way" this is meant to end: close the deal, fill four boxes, done — no message to
   admin, no second system.

   WHAT IT ASKS FOR IS DELIBERATELY SHORT. Only the four things the person closing actually
   knows. Everything else on this card is READ-ONLY CONTEXT pulled from the listing — the
   asking price to compare against, who the listing says is selling it. Asking a sale to
   retype a number the database already holds is how the two copies start to disagree.

   THE ASKING PRICE SITS NEXT TO THE CLOSING PRICE on purpose (Ben, 2026-09-06: "the closing
   price might not be the same as the asking price"). Seeing the gap as you type it is the
   cheapest possible check against a typo, and the gap itself is a number the company has
   never been able to see. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, AlertTriangle, Hourglass, LoaderCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRbac } from "@/components/RbacProvider";
import { saveDealClose } from "@/lib/mutations/deals";
import { removeLeadLastMatch } from "@/lib/mutations/lastMatch";
import { dealGaps, isAwaitingTransfer, isClosed, DEAL_GAP_LABEL, SOLD_LISTING_STATUS } from "@/lib/deals";
import { formatBaht, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  leadId: string;
  closingPrice: number | null;
  closingDate: string | null;
  transferDate: string | null;
  commission: number | null;
  remark: string | null;
  pipelineStage: string | null;
  /** Context from the linked listing. Null when no listing is linked. */
  listingCode: string | null;
  askingPrice: number | null;
  /** The listing's own status. Used only to point out the reverse mismatch — a deal that
      closed under a listing still marked Posted. Four listings look like that today. */
  listingStatus: string | null;
  /** The market-log entry this lead's close created, if one exists. Null when the deal was
      never recorded there — or when the viewer may not read main_7_last_match, which reads
      the same way here: nothing to offer. */
  lastMatch: { last_match_id: string; last_match_price: number | null } | null;
}

const label = "text-small text-text-muted mb-1.5";

export function CloseDealCard(props: Props) {
  const router = useRouter();
  const { can } = useRbac();
  const editable = can("leads.edit") || can("leads.assign");

  const facts = {
    pipeline_stage: props.pipelineStage,
    closing_price: props.closingPrice,
    closing_date: props.closingDate,
    transfer_date: props.transferDate,
    commission: props.commission,
  };
  const closed = isClosed(facts);
  const gaps = dealGaps(facts);
  const awaiting = isAwaitingTransfer(facts);

  const [open, setOpen] = React.useState(false);
  const [price, setPrice] = React.useState(props.closingPrice == null ? "" : String(props.closingPrice));
  const [closingDate, setClosingDate] = React.useState(props.closingDate ?? "");
  const [transferDate, setTransferDate] = React.useState(props.transferDate ?? "");
  const [commission, setCommission] = React.useState(props.commission == null ? "" : String(props.commission));
  const [remark, setRemark] = React.useState(props.remark ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // Re-sync when the server sends fresh values (after router.refresh, or a grid edit
  // elsewhere). Without this the form keeps showing what was typed before the last save.
  React.useEffect(() => {
    setPrice(props.closingPrice == null ? "" : String(props.closingPrice));
    setClosingDate(props.closingDate ?? "");
    setTransferDate(props.transferDate ?? "");
    setCommission(props.commission == null ? "" : String(props.commission));
    setRemark(props.remark ?? "");
  }, [props.closingPrice, props.closingDate, props.transferDate, props.commission, props.remark]);

  // An open lead nobody has closed shows nothing at all — a blank closing form on every
  // live lead in the company is noise, and it invites a half-filled row.
  if (!closed && !open && !editable) return null;

  const priceNum = Number(price.replace(/,/g, ""));
  const showGap = Number.isFinite(priceNum) && priceNum > 0 && props.askingPrice != null;
  const gapAmount = showGap ? priceNum - (props.askingPrice ?? 0) : 0;

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await saveDealClose(props.leadId, {
      closingPrice: price,
      closingDate,
      transferDate,
      commission,
      remark,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.listingUpdated) setNote(`อัปเดตทรัพย์ ${props.listingCode} เป็น Sold Completed แล้ว`);
    setOpen(false);
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
        </CardTitle>
        {editable && !open && (
          <Button size="sm" variant={gaps.length ? "primary" : "secondary"} onClick={() => setOpen(true)}>
            {closed ? "แก้ไข" : "บันทึกการปิด"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ── THE UNDO ────────────────────────────────────────────────────────────
            A banner rather than a popup on the moment the stage is reopened, for two
            reasons: a popup is gone the instant it is mis-clicked and the wrong entry
            would then stay forever, and the answer is often not knowable yet — a buyer
            wobbling is not the same as a deal that is dead. This waits until it is.
            It disappears on its own if the lead is closed again. */}
        {orphanedMatch && editable && (
          <div className="flex flex-col gap-2 rounded-md border border-amber/40 bg-amber/10 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" />
              <div className="text-small">
                <div className="font-medium">ดีลนี้เปิดใหม่แล้ว แต่ยังมีบันทึกใน Last Match</div>
                <div className="text-text-muted">
                  บันทึก{" "}
                  <span className="num">{orphanedMatch.last_match_id}</span>
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
        {gaps.length > 0 && (
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
              <div className={label}>
                ราคาปิดจริง (บาท)
                {props.askingPrice != null && (
                  <span className="text-text-subtle"> · ตั้งขาย {formatBaht(props.askingPrice)}</span>
                )}
              </div>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                placeholder="เช่น 6500000"
                className="w-full num"
              />
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
                <Input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <div className={label}>
                  วันที่โอน <span className="text-text-subtle">· ยังไม่โอนเว้นว่าง</span>
                </div>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <div className={label}>คอมมิชชั่น (บาท)</div>
              <Input
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                inputMode="numeric"
                placeholder="เช่น 195000"
                className="w-full num"
              />
            </div>

            <div>
              <div className={label}>หมายเหตุ</div>
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full" />
            </div>

            {error && <div className="text-small text-red">{error}</div>}

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={busy}>
                {busy && <LoaderCircle size={14} className="animate-spin" />}
                บันทึก
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                ยกเลิก
              </Button>
            </div>
            {props.listingCode && (
              <p className="text-label text-text-subtle">
                เมื่อบันทึก ระบบจะตั้งสเตจเป็น Win และอัปเดตทรัพย์ {props.listingCode} เป็น Sold Completed ให้อัตโนมัติ
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-body">
            <Row label="ราคาปิด">
              {props.closingPrice != null ? (
                <span className="num font-semibold">{formatBaht(props.closingPrice)}</span>
              ) : (
                <Missing />
              )}
            </Row>
            {props.askingPrice != null && (
              <Row label="ตั้งขาย">
                <span className="num text-text-muted">{formatBaht(props.askingPrice)}</span>
              </Row>
            )}
            <Row label="คอมมิชชั่น">
              {props.commission != null ? (
                <span className="num font-semibold text-green">{formatBaht(props.commission)}</span>
              ) : (
                <Missing />
              )}
            </Row>
            <Row label="วันที่ปิด">
              {props.closingDate ? <span className="num">{formatDate(props.closingDate)}</span> : <Missing />}
            </Row>
            <Row label="วันที่โอน">
              {props.transferDate ? (
                <span className="num">{formatDate(props.transferDate)}</span>
              ) : awaiting ? (
                <span className="inline-flex items-center gap-1 text-small text-text-muted">
                  <Hourglass size={12} strokeWidth={1.75} /> รอโอน
                </span>
              ) : (
                <span className="text-text-subtle">—</span>
              )}
            </Row>
            {props.remark && (
              <Row label="หมายเหตุ">
                <span className="text-text-muted">{props.remark}</span>
              </Row>
            )}
            {/* The deal says sold, the listing says otherwise. Saving the card fixes it,
                so this points at the button rather than asking for a second edit. */}
            {closed && props.listingCode && props.listingStatus !== SOLD_LISTING_STATUS && (
              <div className="text-label text-text-subtle">
                ทรัพย์ {props.listingCode} ยังเป็น &quot;{props.listingStatus ?? "—"}&quot; —
                กด &quot;แก้ไข&quot; แล้วบันทึกเพื่ออัปเดตเป็น Sold Completed
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
