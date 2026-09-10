/* Follow-up SLA — a record goes overdue when days since last contact exceed
   the window set on its GRADE.

   Productized from the team's own rule, which already existed as conditional
   formatting on the Buyer Focus tab of the listing spreadsheet: grade A red
   after 7 days without contact, grade B after 15. The numbers were always
   theirs; they just lived in a spreadsheet formula where nothing could read
   them. They now live on the grade rows (`potential.sla_days`,
   `listing_potential.sla_days`) and are edited in ตั้งค่า → สีสถานะ & SLA.

   A BLANK WINDOW MEANS NO SLA (Ben, 2026-09-06). Klaichan's version falls back
   to a 30-day default when a grade carries none, which means no grade can ever
   be switched off — an administrative grade like "Agent", or an unassessed
   "New Lead", would nag for ever about a deadline nobody agreed to. Here the
   absence of a number is a decision, and it is the default: a grade nobody has
   configured stays silent.

   NOTHING IS STORED PER RECORD. Due is computed from last-follow plus the
   grade's window every time it is asked for. A stored `next_follow` column
   would be a second source of truth able to disagree with the badge on its own
   row, which is why Klaichan deleted theirs.

   Pure, and the window map is passed in rather than read from a global — that
   is what makes the rule testable and what lets the same function serve a
   server render and a client grid. */

/** grade name → window in days. A missing key, or an explicit null, is OFF. */
export type SlaWindows = Record<string, number | null>;

export interface SlaState {
  /** Days since last contact. null = never contacted. */
  days: number | null;
  /** The grade's window. null = this grade has no SLA. */
  window: number | null;
  /** False whenever the grade has no window — an off grade is never overdue. */
  overdue: boolean;
  /** Days past the window; 0 when within it or when there is no window. */
  over: number;
}

export const NO_SLA: SlaState = { days: null, window: null, overdue: false, over: 0 };

/** Whole days between a date and today, in local terms. null for a missing or
    unparseable date, so a malformed value reads as "never contacted" rather
    than as day zero — the 1899 dates in main_7_last_match are what happens
    when a blank is silently treated as a number. */
export function daysSince(date: string | null | undefined, today: Date = new Date()): number | null {
  if (!date) return null;
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.floor((a - b) / 86_400_000);
}

/** The SLA state for one record.

    NEVER CONTACTED COUNTS AS OVERDUE, but only when the grade has a window. A
    graded lead nobody has ever called is the most overdue thing in the list —
    treating a missing date as "fine" is how those rows stay invisible. With no
    window, it stays silent like everything else on that grade. */
export function slaFor(
  windows: SlaWindows | undefined,
  grade: string | null | undefined,
  lastContact: string | null | undefined,
  today?: Date,
): SlaState {
  const window = grade && windows ? windows[grade] ?? null : null;
  if (window == null || window <= 0) return NO_SLA;

  const days = daysSince(lastContact, today);
  if (days === null) return { days: null, window, overdue: true, over: 0 };
  return { days, window, overdue: days > window, over: Math.max(0, days - window) };
}

/** How far through its window a record is, for the cell colour.

      ok       comfortably inside
      warn     inside, but past 70% of the window — the nudge before it bites
      bad      past the window, or never contacted
      null     no SLA on this grade; the cell stays unpainted

    The warn band is proportional rather than a fixed number of days, so a
    3-day window and a 30-day window both get a warning with time left to act
    on it. */
export function slaTone(state: SlaState): "ok" | "warn" | "bad" | null {
  if (state.window == null) return null;
  if (state.overdue) return "bad";
  if (state.days == null) return "bad";
  return state.days >= state.window * 0.7 ? "warn" : "ok";
}
