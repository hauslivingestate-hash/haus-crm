/* WHICH MODEL, AND WHAT IT COSTS. One line to swap tiers.
 *
 * ⚠️ ZERO IMPORTS, and it stays that way. These constants are read by lib/ai/extract.ts
 * (which is `server-only` and pulls in the OpenAI SDK) AND by the ตั้งค่า ▸ AI panel, which
 * is a client component. Leaving them in extract.ts meant the panel imported `server-only`
 * into the browser bundle — the same class of break lib/activityHeatmap.ts was created to
 * fix, and one `tsc` does not catch.
 */

export const AI_MODEL = "gpt-4.1";

/** USD per million tokens. The usage panel multiplies at read time, which is why ai_usage
 *  stores TOKENS and not baht: a stored baht figure becomes a historical fiction the moment
 *  a tier changes or a price moves. */
export const MODEL_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  "gpt-4.1": { inputPerM: 2.0, outputPerM: 8.0 },
  // Roughly five times cheaper and worth measuring against 4.1 before committing —
  // extraction into a fixed schema is near the easiest thing a model does.
  "gpt-4.1-mini": { inputPerM: 0.4, outputPerM: 1.6 },
  "gpt-4o": { inputPerM: 2.5, outputPerM: 10.0 },
};

/** OpenAI bills in dollars and this company thinks in baht, so the usage panel converts —
 *  and SAYS SO on screen, because this is a hand-maintained estimate, not a rate anyone
 *  fetched. Nothing depends on it being exact; it only ever renders an "≈". */
export const AI_USD_THB = 36;
