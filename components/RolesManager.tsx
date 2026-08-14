"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Lock, ShieldCheck, Check, Users } from "lucide-react";
import type { RbacConfig } from "@/lib/queries";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import {
  createRole,
  renameRole,
  deleteRole,
  setRolePermission,
  setUserRole,
} from "@/lib/mutations/roles";
import { cn } from "@/lib/cn";

// ตั้งค่า → บทบาท & สิทธิ์, against `roles` / `role_permissions` / `user_roles`.
//
// This was the most dangerous of the in-memory settings screens: toggling a permission
// looked like it worked — the sidebar even changed for the "view as" persona — and nothing
// reached the database. Someone could believe they had granted HR access and be wrong.
//
// The lockout guard lives in the action, not here: every RLS policy in the app uses
// `has_perm('roles.manage')` as its escape hatch, so removing the last holder would leave
// nobody able to fix it. The server counts the remaining holders and refuses to reach zero.

export function RolesManager({ config }: { config: RbacConfig }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string>(config.roles[0]?.id ?? "");
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const busy = saving || refreshing;

  const roles = config.roles;
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];
  // Keep the selection valid after a delete.
  React.useEffect(() => {
    if (roles.length && !roles.some((r) => r.id === selectedId)) setSelectedId(roles[0].id);
  }, [roles, selectedId]);

  const [nameDraft, setNameDraft] = React.useState<string | null>(null);
  React.useEffect(() => setNameDraft(null), [selectedId, roles]);

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
        // A rejected action would otherwise leave the toggle looking flipped.
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  if (!selected) {
    return <Card className="p-6 text-center text-small text-text-subtle">ยังไม่มีบทบาท</Card>;
  }
  const locked = selected.system;

  return (
    <div className="flex flex-col gap-3">
      {error && <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>}

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
                      {r.system && (
                        <Lock size={11} strokeWidth={2} className="text-text-subtle shrink-0" />
                      )}
                    </div>
                    <div className="text-label text-text-subtle">
                      <span className="num">{r.permissions.length}</span> สิทธิ์ ·{" "}
                      <span className="num">{r.members.length}</span> คน
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => void run(() => createRole("บทบาทใหม่"))}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-small font-medium text-accent border-t border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
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
                    value={nameDraft ?? selected.name}
                    disabled={busy}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== selected.name)
                        void run(() => renameRole(selected.id, next));
                    }}
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
                  onDelete={() => void run(() => deleteRole(selected.id))}
                  label="ลบบทบาท"
                  confirmLabel={`ลบ “${selected.name}”?`}
                  warning={
                    selected.members.length > 0
                      ? `ผู้ใช้ ${selected.members.length} คนถือบทบาทนี้อยู่ — จะถูกถอดออกและเสียสิทธิ์ทั้งหมดของบทบาทนี้`
                      : "ไม่มีผู้ใช้ถือบทบาทนี้ — ลบได้อย่างปลอดภัย"
                  }
                />
              )}
            </div>
            {locked && (
              <div className="mt-3 text-small text-text-subtle rounded-md bg-surface-2 px-3 py-2">
                บทบาทของระบบเปิดทุกสิทธิ์และแก้ไขไม่ได้ — เป็นทางออกฉุกเฉินถ้าตั้งสิทธิ์ผิดจนล็อกตัวเอง
              </div>
            )}
          </Card>

          {/* Permission toggles */}
          <Card>
            <div className="px-4 h-11 flex items-center border-b border-border">
              <span className="text-h3">สิทธิ์การใช้งาน</span>
              <span className="text-label text-text-subtle ml-auto">
                เปลี่ยนแล้วมีผลทันทีกับคนที่ถือบทบาทนี้
              </span>
            </div>
            <div className="divide-y divide-border">
              {config.groups.map((g) => (
                <div key={g.key} className="p-4">
                  <div className="text-label uppercase text-text-subtle mb-2">{g.label}</div>
                  <div className="flex flex-col gap-1">
                    {g.perms.map((p) => {
                      const on = selected.permissions.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          onClick={() =>
                            void run(() => setRolePermission(selected.id, p.key, !on))
                          }
                          disabled={locked || busy}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                            locked || busy ? "cursor-not-allowed" : "hover:bg-surface-hover"
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
              {config.people.map((u) => {
                const inRole = u.roleIds.includes(selected.id);
                return (
                  <li key={u.code} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-medium">
                        {u.nickname} <span className="num text-label text-text-subtle">{u.code}</span>
                      </div>
                      <div className="text-label text-text-subtle">
                        {u.roleIds.length
                          ? u.roleIds
                              .map((rid) => roles.find((r) => r.id === rid)?.name ?? rid)
                              .join(" · ")
                          : "ไม่มีบทบาท"}
                      </div>
                    </div>
                    <button
                      onClick={() => void run(() => setUserRole(u.code, selected.id, !inRole))}
                      disabled={busy}
                      className={cn(
                        "text-small font-medium rounded-md px-3 h-8 border transition-colors disabled:opacity-50",
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
