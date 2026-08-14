"use client";

import * as React from "react";
import { Plus, Users, Crown, Check } from "lucide-react";
import { useRbac } from "@/components/RbacProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Avatar } from "@/components/ui/Avatar";
import { employeeFullName, type Employee } from "@/lib/team";
import { cn } from "@/lib/cn";

// Sales-team manager (Settings ▸ ทีม, gated teams.manage). Create teams, set a leader, a
// monthly revenue goal, and assign members. Shares the org store (RbacProvider) so edits
// live-update the roster scoping + everything else. Design-first: in-memory, not persisted.
// `employees` is the real roster (main_1_hr), passed down from the settings page — the
// seeded array this used to read is gone. Teams themselves are still in-memory: the
// `teams` table is empty and nobody holds `sales_leader`, so there is nothing to persist
// until the CEO names leads.
export function TeamsManager({ employees = [] }: { employees?: Employee[] }) {
  const { teams, setTeams } = useRbac();
  const [selectedId, setSelectedId] = React.useState<string>(teams[0]?.id ?? "");
  const [seq, setSeq] = React.useState(1);

  const selected = teams.find((t) => t.id === selectedId) ?? teams[0];

  // Selling roster = who can be on a sales team (active sales + the player-coach CEO).
  const candidates = employees.filter(
    (e) => e.status === "active" && (e.department === "sales" || e.department === "management")
  );

  const patch = (id: string, p: Partial<(typeof teams)[number]>) =>
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const createTeam = () => {
    const id = `team_new_${seq}`;
    setSeq((n) => n + 1);
    setTeams((ts) => [...ts, { id, name: "ทีมใหม่", leaderId: "", memberIds: [], revenueGoal: 0 }]);
    setSelectedId(id);
  };

  const deleteTeam = (id: string) => {
    setTeams((ts) => ts.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(teams.find((t) => t.id !== id)?.id ?? "");
  };

  // Toggle membership. One team per employee → adding here removes them from any other team.
  // Removing the leader clears/reassigns leadership.
  const toggleMember = (teamId: string, empId: string) =>
    setTeams((ts) => {
      const inThis = ts.find((t) => t.id === teamId)?.memberIds.includes(empId);
      return ts.map((t) => {
        if (t.id === teamId) {
          const memberIds = inThis ? t.memberIds.filter((m) => m !== empId) : [...t.memberIds, empId];
          const leaderId = inThis && t.leaderId === empId ? (memberIds[0] ?? "") : t.leaderId;
          return { ...t, memberIds, leaderId };
        }
        if (!inThis && t.memberIds.includes(empId)) {
          const memberIds = t.memberIds.filter((m) => m !== empId);
          const leaderId = t.leaderId === empId ? (memberIds[0] ?? "") : t.leaderId;
          return { ...t, memberIds, leaderId };
        }
        return t;
      });
    });

  // Set leader — ensure they're a member (and pull them off any other team).
  const setLeader = (teamId: string, empId: string) =>
    setTeams((ts) =>
      ts.map((t) => {
        if (t.id === teamId)
          return { ...t, leaderId: empId, memberIds: t.memberIds.includes(empId) ? t.memberIds : [...t.memberIds, empId] };
        if (t.memberIds.includes(empId)) {
          const memberIds = t.memberIds.filter((m) => m !== empId);
          return { ...t, memberIds, leaderId: t.leaderId === empId ? (memberIds[0] ?? "") : t.leaderId };
        }
        return t;
      })
    );

  if (!selected) {
    return (
      <Card className="p-6 text-center text-small text-text-subtle">
        ยังไม่มีทีม —{" "}
        <button onClick={createTeam} className="text-accent font-medium hover:underline">สร้างทีมแรก</button>
      </Card>
    );
  }

  const otherTeamOf = (empId: string) =>
    teams.find((t) => t.id !== selected.id && t.memberIds.includes(empId));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-4 items-start">
      {/* Team list */}
      <Card className="overflow-hidden">
        <div className="px-3 h-11 flex items-center justify-between border-b border-border">
          <span className="text-label uppercase text-text-subtle">ทีม ({teams.length})</span>
        </div>
        <ul className="divide-y divide-border">
          {teams.map((t) => {
            const leader = employees.find((e) => e.code === t.leaderId);
            return (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-colors",
                    t.id === selected.id ? "bg-accent-wash" : "hover:bg-surface-hover"
                  )}
                >
                  <div className="text-body font-medium truncate">{t.name}</div>
                  <div className="text-label text-text-subtle truncate">
                    <span className="num">{t.memberIds.length}</span> คน
                    {leader ? <> · หัวหน้า {leader.nickname}</> : " · ยังไม่มีหัวหน้า"}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          onClick={createTeam}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors"
        >
          <Plus size={15} strokeWidth={2} /> สร้างทีม
        </button>
      </Card>

      {/* Team editor */}
      <div className="flex flex-col gap-4 min-w-0">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent-wash text-accent grid place-items-center shrink-0">
              <Users size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <Input
                value={selected.name}
                onChange={(e) => patch(selected.id, { name: e.target.value })}
                className="font-semibold h-8 max-w-xs"
                aria-label="ชื่อทีม"
              />
              <label className="flex items-center gap-2 text-small text-text-muted">
                เป้ารายได้ต่อเดือน (฿)
                <Input
                  value={selected.revenueGoal ? String(selected.revenueGoal) : ""}
                  onChange={(e) => patch(selected.id, { revenueGoal: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                  inputMode="numeric"
                  className="h-8 w-40 num text-right"
                  placeholder="0"
                />
              </label>
            </div>
            <ConfirmDelete
              onDelete={() => deleteTeam(selected.id)}
              label="ลบทีม"
              confirmLabel={`ลบ “${selected.name}”?`}
              warning={
                selected.memberIds.length > 0
                  ? `สมาชิก ${selected.memberIds.length} คนจะไม่มีทีมสังกัด และเป้ารายได้/การ scope ของทีมนี้จะหายไป`
                  : "ทีมนี้ไม่มีสมาชิก — ลบได้อย่างปลอดภัย"
              }
            />
          </div>
        </Card>

        {/* Members + leader */}
        <Card>
          <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
            <Users size={15} strokeWidth={1.75} className="text-text-muted" />
            <span className="text-h3">สมาชิกทีม</span>
            <span className="num text-label text-text-subtle">({selected.memberIds.length})</span>
            <span className="ml-auto text-label text-text-subtle inline-flex items-center gap-1">
              <Crown size={12} strokeWidth={2} className="text-amber" /> = หัวหน้าทีม
            </span>
          </div>
          <ul className="divide-y divide-border">
            {candidates.map((e) => {
              const inTeam = selected.memberIds.includes(e.code);
              const isLeader = selected.leaderId === e.code;
              const other = otherTeamOf(e.code);
              return (
                <li key={e.code} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={e.nickname} tone="crimson" />
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium inline-flex items-center gap-1.5">
                      {e.nickname}
                      {isLeader && <Crown size={13} strokeWidth={2} className="text-amber" />}
                    </div>
                    <div className="text-label text-text-subtle truncate">
                      {employeeFullName(e)}
                      {!inTeam && other && <span className="text-text-subtle"> · อยู่{other.name}</span>}
                    </div>
                  </div>
                  {inTeam && (
                    <button
                      onClick={() => setLeader(selected.id, e.code)}
                      disabled={isLeader}
                      className={cn(
                        "text-label font-medium rounded-md px-2.5 h-8 border transition-colors inline-flex items-center gap-1",
                        isLeader ? "border-amber/40 bg-amber-bg text-amber cursor-default" : "border-border-strong text-text-muted hover:bg-surface-2"
                      )}
                    >
                      <Crown size={12} strokeWidth={2} /> {isLeader ? "หัวหน้า" : "ตั้งเป็นหัวหน้า"}
                    </button>
                  )}
                  <button
                    onClick={() => toggleMember(selected.id, e.code)}
                    className={cn(
                      "text-small font-medium rounded-md px-3 h-8 border transition-colors inline-flex items-center gap-1",
                      inTeam ? "bg-text text-background border-text" : "border-border-strong text-text-muted hover:bg-surface-2"
                    )}
                  >
                    {inTeam ? <><Check size={13} strokeWidth={2.5} /> ในทีม</> : "เพิ่ม"}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
