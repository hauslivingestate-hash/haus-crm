"use client";

/* จัดการ (ทรัพย์) — the owner-side stage and the listing's marketing status, one tap each.
 *
 * Two pill rows that look alike and mean different things, which is exactly why they sit
 * together and are labelled apart:
 *
 *   ไปป์ไลน์เจ้าของ  where the OWNER relationship stands. New — nothing tracked it before.
 *   สถานะประกาศ     whether the ADVERT is live. This is listing_status, which has always
 *                   existed and was doing double duty as a pipeline it was never shaped for.
 *
 * See lib/ownerPipeline.ts for why they are not one field. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { PillSelect, type PillOption } from "@/components/ui/PillSelect";
import { useRbac } from "@/components/RbacProvider";
import { useMasterData } from "@/components/MasterDataProvider";
import { updateListing } from "@/lib/mutations/listings";
import { ownerStageMeta } from "@/lib/ownerPipeline";
import { listingStatusDot } from "@/lib/status";

const label = "text-label uppercase tracking-wide text-text-subtle mb-1.5";

/* Statuses that take a property OFF the market. Moving through the owner pipeline or
   between Posted/Update/Need Info is everyday work and saves on tap; these four end the
   advert, so they ask once. See components/ui/PillSelect.tsx for why not all of them do. */
const STATUS_WARNING: Record<string, string> = {
  Sold: "ทรัพย์นี้จะถูกถอดออกจากประกาศที่ยังขายอยู่",
  "Sold Completed": "ปิดการขายและโอนเรียบร้อย — ทรัพย์นี้จะถูกถอดออกจากประกาศที่ยังขายอยู่",
  Cancel: "เจ้าของยกเลิก — ทรัพย์นี้จะถูกถอดออกจากประกาศที่ยังขายอยู่",
  "Cancel Completed": "เจ้าของยกเลิกแล้ว — ทรัพย์นี้จะถูกถอดออกจากประกาศที่ยังขายอยู่",
};

export function ListingManageCard({
  listingId,
  ownerStage,
  listingStatus,
}: {
  listingId: string;
  ownerStage: string | null;
  listingStatus: string | null;
}) {
  const router = useRouter();
  const { can } = useRbac();
  const { listingStatuses, ownerStages } = useMasterData();
  const editable = can("listings.edit") || can("roles.manage");

  const save = React.useCallback(
    async (patch: Record<string, string>) => {
      const res = await updateListing(listingId, patch);
      if (!res.ok) return res.error;
      router.refresh();
      return null;
    },
    [listingId, router]
  );

  // List and labels both from ตั้งค่า (owner_stage, in stored order) — the stage is shown
  // under the name it is stored as, so Settings and this card can never disagree. Only the
  // dot colour comes from code.
  const stageOpts: PillOption<string>[] = withCurrent(
    ownerStages.map((s) => ({ value: s.id, label: s.label, dot: ownerStageMeta(s.id).dot })),
    ownerStage
  );
  // The status vocabulary is governed in ตั้งค่า, so it is read from the live list rather
  // than a constant here — a status added there must appear without a code change.
  const statusOpts: PillOption<string>[] = withCurrent(
    listingStatuses.map((s) => ({
      value: s.label,
      label: s.label,
      dot: listingStatusDot(s.label),
    })),
    listingStatus
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3.5">
        <div>
          <div className={label}>ไปป์ไลน์เจ้าของ</div>
          <PillSelect
            aria-label="ไปป์ไลน์เจ้าของ"
            size="sm"
            value={ownerStage}
            options={stageOpts}
            disabled={!editable}
            onChange={(v) => save({ owner_stage: v })}
          />
        </div>
        <div>
          <div className={label}>สถานะประกาศ</div>
          <PillSelect
            aria-label="สถานะประกาศ"
            size="sm"
            value={listingStatus}
            options={statusOpts}
            disabled={!editable}
            confirm={(v) => STATUS_WARNING[v] ?? null}
            onChange={(v) => save({ listing_status: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Keep a stored value visible even if the vocabulary has since lost it — otherwise the
    row lights nothing and the next tap overwrites a value nobody was shown. */
function withCurrent(options: PillOption<string>[], value: string | null): PillOption<string>[] {
  if (!value || options.some((o) => o.value === value)) return options;
  return [...options, { value, label: value }];
}
