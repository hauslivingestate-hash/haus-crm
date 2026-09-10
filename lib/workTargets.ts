/* The metric vocabulary for goals on the ความเคลื่อนไหว card.
 *
 * A "metric" is what ONE ROW of that card is scored against. Three kinds exist, because
 * the card draws three kinds of row:
 *
 *   stage:<name>       one BUYER pipeline step, summing every action that advances it
 *   ownerStage:<name>  one OWNER pipeline step, likewise
 *   action:<name>      one action type on its own — the งานอื่นๆ section, which is
 *                      countable work that advances no step on either side
 *
 * ── THE STRING IS A UI KEY, NOT THE STORAGE ─────────────────────────────────────
 * This is the important part. Klaichan CRM stores its equivalent AS the string, in a
 * `targets.metric` column. We do not, and must not: our stage and action names are
 * editable in ตั้งค่า, so a stored 'stage:Call' would point at nothing the moment
 * somebody renames Call — a goal that quietly stops being read, which is worse than one
 * that breaks loudly.
 *
 * In Postgres these are real foreign keys (`targets.stage_name`, `targets.activity_type`,
 * both ON UPDATE CASCADE) and a rename carries the goal with it. The string exists only
 * so a React key, a form field and a lookup map can all say "this row" in one token.
 * `toColumns` is the one place the two representations meet.
 */

import type { PeriodLength } from "@/lib/range";

export type WorkMetric = string;

export function actionMetric(action: string): WorkMetric {
  return `action:${action}`;
}

export function stageMetric(stage: string): WorkMetric {
  return `stage:${stage}`;
}

export function ownerStageMetric(stage: string): WorkMetric {
  return `ownerStage:${stage}`;
}

/** What one metric writes into `targets`. The inverse is never needed — rows are read
    back through `metricOfRow`, which reads the columns, not a string. */
export function toColumns(metric: WorkMetric): {
  source: "activity" | "stage" | "owner_stage";
  activityType: string | null;
  stageName: string | null;
  ownerStageName: string | null;
} | null {
  // Checked before "stage:" — `ownerStage:` does not start with it, but reading them in
  // this order makes that impossible to break by editing one prefix later.
  if (metric.startsWith("ownerStage:")) {
    const name = metric.slice(11);
    return name ? { source: "owner_stage", activityType: null, stageName: null, ownerStageName: name } : null;
  }
  if (metric.startsWith("action:")) {
    const name = metric.slice(7);
    return name ? { source: "activity", activityType: name, stageName: null, ownerStageName: null } : null;
  }
  if (metric.startsWith("stage:")) {
    const name = metric.slice(6);
    return name ? { source: "stage", activityType: null, stageName: name, ownerStageName: null } : null;
  }
  return null;
}

/** The key for a stored row, so a rename that cascaded in Postgres lands on the renamed
    row here too — the string is rebuilt from the columns on every read, never stored. */
export function metricOfRow(row: {
  source: string;
  activity_type: string | null;
  stage_name: string | null;
  owner_stage_name: string | null;
}): WorkMetric | null {
  if (row.source === "activity" && row.activity_type) return actionMetric(row.activity_type);
  if (row.source === "stage" && row.stage_name) return stageMetric(row.stage_name);
  if (row.source === "owner_stage" && row.owner_stage_name) return ownerStageMetric(row.owner_stage_name);
  return null;
}

/** Every period length a work goal may be set for, in the same order as the revenue
    editor, so the two forms read alike. */
export const WORK_TARGET_PERIODS: PeriodLength[] = ["day", "week", "month", "quarter", "year"];
