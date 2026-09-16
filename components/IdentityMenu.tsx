"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Check, KeyRound, LogOut, Monitor, Moon, Sun, UserCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTopmostEscape } from "@/lib/overlayStack";
import { useRbac, SELF_ID } from "@/components/RbacProvider";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedItem, SegmentedTrack } from "@/components/ui/Segmented";
import { supabaseBrowser } from "@/lib/supabase/client";

/* Who you are, and the few things you can do about it.
 *
 * ONE component, TWO anchors. The sidebar's profile card opens it upward and the topbar's
 * avatar opens it downward, and they must be the same menu: the view-as switcher used to
 * live only in the sidebar, and giving the topbar a second, smaller menu would have meant
 * two places that could disagree about who you are looking as.
 *
 * Contents, top to bottom, each shown only when it applies:
 *   บัญชีของฉัน   people.manage_accounts holders — everyone else asks one of them
 *   ธีม           สว่าง / มืด / ระบบ (next-themes)
 *   ดูในมุมมอง    impersonation, for roles that carry it
 *   ออกจากระบบ
 */
export function IdentityMenu({
  placement,
  children,
}: {
  placement: "up" | "down";
  /** The trigger. Receives the open state so it can mark itself pressed. */
  children: (state: { open: boolean; toggle: () => void }) => React.ReactNode;
}) {
  const { users, roles, viewerId, setViewerId, currentUser, isAuthenticated, canViewAs, can, avatarUrl } =
    useRbac();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const canManageOwnAccount = can("people.manage_accounts");

  useTopmostEscape(() => setOpen(false), open);

  const roleNames = (roleIds: string[]) =>
    roleIds.length
      ? roleIds.map((id) => roles.find((r) => r?.id === id)?.name ?? id).join(" · ")
      : "ไม่มีบทบาท";

  async function signOut() {
    setSigningOut(true);
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      {children({ open, toggle: () => setOpen((o) => !o) })}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={cn(
              "absolute z-50 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-pop",
              placement === "up" ? "bottom-[calc(100%+6px)] left-0" : "right-0 top-[calc(100%+6px)]"
            )}
          >
            {/* Identity */}
            <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
              <Avatar name={currentUser.name} src={avatarUrl} tone="accent" className="size-8 text-small" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-body font-medium text-text">{currentUser.name}</span>
                <span className="block truncate text-label text-text-subtle">
                  {roleNames(currentUser.roleIds)}
                </span>
              </span>
            </div>

            {canManageOwnAccount && (
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <KeyRound size={14} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
                <span className="text-small text-text">บัญชีของฉัน</span>
              </Link>
            )}

            <ThemeRow />

            {canViewAs && (
              <div className="border-t border-border">
                <div className="px-3 pb-1 pt-2 text-label uppercase text-text-subtle">ดูในมุมมอง</div>
                <div className="max-h-[40vh] overflow-y-auto">
                  {isAuthenticated && (
                    <MenuUser
                      name="กลับเป็นตัวเอง"
                      icon={<UserCheck size={14} strokeWidth={1.75} className="shrink-0 text-text-subtle" />}
                      on={viewerId === SELF_ID}
                      onClick={() => {
                        setViewerId(SELF_ID);
                        setOpen(false);
                      }}
                    />
                  )}
                  {users.map((u) => (
                    <MenuUser
                      key={u.id}
                      name={u.name}
                      sub={roleNames(u.roleIds)}
                      icon={<Avatar name={u.name} tone={u.id === viewerId ? "accent" : "neutral"} />}
                      on={u.id === viewerId}
                      onClick={() => {
                        setViewerId(u.id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {isAuthenticated && (
              <button
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                <LogOut size={14} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
                <span className="text-small text-text">ออกจากระบบ</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuUser({
  name,
  sub,
  icon,
  on,
  onClick,
}: {
  name: string;
  sub?: string;
  icon: React.ReactNode;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
        on ? "bg-accent-wash" : "hover:bg-surface-hover"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-small text-text">{name}</span>
        {sub && <span className="block truncate text-label text-text-subtle">{sub}</span>}
      </span>
      {on && <Check size={14} strokeWidth={2.5} className="shrink-0 text-accent" />}
    </button>
  );
}

const THEMES = [
  { key: "light", label: "สว่าง", icon: Sun },
  { key: "dark", label: "มืด", icon: Moon },
  { key: "system", label: "ระบบ", icon: Monitor },
] as const;

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; until mount the segmented control
  // would render with nothing selected and then jump. Render the row after mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center gap-2 border-t border-border px-3 py-2">
      <span className="text-small text-text-muted">ธีม</span>
      <SegmentedTrack className="ml-auto">
        {THEMES.map((t) => {
          const Icon = t.icon;
          return (
            <SegmentedItem
              key={t.key}
              size="icon"
              on={mounted && theme === t.key}
              onClick={() => setTheme(t.key)}
              title={t.label}
              aria-label={t.label}
            >
              <Icon size={14} strokeWidth={1.75} />
            </SegmentedItem>
          );
        })}
      </SegmentedTrack>
    </div>
  );
}
