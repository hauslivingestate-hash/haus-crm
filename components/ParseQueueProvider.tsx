"use client";

/* The client half of the AI parse queue.
 *
 * Mounted in the app shell for the same reason MasterDataProvider is: it is ambient state
 * read from several places (the tray, the paste sheet, the box inside the lead form, the
 * review hosts), and living above the route is what lets a parse survive moving between
 * /leads and /listings.
 *
 * It deliberately owns no parse results of its own — the ai_job row is the truth and this
 * just mirrors it. That is what makes a refresh, a locked phone or a switch to LINE
 * mid-parse a non-event, which is the whole reason the queue exists.
 */

import * as React from "react";
import { closeJob, enqueueParse, listJobs, retryJob } from "@/lib/ai/jobs";
import { useRbac } from "@/components/RbacProvider";
import {
  PARSE_PERMISSION,
  type ParseJob,
  type ParseKind,
  type ParseOutcome,
} from "@/lib/ai/types";

/** How often to ask while something is in flight. A parse takes ~4s, so this costs two or
 *  three indexed queries per paste. Polling beats a stream here: serverless functions, and
 *  an open connection would be held for minutes to save a query costing milliseconds. */
const POLL_MS = 2000;

interface ParseQueueValue {
  jobs: ParseJob[];
  /** Anything still being read — drives the tray's spinner. */
  working: number;
  /** Finished and waiting for review. */
  ready: ParseJob[];
  failed: number;
  /** True when this account may queue at least one kind — the tray hides entirely without it. */
  enabled: boolean;
  canParse: (kind: ParseKind) => boolean;
  /** Returns the job id, or throws with a Thai message the caller shows. */
  enqueue: (kind: ParseKind, rawText: string) => Promise<number>;
  byId: (id: number | null) => ParseJob | undefined;
  /** Hand a finished draft to whichever form reviews that kind. */
  open: (job: ParseJob) => void;
  opened: ParseJob | null;
  /** Stop showing it WITHOUT consuming — closing the review form must not bin a draft that
   *  may still be wanted. It stays in the tray. */
  clearOpened: () => void;
  /** Done with it: `saved` if it became a record, `discarded` if binned. */
  close: (id: number, outcome: ParseOutcome) => Promise<void>;
  retry: (id: number) => Promise<void>;
  refresh: () => void;
}

const Ctx = React.createContext<ParseQueueValue | null>(null);

export function ParseQueueProvider({ children }: { children: React.ReactNode }) {
  const { can } = useRbac();
  const [jobs, setJobs] = React.useState<ParseJob[]>([]);
  const [opened, setOpened] = React.useState<ParseJob | null>(null);
  // Guards against a slow poll landing after a newer one and rewinding state.
  const seq = React.useRef(0);

  /* Two gates, both required.
     The parse permission says the budget may be spent; the CREATE permission says there is
     somewhere for the draft to land. Without the second, a person could queue a parse, watch
     it succeed, and find no form to review it into — the tray would be a dead end with a
     bill attached. The database enforces only the first (ai_job's INSERT policy); this is
     the UI refusing to offer a button that leads nowhere. */
  const canParse = React.useCallback(
    (kind: ParseKind) => {
      if (can("roles.manage")) return true;
      const create = kind === "lead" ? "leads.create" : "listings.create";
      return can(PARSE_PERMISSION[kind]) && can(create);
    },
    [can]
  );
  const enabled = canParse("lead") || canParse("listing");

  const refresh = React.useCallback(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    listJobs()
      .then((rows) => {
        if (mine === seq.current) setJobs(rows);
      })
      .catch(() => {
        /* offline or signed out — the next tick retries */
      });
  }, [enabled]);

  const working = jobs.filter((j) => j.status === "queued" || j.status === "running").length;

  // Refresh on mount and whenever the tab comes back: the case this feature exists for is
  // someone returning from LINE with the parse already finished.
  React.useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  // Poll ONLY while something is unfinished. Otherwise the app is idle and so is this.
  React.useEffect(() => {
    if (working === 0) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [working, refresh]);

  // Keep an open draft in step with the server: a job that was still running when it was
  // opened should fill in, not sit stale.
  React.useEffect(() => {
    if (!opened) return;
    const fresh = jobs.find((j) => j.id === opened.id);
    if (fresh && fresh !== opened) setOpened(fresh);
  }, [jobs, opened]);

  const enqueue = React.useCallback(async (kind: ParseKind, rawText: string) => {
    const res = await enqueueParse(kind, rawText);
    if (!res.ok) throw new Error(res.error);
    setJobs((p) => [res.job, ...p.filter((j) => j.id !== res.job.id)]);
    return res.job.id;
  }, []);

  const close = React.useCallback(async (id: number, outcome: ParseOutcome) => {
    // Optimistic: the row is gone from the tray before the round trip, because the tray is
    // the one surface where a lingering item reads as "it didn't work".
    setJobs((p) => p.filter((j) => j.id !== id));
    setOpened((p) => (p?.id === id ? null : p));
    await closeJob(id, outcome);
  }, []);

  // Stable identity: AiPasteBox watches its own job in an effect that depends on this, and
  // an arrow recreated on every jobs change would re-run it on every poll tick.
  const openJob = React.useCallback((job: ParseJob) => setOpened(job), []);

  const retry = React.useCallback(
    async (id: number) => {
      setJobs((p) => p.map((j) => (j.id === id ? { ...j, status: "queued", error: null } : j)));
      await retryJob(id);
      refresh();
    },
    [refresh]
  );

  const value = React.useMemo<ParseQueueValue>(
    () => ({
      jobs,
      working,
      ready: jobs.filter((j) => j.status === "done"),
      failed: jobs.filter((j) => j.status === "error").length,
      enabled,
      canParse,
      enqueue,
      byId: (id) => (id == null ? undefined : jobs.find((j) => j.id === id)),
      open: openJob,
      opened,
      clearOpened: () => setOpened(null),
      close,
      retry,
      refresh,
    }),
    [jobs, working, enabled, canParse, enqueue, openJob, opened, close, retry, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParseQueue(): ParseQueueValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error("useParseQueue must be used inside <ParseQueueProvider> — see app/(app)/layout.tsx");
  }
  return ctx;
}

/** The draft this surface should review, or null. Each host asks for its own kind, so the
 *  listing form can never pick up a lead draft. */
export function useOpenedDraft(kind: ParseKind): ParseJob | null {
  const { opened } = useParseQueue();
  return opened && opened.kind === kind && opened.status === "done" ? opened : null;
}
