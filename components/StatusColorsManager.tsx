"use client";

/* ตั้งค่า → สีสถานะ — which colour each status, stage and grade wears in the
   ทรัพย์ and Lead grids.

   COLOUR ONLY. You cannot add, rename or delete a value here, and that is not
   an oversight: these five lists are structural. `pipeline_stage` is read by
   lib/pipeline, the funnel counts and the scoreboard; deleting "Nego" from a
   settings screen would be a data migration wearing a checkbox. Adding and
   renaming live in ข้อมูลอ้างอิงกลาง for the lists where that is safe.

   The swatches come from lib/tables/palette — a closed set, not a picker. A
   free hue chosen against the white canvas can vanish or glare in dark mode,
   and the person choosing it is not the person reading the grid at 8pm. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { PALETTE } from "@/lib/tables/palette";
import { setLookupColor, setSlaDays } from "@/lib/mutations/reference";

export interface ColorableValue {
  name: string;
  color: string | null;
  /** Follow-up window in days. null = no SLA on this grade. */
  slaDays: number | null;
}

export interface ColorableList {
  table: string;
  label: string;
  /** Grade lists carry a follow-up window; status lists do not. */
  hasSla: boolean;
  values: ColorableValue[];
}

export function StatusColorsManager({ lists }: { lists: ColorableList[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-text-muted">
        สีที่เลือกที่นี่คือสีพื้นของช่องในตาราง ทรัพย์ และ Lead · เว้นว่างได้ ช่องนั้นจะไม่มีสีพื้น
        <br />
        <b className="font-medium">SLA</b> = ไม่ติดต่อเกินกี่วันถึงจะขึ้นสีแดง ·
        มีเฉพาะ &quot;เกรด&quot; · <b className="font-medium">เว้นว่าง = ไม่มี SLA สำหรับเกรดนั้น</b>
      </p>
      {lists.map((l) => (
        <ListCard key={l.table} list={l} />
      ))}
    </div>
  );
}

function ListCard({ list }: { list: ColorableList }) {
  return (
    <Card>
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-h3">{list.label}</span>
        <span className="num ml-2 text-label text-text-subtle">{list.values.length}</span>
      </div>
      <CardContent className="p-0">
        {list.values.map((v) => (
          <Row key={v.name} table={list.table} value={v} hasSla={list.hasSla} />
        ))}
      </CardContent>
    </Card>
  );
}

function Row({ table, value, hasSla }: { table: string; value: ColorableValue; hasSla: boolean }) {
  const router = useRouter();
  const [saving, startSave] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  /* Optimistic: a swatch has to fill the moment it is clicked. The server
     result only ever REVERTS it, so a refused write cannot leave the screen
     claiming a colour the database does not hold. */
  const [current, setCurrent] = React.useState<string | null>(value.color);

  const pick = (token: string | null) => {
    const prev = current;
    setCurrent(token);
    setError(null);
    startSave(async () => {
      const res = await setLookupColor(table, value.name, token);
      if (!res.ok) {
        setCurrent(prev);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const swatchFor = (token: string | null) =>
    token ? PALETTE.find((p) => p.token === token)?.cssVar : undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5 last:border-0">
      {/* The value, shown wearing its own colour — the point is to preview the
          cell, so this is the same wash the grid paints. */}
      <span
        style={swatchFor(current) ? ({ "--wash-hue": swatchFor(current) } as React.CSSProperties) : undefined}
        className={cn(
          "min-w-[9rem] rounded border border-border px-2 py-1 text-small font-medium",
          current ? "cell-wash" : "bg-surface",
        )}
      >
        {value.name}
      </span>

      <div className="flex flex-wrap items-center gap-1">
        {PALETTE.map((p) => (
          <button
            key={p.token}
            onClick={() => pick(p.token)}
            disabled={saving}
            title={p.label}
            aria-label={p.label}
            aria-pressed={current === p.token}
            className={cn(
              "grid size-6 place-items-center rounded-full border-2 transition-transform",
              current === p.token ? "border-text scale-110" : "border-transparent hover:scale-110",
              saving && "opacity-50",
            )}
            style={{ backgroundColor: p.cssVar }}
          >
            {/* Dark ink, not white: every swatch is a pastel now, so a white
                tick disappears into it. */}
            {current === p.token && <Check size={12} strokeWidth={3} className="text-text" />}
          </button>
        ))}
        <button
          onClick={() => pick(null)}
          disabled={saving}
          title="ไม่มีสี"
          aria-label="ไม่มีสี"
          aria-pressed={current === null}
          className={cn(
            "grid size-6 place-items-center rounded-full border-2 border-dashed text-label transition-transform",
            current === null ? "border-text scale-110" : "border-border-strong hover:scale-110",
            saving && "opacity-50",
          )}
        >
          –
        </button>
      </div>

      {hasSla && <SlaBox table={table} name={value.name} initial={value.slaDays} />}

      {saving && <LoaderCircle size={13} className="animate-spin text-text-subtle" />}
      {error && <span className="text-small text-red">{error}</span>}
    </div>
  );
}

/** The follow-up window for one grade.

    Committed on blur or Enter, not on every keystroke — typing "15" would
    otherwise save "1" on the way past, and a 1-day SLA briefly turns the whole
    grade red for anyone looking at the grid at that moment.

    An EMPTY box is a real value, not a skipped save: it clears the window and
    switches the grade's SLA off. That is the only way to turn one off, so it
    has to survive a round trip rather than being treated as "no change". */
function SlaBox({ table, name, initial }: { table: string; name: string; initial: number | null }) {
  const router = useRouter();
  const [saving, startSave] = React.useTransition();
  const [text, setText] = React.useState(initial == null ? "" : String(initial));
  const [error, setError] = React.useState<string | null>(null);
  const committed = React.useRef(initial == null ? "" : String(initial));

  const commit = () => {
    const raw = text.trim();
    if (raw === committed.current) return;
    const days = raw === "" ? null : Number(raw);
    if (days !== null && !Number.isFinite(days)) {
      setText(committed.current);
      return;
    }
    setError(null);
    startSave(async () => {
      const res = await setSlaDays(table, name, days);
      if (!res.ok) {
        setText(committed.current);
        setError(res.error);
        return;
      }
      committed.current = raw;
      router.refresh();
    });
  };

  const off = text.trim() === "";
  return (
    <span className="ml-auto flex items-center gap-1.5">
      <span className="text-label text-text-subtle">SLA</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        disabled={saving}
        inputMode="numeric"
        placeholder="—"
        aria-label={`SLA ${name} (วัน)`}
        className={cn(
          "num h-7 w-14 rounded-md border border-border-strong bg-surface px-2 text-center text-small outline-none",
          "focus:border-accent focus:ring-2 focus:ring-ring/30",
          saving && "opacity-50",
        )}
      />
      <span className={cn("text-label", off ? "text-text-subtle" : "text-text-muted")}>
        {off ? "ไม่มี SLA" : "วัน"}
      </span>
      {error && <span className="text-small text-red">{error}</span>}
    </span>
  );
}
