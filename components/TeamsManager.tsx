"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Crown, Check, ShieldAlert } from "lucide-react";
import { useRbac } from "@/components/RbacProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Avatar } from "@/components/ui/Avatar";
import { employeeFullName, type Employee } from "@/lib/team";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  setEmployeeTeam,
  setTeamLeader,
} from "@/lib/mutations/teams";
import { cn } from "@/lib/cn";

// ตั้งค่า → ทีมขาย (gated teams.manage). Real `teams` rows and `main_1_hr.team_id`.
//
// Ben, 2026-08-15: build the mechanism, leave it empty — the CEO names the teams.
//
// This is not cosmetic. `visible_employee_codes()` derives "team" scope from team_id, and
// with `teams` empty it returns just the caller for everyone, CEO included. That is why the
// activity column on /team shows "—" for colleagues, why nobody can set a target for anyone
// else, and why a team dashboard cannot exist yet. One team with one leader turns all of
// that on.

export interface TeamRow {
  id: string;
  name: string;
  leaderCode: string | null;
  revenueGoal: number | null;
  memberCodes: string[];
}

export function TeamsManager({
  teams,
  employees = [],
}: {
  teams: TeamRow[];
  employees?: Employee[];
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canManage = can("teams.manage") || can("roles.manage");

  const [selectedId, setSelectedId] = React.useState<string>(teams[0]?.id ?? "");
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const busy = saving || refreshing;

  const selected = teams.find((t) => t.id === selectedId) ?? teams[0];
  React.useEffect(() => {
    if (teams.length && !teams.some((t) => t.id === selectedId)) setSelectedId(teams[0].id);
  }, [teams, selectedId]);

  const [draft, setDraft] = React.useState<{ name?: string; goal?: string }>({});
  React.useEffect(() => setDraft({}), [selectedId, teams]);

  const run = React.useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return false;
        }
        startRefresh(() => router.refresh());
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  // Selling roster = who can be on a sales team (active sales + the player-coach CEO).
  const candidates = React.useMemo(
    () =>
      employees.filter(
        (e) => e.status === "active" && (e.department === "sales" || e.department === "management")
      ),
    [employees]
  );
  const teamOf = (code: string) => teams.find((t) => t.memberCodes.includes(code));

  // A leader needs the sales_leader ROLE to actually hold team-scoped permissions —
  // membership alone does not grant them.
  const leaderMissingRole =
    selected?.leaderCode &&
    !employees
      .find((e) => e.code === selected.leaderCode)
      ?.roleNames.some((n) => /leader|หัวหน้า/i.test(n));

  if (!teams.length) {
    return (
      <div className="flex flex-col gap-3">
        {error && <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>}
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Users size={22} strokeWidth={1.5} className="text-text-subtle" />
          <p className="text-small text-text-subtle">ยังไม่มีทีม</p>
          <p className="text-label text-text-subtle max-w-md">
            ตอนนี้ทุกคนรวมทั้ง CEO เห็น “ทีม” เป็นตัวเองคนเดียว — คอลัมน์กิจกรรมในหน้าทีมจึงขึ้น “—”
            และตั้งเป้าให้ลูกทีมไม่ได้ · สร้างทีมแรกแล้วตั้งหัวหน้า ทั้งหมดนี้จะเปิดใช้งานเอง
          </p>
          {canManage && (
            <button
              onClick={() => void run(() => createTeam("ทีมใหม่"))}
              disabled={busy}
              className="text-small font-medium text-accent hover:underline disabled:opacity-50"
            >
              สร้างทีมแรก
            </button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>}

      <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-4 items-start">
        {/* Team list */}
        <Card className="overflow-hidden">
          <div className="px-3 h-11 flex items-center justify-between border-b border-border">
            <span className="text-label uppercase text-text-subtle">ทีม ({teams.length})</span>
          </div>
          <ul className="divide-y divide-border">
            {teams.map((t) => {
              const leader = employees.find((e) => e.code === t.leaderCode);
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
                      <span className="num">{t.memberCodes.length}</span> คน
                      {leader ? <> · หัวหน้า {leader.nickname}</> : " · ยังไม่มีหัวหน้า"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {canManage && (
            <button
              onClick={() => void run(() => createTeam("ทีมใหม่"))}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              <Plus size={15} strokeWidth={2} /> สร้างทีม
            </button>
          )}
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
                  value={draft.name ?? selected.name}
                  disabled={!canManage || busy}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== selected.name)
                      void run(() => updateTeam(selected.id, { name: next }));
                  }}
                  className="font-semibold h-8 max-w-xs"
                  aria-label="ชื่อทีม"
                />
                <label className="flex items-center gap-2 text-small text-text-muted">
                  เป้ารายได้ต่อเดือน (฿)
                  <Input
                    value={draft.goal ?? (selected.revenueGoal ? String(selected.revenueGoal) : "")}
                    disabled={!canManage || busy}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, goal: e.target.value.replace(/[^\d]/g, "") }))
                    }
                    onBlur={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const next = raw === "" ? null : Number(raw);
                      if (next !== selected.revenueGoal)
                        void run(() => updateTeam(selected.id, { revenueGoal: next }));
                    }}
                    inputMode="numeric"
                    className="h-8 w-40 num text-right"
                    placeholder="0"
                  />
                </label>
              </div>
              {canManage && (
                <ConfirmDelete
                  onDelete={() => void run(() => deleteTeam(selected.id))}
                  label="ลบทีม"
                  confirmLabel={`ลบ “${selected.name}”?`}
                  warning={
                    selected.memberCodes.length > 0
                      ? `สมาชิก ${selected.memberCodes.length} คนจะไม่มีทีมสังกัด และเป้ารายได้/การ scope ของทีมนี้จะหายไป`
                      : "ทีมนี้ไม่มีสมาชิก — ลบได้อย่างปลอดภัย"
                  }
                />
              )}
            </div>

            {leaderMissingRole && (
              <div className="mt-3 flex items-start gap-2 text-small rounded-md bg-amber-bg/50 border border-amber/30 px-3 py-2">
                <ShieldAlert size={14} strokeWidth={1.75} className="text-amber shrink-0 mt-0.5" />
                <span className="text-text-muted">
                  หัวหน้าทีมคนนี้ยังไม่มีบทบาท <span className="text-text">Sales Leader</span> —
                  เป็นหัวหน้าในชื่อ แต่ยังไม่ได้สิทธิ์ดูผลงานลูกทีม · ไปเพิ่มที่ ตั้งค่า → บทบาท & สิทธิ์
                </span>
              </div>
            )}
          </Card>

          {/* Members + leader */}
          <Card>
            <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
              <Users size={15} strokeWidth={1.75} className="text-text-muted" />
              <span className="text-h3">สมาชิกทีม</span>
              <span className="num text-label text-text-subtle">({selected.memberCodes.length})</span>
              <span className="ml-auto text-label text-text-subtle inline-flex items-center gap-1">
                <Crown size={12} strokeWidth={2} className="text-amber" /> = หัวหน้าทีม
              </span>
            </div>
            <ul className="divide-y divide-border">
              {candidates.map((e) => {
                const inTeam = selected.memberCodes.includes(e.code);
                const isLeader = selected.leaderCode === e.code;
                const other = !inTeam ? teamOf(e.code) : undefined;
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
                        {other && <span className="text-text-subtle"> · อยู่{other.name}</span>}
                      </div>
                    </div>
                    {inTeam && canManage && (
                      <button
                        onClick={() =>
                          void run(() => setTeamLeader(selected.id, isLeader ? null : e.code))
                        }
                        disabled={busy}
                        className={cn(
                          "text-label font-medium rounded-md px-2.5 h-8 border transition-colors inline-flex items-center gap-1 disabled:opacity-50",
                          isLeader
                            ? "border-amber/40 bg-amber-bg text-amber"
                            : "border-border-strong text-text-muted hover:bg-surface-2"
                        )}
                      >
                        <Crown size={12} strokeWidth={2} /> {isLeader ? "หัวหน้า" : "ตั้งเป็นหัวหน้า"}
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() =>
                          void run(() => setEmployeeTeam(e.code, inTeam ? null : selected.id))
                        }
                        disabled={busy}
                        className={cn(
                          "text-small font-medium rounded-md px-3 h-8 border transition-colors inline-flex items-center gap-1 disabled:opacity-50",
                          inTeam
                            ? "bg-text text-background border-text"
                            : "border-border-strong text-text-muted hover:bg-surface-2"
                        )}
                      >
                        {inTeam ? (
                          <>
                            <Check size={13} strokeWidth={2.5} /> ในทีม
                          </>
                        ) : (
                          "เพิ่ม"
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
