import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AI_USD_THB, MODEL_PRICING } from "@/lib/ai/model";

/* What the AI is costing, and whether it is earning it.
 *
 * Two questions, two tables, deliberately kept apart:
 *   ai_usage  — tokens spent. Written on every call, whatever happened afterwards.
 *   ai_job    — what became of the draft. `saved` vs `discarded` is the only honest read on
 *               whether the extractor is good enough to keep paying for.
 *
 * Both are scoped by RLS: own rows for anyone, everyone's for `roles.manage`. So the same
 * function answers "what am I spending" and "what is the company spending" without a second
 * code path, and the CEO's panel and an agent's are the same component.
 */

export interface AiUsageSummary {
  /** Calls that reached OpenAI, ever. A failed parse that never got that far is not here. */
  parses: number;
  /** Calls in the current calendar month — the number a monthly budget is read against. */
  parsesThisMonth: number;
  costUsd: number;
  costUsdThisMonth: number;
  /** ≈ baht, at the hand-maintained AI_USD_THB rate. Shown with the rate beside it. */
  costThb: number;
  costThbThisMonth: number;
  /** Drafts that became real records. */
  saved: number;
  /** Drafts thrown away — the quality signal. */
  discarded: number;
  /** Parses that failed outright (bad key, no credit, OpenAI down, refusal). */
  failed: number;
  /** Still sitting in a tray unreviewed. */
  pending: number;
  /** Which models the spend is actually on. A tier swap shows up here first. */
  models: string[];
}

function costOf(model: string, input: number, output: number): number {
  const p = MODEL_PRICING[model];
  // An unknown model is priced at ZERO rather than guessed at: a made-up rate in a cost
  // report is worse than a visible gap, and `models` below names it so the omission is
  // obvious.
  if (!p) return 0;
  return (input / 1_000_000) * p.inputPerM + (output / 1_000_000) * p.outputPerM;
}

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const supabase = await createClient();

  const [usage, jobs] = await Promise.all([
    supabase.from("ai_usage").select("model,input_tokens,output_tokens,created_at"),
    supabase.from("ai_job").select("status,outcome,consumed_at"),
  ]);

  const rows = (usage.data ?? []) as {
    model: string;
    input_tokens: number;
    output_tokens: number;
    created_at: string;
  }[];

  // The month boundary is the SERVER's, which on Vercel is UTC — between 00:00 and 07:00 ICT
  // on the 1st that is still last month. Accepted here where it is not accepted in lib/range:
  // this is a spend total with no target attached to it, not a figure anyone is measured
  // against, so seven hours of drift once a month costs nothing.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const isThisMonth = (iso: string) => new Date(iso) >= monthStart;

  let costUsd = 0;
  let costUsdThisMonth = 0;
  let parsesThisMonth = 0;
  const models = new Set<string>();

  for (const r of rows) {
    const c = costOf(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0);
    costUsd += c;
    models.add(r.model);
    if (isThisMonth(r.created_at)) {
      costUsdThisMonth += c;
      parsesThisMonth += 1;
    }
  }

  const jobRows = (jobs.data ?? []) as {
    status: string;
    outcome: string | null;
    consumed_at: string | null;
  }[];

  return {
    parses: rows.length,
    parsesThisMonth,
    costUsd,
    costUsdThisMonth,
    costThb: costUsd * AI_USD_THB,
    costThbThisMonth: costUsdThisMonth * AI_USD_THB,
    saved: jobRows.filter((j) => j.outcome === "saved").length,
    discarded: jobRows.filter((j) => j.outcome === "discarded").length,
    failed: jobRows.filter((j) => j.status === "error").length,
    pending: jobRows.filter((j) => !j.consumed_at && j.status === "done").length,
    models: [...models],
  };
}
