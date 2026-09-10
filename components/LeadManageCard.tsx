"use client";

/* จัดการ — stage, status and grade, one tap each.
 *
 * These three fields are the ones that change most often and they were the most expensive
 * to change: open แก้ไข, find the dropdown, open it, pick, save, close. Five actions to
 * move a lead one step down the pipeline, which is why 4 completed deals were still
 * sitting at Lead/Show/Appoint with money and both dates on them — nobody went back.
 *
 * The full แก้ไข form still exists and still owns everything else (name, phone, LINE,
 * type, budget). This is not a second editor; it is THE editor for these three — the form
 * used to offer them too, which meant one screen with two rules: a pill that saved on tap
 * and a dropdown that saved on บันทึก, for the same field. Change it in the form, close
 * without saving, and nobody could tell you what the lead now says.
 *
 * ── WHICH TAPS ASK FIRST ────────────────────────────────────────────────────────
 * Most do not. Moving ติดตาม → นัดหมาย by mistake is undone by tapping the right pill,
 * and updateLead audits every change, so friction there would buy nothing and cost the
 * one thing this card exists for.
 *
 * The endings are different. Close/Win says the deal happened — it is what makes the
 * closing card demand a price and what the company's revenue is counted from. Lose/Reject
 * says the customer is gone and drops them out of every live list, including ผู้สนใจ on
 * the listing they were looking at. Those four are worth one question. */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { PillSelect, type PillOption } from "@/components/ui/PillSelect";
import { useRbac } from "@/components/RbacProvider";
import { updateLead } from "@/lib/mutations/leads";
import { stageMeta, CLOSED_STAGES } from "@/lib/pipeline";
import { useMasterData } from "@/components/MasterDataProvider";
import { LEAD_POTENTIALS } from "@/lib/leads";
import { leadStatusDot } from "@/lib/status";
import { useRouter } from "next/navigation";

const LEAD_STATUSES = ["Active", "Win", "Lose", "Reject"];

const label = "text-label uppercase tracking-wide text-text-subtle mb-1.5";

/* The values that end something, and what they cost if tapped by accident. Kept as data
   next to the vocabularies they belong to, so adding a status here is one line rather than
   a branch buried in the render. */
const STATUS_WARNING: Record<string, string> = {
  Win: "ปิดการขายแล้ว — ลีดนี้จะนับเป็นดีลที่ปิดได้ และต้องกรอกราคาปิดในการ์ดการปิดการขาย",
  Lose: "ลีดนี้จะถือว่าจบแล้ว และจะหายไปจากรายชื่อที่ยังติดตามอยู่ รวมถึงผู้สนใจของทรัพย์",
  Reject: "ลีดนี้จะถือว่าจบแล้ว และจะหายไปจากรายชื่อที่ยังติดตามอยู่ รวมถึงผู้สนใจของทรัพย์",
};

const STAGE_WARNING =
  "ทำเครื่องหมายว่าปิดการขาย — การ์ดการปิดการขายจะเปิดขึ้นและยอดนี้จะเข้าไปนับในรายได้ของบริษัท";

export function LeadManageCard({
  leadId,
  stage,
  status,
  potential,
}: {
  leadId: string;
  stage: string | null;
  status: string | null;
  potential: string | null;
}) {
  const router = useRouter();
  const { can } = useRbac();
  const { pipelineStages } = useMasterData();
  const editable = can("leads.edit") || can("leads.assign") || can("roles.manage");

  // One write path for all three — updateLead already validates the field name, re-reads
  // the live row before diffing and writes the audit entry, so nothing here needs to.
  const save = React.useCallback(
    async (patch: Record<string, string>) => {
      const res = await updateLead(leadId, patch);
      if (!res.ok) return res.error;
      router.refresh();
      return null;
    },
    [leadId, router]
  );

  /* A value the vocabulary no longer contains still has to appear, selected. Imported
     sheet rows carry stages and grades that were later renamed, and a pill row with
     nothing lit reads as "unset" — the next tap would then overwrite a real value the
     user was never shown. */
  /* The LIST comes from ตั้งค่า (the pipeline_stage table, in its stored order); the Thai
     label and the dot colour come from lib/pipeline.ts for stages it knows, and fall back
     to the stage's own name for one added since. That split is deliberate: the business
     owns which stages exist, the code owns how a known stage is drawn. */
  const stageOpts: PillOption<string>[] = withCurrent(
    pipelineStages.map((s) => {
      const m = stageMeta(s.id);
      return { value: s.id, label: m.label, dot: m.dot };
    }),
    stage
  );
  const statusOpts: PillOption<string>[] = withCurrent(
    LEAD_STATUSES.map((s) => ({ value: s, label: s, dot: leadStatusDot(s) })),
    status
  );
  const gradeOpts: PillOption<string>[] = withCurrent(
    LEAD_POTENTIALS.map((p) => ({ value: p, label: p })),
    potential
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3.5">
        <div>
          <div className={label}>ขั้นตอน</div>
          <PillSelect
            aria-label="ขั้นตอน"
            size="sm"
            value={stage}
            options={stageOpts}
            disabled={!editable}
            confirm={(v) => (CLOSED_STAGES.includes(v) ? STAGE_WARNING : null)}
            onChange={(v) => save({ pipeline_stage: v })}
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3.5">
          <div>
            <div className={label}>สถานะ</div>
            <PillSelect
              aria-label="สถานะ"
              size="sm"
              value={status}
              options={statusOpts}
              disabled={!editable}
              confirm={(v) => STATUS_WARNING[v] ?? null}
              onChange={(v) => save({ lead_status: v })}
            />
          </div>
          <div>
            <div className={label}>Potential</div>
            <PillSelect
              aria-label="Potential"
              size="sm"
              value={potential}
              options={gradeOpts}
              disabled={!editable}
              onChange={(v) => save({ potential: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Append the stored value when the vocabulary has lost it, so it can still be seen. */
function withCurrent(options: PillOption<string>[], value: string | null): PillOption<string>[] {
  if (!value || options.some((o) => o.value === value)) return options;
  return [...options, { value, label: value }];
}
