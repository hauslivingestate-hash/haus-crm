"use client";

import * as React from "react";
import { Plus, Lock, ShieldCheck, Check, Users } from "lucide-react";
import { PERMISSION_GROUPS, roleUserCount } from "@/lib/rbac";
import { useRbac } from "@/components/RbacProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { cn } from "@/lib/cn";

export function RolesManager() {
  // Shared store — edits here immediately change what each persona sees (view-as).
  const { roles, setRoles, users, setUsers } = useRbac();
  const [selectedId, setSelectedId] = React.useState<string>("ceo");
  const [newRoleSeq, setNewRoleSeq] = React.useState(1);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];
  const locked = !!selected.system;

  const togglePerm = (permKey: string) => {
    if (locked) return;
    setRoles((rs) =>
      rs.map((r) =>
        r.id !== selected.id
          ? r
          : {
              ...r,
              permissions: r.permissions.includes(permKey)
                ? r.permissions.filter((p) => p !== permKey)
                : [...r.permissions, permKey],
            }
      )
    );
  };

  const rename = (name: string) =>
    setRoles((rs) => rs.map((r) => (r.id === selected.id ? { ...r, name } : r)));

  const createRole = () => {
    const id = `role_${newRoleSeq}`;
    setNewRoleSeq((n) => n + 1);
    setRoles((rs) => [...rs, { id, name: "บทบาทใหม่", description: "", permissions: [] }]);
    setSelectedId(id);
  };

  const deleteRole = (id: string) => {
    setRoles((rs) => rs.filter((r) => r.id !== id));
    setUsers((us) => us.map((u) => ({ ...u, roleIds: u.roleIds.filter((r) => r !== id) })));
    if (selectedId === id) setSelectedId("ceo");
  };

  const toggleUserRole = (userId: string, roleId: string) =>
    setUsers((us) =>
      us.map((u) =>
        u.id !== userId
          ? u
          : {
              ...u,
              roleIds: u.roleIds.includes(roleId)
                ? u.roleIds.filter((r) => r !== roleId)
                : [...u.roleIds, roleId],
            }
      )
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-4 items-start">
      {/* Role list */}
      <Card className="overflow-hidden">
        <div className="px-3 h-11 flex items-center justify-between border-b border-border">
          <span className="text-label uppercase text-text-subtle">บทบาท ({roles.length})</span>
        </div>
        <ul className="divide-y divide-border">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2",
                  r.id === selected.id ? "bg-accent-wash" : "hover:bg-surface-hover"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body font-medium truncate">{r.name}</span>
                    {r.system && <Lock size={11} strokeWidth={2} className="text-text-subtle shrink-0" />}
                  </div>
                  <div className="text-label text-text-subtle">
                    <span className="num">{r.permissions.length}</span> สิทธิ์ ·{" "}
                    <span className="num">{roleUserCount(r.id, users)}</span> คน
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={createRole}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors"
        >
          <Plus size={15} strokeWidth={2} /> สร้างบทบาท
        </button>
      </Card>

      {/* Role editor */}
      <div className="flex flex-col gap-4 min-w-0">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent-wash text-accent grid place-items-center shrink-0">
              <ShieldCheck size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              {locked ? (
                <div className="text-h2 flex items-center gap-2">
                  {selected.name}
                  <span className="inline-flex items-center gap-1 text-label text-text-subtle font-normal">
                    <Lock size={11} strokeWidth={2} /> ระบบ
                  </span>
                </div>
              ) : (
                <Input
                  value={selected.name}
                  onChange={(e) => rename(e.target.value)}
                  className="font-semibold h-8 max-w-xs"
                  aria-label="ชื่อบทบาท"
                />
              )}
              {selected.description && (
                <p className="text-small text-text-muted mt-1">{selected.description}</p>
              )}
              <p className="text-label text-text-subtle mt-1">
                <span className="num">{selected.permissions.length}</span> สิทธิ์ที่เปิดใช้
              </p>
            </div>
            {!locked && (
              <ConfirmDelete
                onDelete={() => deleteRole(selected.id)}
                label="ลบบทบาท"
                confirmLabel={`ลบ “${selected.name}”?`}
                warning={
                  roleUserCount(selected.id, users) > 0
                    ? `ผู้ใช้ ${roleUserCount(selected.id, users)} คนถือบทบาทนี้อยู่ — จะถูกถอดออกและเสียสิทธิ์ทั้งหมดของบทบาทนี้`
                    : "ไม่มีผู้ใช้ถือบทบาทนี้ — ลบได้อย่างปลอดภัย"
                }
              />
            )}
          </div>
          {locked && (
            <div className="mt-3 text-small text-text-subtle rounded-md bg-surface-2 px-3 py-2">
              บทบาท CEO เปิดทุกสิทธิ์และแก้ไขไม่ได้ (superadmin)
            </div>
          )}
        </Card>

        {/* Permission toggles */}
        <Card>
          <div className="px-4 h-11 flex items-center border-b border-border">
            <span className="text-h3">สิทธิ์การใช้งาน</span>
          </div>
          <div className="divide-y divide-border">
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.key} className="p-4">
                <div className="text-label uppercase text-text-subtle mb-2">{g.label}</div>
                <div className="flex flex-col gap-1">
                  {g.perms.map((p) => {
                    const on = selected.permissions.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        onClick={() => togglePerm(p.key)}
                        disabled={locked}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                          locked ? "cursor-not-allowed" : "hover:bg-surface-hover"
                        )}
                      >
                        <Toggle on={on} disabled={locked} />
                        <span className="min-w-0 flex-1">
                          <span className="text-body">{p.label}</span>
                          {p.hint && (
                            <span className="text-label text-text-subtle ml-2">{p.hint}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* User assignment */}
        <Card>
          <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
            <Users size={15} strokeWidth={1.75} className="text-text-muted" />
            <span className="text-h3">ผู้ใช้ในบทบาทนี้</span>
          </div>
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const inRole = u.roleIds.includes(selected.id);
              return (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium">{u.name}</div>
                    <div className="text-label text-text-subtle">
                      {u.roleIds.length
                        ? u.roleIds.map((rid) => roles.find((r) => r.id === rid)?.name ?? rid).join(" · ")
                        : "ไม่มีบทบาท"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleUserRole(u.id, selected.id)}
                    className={cn(
                      "text-small font-medium rounded-md px-3 h-8 border transition-colors",
                      inRole
                        ? "bg-text text-background border-text"
                        : "border-border-strong text-text-muted hover:bg-surface-2"
                    )}
                  >
                    {inRole ? "อยู่ในบทบาท" : "เพิ่ม"}
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

function Toggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
        on ? "bg-accent" : "bg-border-strong",
        disabled && "opacity-60"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all grid place-items-center",
          on ? "left-[18px]" : "left-0.5"
        )}
      >
        {on && <Check size={10} strokeWidth={3} className="text-accent" />}
      </span>
    </span>
  );
}
