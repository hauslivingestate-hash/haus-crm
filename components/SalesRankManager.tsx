"use client";

import * as React from "react";
import { Plus, Medal, ChevronUp, ChevronDown } from "lucide-react";
import { useProbation } from "@/components/ProbationProvider";
import { WINDOW_LABEL, type CriterionWindow, type SalesRank } from "@/lib/probation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { cn } from "@/lib/cn";

// Settings ▸ Rank เซลล์ใหม่ (gated masterdata.govern — CEO). The probation ladder: ordered
// ranks, each with criteria = action type × target × window (สะสมรวม / ต่อเดือน). Criteria
// count the SAME action entity as ประเภทกิจกรรม / KPI templates. AUTO-PROMOTE: rank is
// derived from the activity log, so editing here re-ranks the เซลล์ใหม่ board instantly.
//
// Phase 8 groundwork: the ladder is persisted (`probation_rank` / `rank_criterion`). It is
// edited as a draft and committed with บันทึก — saving per keystroke would write a
// half-built rank, and a criterion with no activity type fails its FK.

export function SalesRankManager({
  actionTypes = [],
}: {
  /** From `action_type`, NOT the ACTION_GROUPS seed — that list is missing three rows that
   *  exist in the table, and `rank_criterion.activity_type` is an FK to it. */
  actionTypes?: { name: string; group: string }[];
}) {
  const { ranks, setRanks, dirty, save, reset, busy, error } = useProbation();
  const [seq, setSeq] = React.useState(1);

  const actionOptions = React.useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const a of actionTypes) {
      const arr = groups.get(a.group) ?? [];
      arr.push(a.name);
      groups.set(a.group, arr);
    }
    return [...groups].map(([group, items]) => ({ group, items }));
  }, [actionTypes]);

  const patchRank = (id: string, p: Partial<SalesRank>) =>
    setRanks((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const patchCriterion = (rankId: string, critId: string, p: Partial<SalesRank["criteria"][number]>) =>
    setRanks((rs) =>
      rs.map((r) =>
        r.id === rankId
          ? { ...r, criteria: r.criteria.map((c) => (c.id === critId ? { ...c, ...p } : c)) }
          : r
      )
    );

  const addCriterion = (rankId: string) => {
    const id = `c_new_${seq}`;
    setSeq((n) => n + 1);
    setRanks((rs) =>
      rs.map((r) =>
        r.id === rankId
          ? { ...r, criteria: [...r.criteria, { id, activityType: "Call", target: 10, window: "total" as CriterionWindow }] }
          : r
      )
    );
  };

  const deleteCriterion = (rankId: string, critId: string) =>
    setRanks((rs) =>
      rs.map((r) => (r.id === rankId ? { ...r, criteria: r.criteria.filter((c) => c.id !== critId) } : r))
    );

  const addRank = () => {
    const id = `r_new_${seq}`;
    setSeq((n) => n + 1);
    setRanks((rs) => [...rs, { id, name: `Rank ${rs.length + 1}`, criteria: [] }]);
  };

  const deleteRank = (id: string) => setRanks((rs) => rs.filter((r) => r.id !== id));

  const move = (index: number, dir: -1 | 1) =>
    setRanks((rs) => {
      const to = index + dir;
      if (to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {ranks.map((rank, i) => (
        <Card key={rank.id}>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            {/* Order + reorder — the ladder is sequential (Rank 1 ต้องผ่านก่อน Rank 2) */}
            <span className="size-7 rounded-full bg-accent-wash text-accent grid place-items-center num text-small font-semibold shrink-0">
              {i + 1}
            </span>
            <Input
              value={rank.name}
              onChange={(e) => patchRank(rank.id, { name: e.target.value })}
              className="h-8 font-semibold max-w-[200px]"
              aria-label="ชื่อ Rank"
            />
            {i === ranks.length - 1 && (
              <span className="text-label text-green shrink-0">ผ่าน Rank นี้ = ผ่านโปรเบชั่น</span>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <ReorderBtn dir={-1} disabled={i === 0} onClick={() => move(i, -1)} />
              <ReorderBtn dir={1} disabled={i === ranks.length - 1} onClick={() => move(i, 1)} />
              <ConfirmDelete
                onDelete={() => deleteRank(rank.id)}
                label="ลบ Rank"
                confirmLabel={`ลบ “${rank.name}”?`}
                warning="เซลล์ใหม่ที่อยู่ Rank นี้จะถูกจัดอันดับใหม่จากเกณฑ์ที่เหลือ"
              />
            </div>
          </div>

          {/* Criteria — action × target × window */}
          {rank.criteria.length === 0 ? (
            <div className="px-4 py-4 text-center text-small text-text-subtle">
              ยังไม่มีเกณฑ์ — Rank ที่ไม่มีเกณฑ์จะถือว่าผ่านทันที
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rank.criteria.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
                  <Select
                    value={c.activityType}
                    onChange={(e) => patchCriterion(rank.id, c.id, { activityType: e.target.value })}
                    aria-label="ประเภทกิจกรรม"
                    className="w-40"
                  >
                    {actionOptions.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  <span className="text-small text-text-subtle">≥</span>
                  <Input
                    value={String(c.target)}
                    onChange={(e) =>
                      patchCriterion(rank.id, c.id, { target: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })
                    }
                    inputMode="numeric"
                    className="h-8 w-16 num text-center"
                    aria-label="เป้าหมาย"
                  />
                  <span className="text-small text-text-subtle">ครั้ง</span>
                  <Select
                    value={c.window}
                    onChange={(e) => patchCriterion(rank.id, c.id, { window: e.target.value as CriterionWindow })}
                    aria-label="ช่วงการนับ"
                    className="w-28"
                  >
                    {(Object.keys(WINDOW_LABEL) as CriterionWindow[]).map((w) => (
                      <option key={w} value={w}>{WINDOW_LABEL[w]}</option>
                    ))}
                  </Select>
                  <div className="ml-auto">
                    <ConfirmDelete
                      onDelete={() => deleteCriterion(rank.id, c.id)}
                      label="ลบเกณฑ์"
                      confirmLabel={`ลบเกณฑ์ ${c.activityType}?`}
                      warning="ตัดเกณฑ์นี้ออกจาก Rank — อันดับของเซลล์ใหม่จะคำนวณใหม่ทันที"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => addCriterion(rank.id)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors"
          >
            <Plus size={15} strokeWidth={2} /> เพิ่มเกณฑ์
          </button>
        </Card>
      ))}

      <button
        onClick={addRank}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-3 text-small font-medium text-text-muted hover:text-accent hover:border-accent transition-colors"
      >
        <Medal size={15} strokeWidth={1.75} /> เพิ่ม Rank
      </button>

      {error && <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>}

      {/* Commit bar. The ladder is a draft until this is pressed — the เซลล์ใหม่ board keeps
          ranking against the saved version in the meantime. */}
      <div className="sticky bottom-0 flex items-center gap-2 py-3 bg-background border-t border-border">
        <Button size="sm" onClick={() => void save()} disabled={!dirty || busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกเกณฑ์"}
        </Button>
        <Button variant="secondary" size="sm" onClick={reset} disabled={!dirty || busy}>
          ยกเลิกการแก้ไข
        </Button>
        <span className="text-label text-text-subtle ml-1">
          {dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกแล้ว"}
        </span>
      </div>
    </div>
  );
}

function ReorderBtn({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  const Icon = dir === -1 ? ChevronUp : ChevronDown;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "เลื่อนขึ้น" : "เลื่อนลง"}
      className={cn(
        "size-7 grid place-items-center rounded-md border border-border text-text-muted transition-colors",
        disabled ? "opacity-40" : "hover:bg-surface-hover"
      )}
    >
      <Icon size={14} strokeWidth={2} />
    </button>
  );
}

// Native select styled to match the Input primitive (same as ChecklistTemplatesManager).
function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 rounded-md border border-border-strong bg-surface px-2 text-body text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring shrink-0",
        className
      )}
      {...props}
    />
  );
}
