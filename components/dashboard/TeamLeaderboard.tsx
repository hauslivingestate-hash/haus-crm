import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { RevenueBasisToggle } from "@/components/dashboard/RevenueBasisToggle";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import type { AgentRevenue } from "@/lib/teamDashboard";
import type { RevenueBasis } from "@/lib/deals";

/* รายได้ตามเอเจนต์ — the team's number, ranked by who signed it.
 *
 * The HAUS V2 overview's leaderboard, rebuilt on this app's data and tokens: a rank, a
 * face, a bar against the leader, and the figure. Ben chose it over the five-column
 * รายคน table, 2026-09-17, so that it fits the 1/3 column beside the trend chart.
 *
 * ⚠️ WHAT THIS CARD NO LONGER SHOWS. The table it replaced carried ดีล, ส่วนแบ่งทีม and
 * เป้าตัวเอง. Those figures are not on this tab any more — they are on each person's own
 * record (/team/[code]), which every row links to. That was a deliberate trade for the
 * width, not an oversight: if any of the three turns out to be something a leader reads
 * weekly, it belongs back here as a second line rather than as a column.
 *
 * ── THE BAR IS RELATIVE TO THE LEADER, NOT TO A TARGET ──────────────────────────
 * Same as HAUS V2. A bar against each person's own target would be a different card —
 * it would rank nobody, and two people at 90% would draw identically while signing very
 * different amounts. This one answers "who brought in the most", and the length is the
 * share of the top figure.
 *
 * ── `dot-amber`, NEVER `amber` ──────────────────────────────────────────────────
 * The leader's bar and avatar ring use `--dot-amber` (#f59e0b). `--amber-500` is the
 * TEXT-SAFE amber — #946200 in light mode, darkened until amber type passes contrast on
 * white — and painting a bar with it produces brown. The rule holds for every hue in the
 * palette: `text-*` for type, `bg-dot-*` for a mark. See the block above the dots in
 * app/globals.css.
 *
 * ── ITS OWN CLOSE ⇄ WIN TOGGLE ──────────────────────────────────────────────────
 * Ben, 2026-09-17. The card already HONOURED `?basis=` — it just gave no way to change it,
 * so the numbers here moved when you flipped a toggle on another card and nothing on this
 * one said why. Every revenue surface carries the control, the same rule the trend card
 * and เป้ารายได้ already follow: all three write the same URL param, so flipping any one
 * flips all three and there is no second piece of state that can drift.
 *
 * ── EVERYONE IS LISTED, INCLUDING ZEROS ─────────────────────────────────────────
 * Inherited from the table and worth keeping. A member with nothing signed in the window
 * is the fact a leader most needs; hiding them would make the card a list of the people
 * who were already fine.
 */
export function TeamLeaderboard({
  agents,
  rangeLabel,
  basis,
}: {
  agents: AgentRevenue[];
  rangeLabel: string;
  basis: RevenueBasis;
}) {
  // `agents` arrives best-first from the server. The leader sets the scale; a team that
  // has signed nothing yet would divide by zero, so the floor is 1.
  const max = Math.max(1, ...agents.map((a) => a.actual));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex min-w-0 items-baseline gap-2">
          <CardTitle>รายได้ตามเอเจนต์</CardTitle>
          <span className="num truncate text-small text-text-subtle">{rangeLabel}</span>
        </div>
        <RevenueBasisToggle active={basis} />
      </CardHeader>
      <CardContent className="flex-1">
        {agents.length === 0 ? (
          <p className="py-6 text-center text-small text-text-subtle">
            ยังไม่มีสมาชิกในทีม — ใส่คนเข้าทีมได้ที่ ตั้งค่า ▸ ทีม
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {agents.map((a, i) => {
              // Only a real leader wears the ring. With nothing signed all round, first
              // place is alphabetical and crowning it would be an award for a tie at zero.
              const isLeader = i === 0 && a.actual > 0;
              return (
                <li key={a.code}>
                  <Link
                    href={`/team/${encodeURIComponent(a.code)}`}
                    className="grid grid-cols-[18px_28px_1fr_auto] items-center gap-2.5 text-text transition-colors hover:text-accent-ink"
                  >
                    <span className="num text-label text-text-subtle">{String(i + 1).padStart(2, "0")}</span>
                    <Avatar
                      name={a.nickname}
                      src={a.avatarUrl}
                      tone="neutral"
                      className={cn("size-7 text-[10px]", isLeader && "ring-2 ring-dot-amber ring-offset-1 ring-offset-surface")}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-small font-medium">{a.nickname}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className={cn("block h-full rounded-full", isLeader ? "bg-dot-amber" : "bg-accent")}
                          // A 2% floor so a small non-zero amount reads as a mark rather
                          // than as nothing — the same rule the target bar uses.
                          style={{ width: `${a.actual > 0 ? Math.max(2, (a.actual / max) * 100) : 0}%` }}
                        />
                      </span>
                    </span>
                    <span
                      className={cn(
                        "num text-right text-small font-semibold",
                        a.actual > 0 ? "text-text" : "text-text-subtle"
                      )}
                    >
                      {formatBaht(a.actual)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
