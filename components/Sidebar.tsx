"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Eye, Check, ChevronsUpDown, LogOut, UserCheck, KeyRound } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useMobileNav } from "@/components/MobileNav";
import { useRbac, SELF_ID } from "@/components/RbacProvider";
import { Avatar } from "@/components/ui/Avatar";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Desktop: static rail in the layout grid. Mobile: off-canvas drawer overlay. */
export function Sidebar() {
  const { open, setOpen } = useMobileNav();
  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:flex w-[228px] shrink-0 h-screen sticky top-0 bg-surface border-r border-border flex-col">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn("lg:hidden fixed inset-0 z-40", open ? "" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-[270px] max-w-[82%] flex flex-col bg-surface border-r border-border shadow-pop transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarBody />
        </aside>
      </div>
    </>
  );
}

function SidebarBody() {
  const pathname = usePathname();
  const { can } = useRbac();

  return (
    <>
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <div className="leading-none">
          <div className="text-h1 font-bold tracking-tight" style={{ color: "var(--maroon-900)" }}>
            HAUS
          </div>
          <div className="text-label uppercase text-text-subtle mt-0.5">Living Estate</div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-surface-2 text-text-subtle text-small">
          <Search size={14} strokeWidth={1.75} />
          <span className="flex-1">ค้นหา…</span>
          <kbd className="num text-label border border-border rounded px-1 bg-surface">⌘K</kbd>
        </div>
      </div>

      {/* Nav — items filtered by the viewer's permissions */}
      <nav className="px-2 pt-3 pb-2 flex-1 flex flex-col overflow-y-auto">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(i.perm));
          if (items.length === 0) return null;
          return (
            <div
              key={group.title || group.items[0]?.href}
              className={cn("mb-3", group.bottom ? "mt-auto mb-0" : "last:mb-0")}
            >
              {group.title && (
                <div className="px-2 text-label uppercase text-text-subtle mb-1">{group.title}</div>
              )}
              {items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 h-9 px-2 rounded-md text-body transition-colors",
                      active
                        ? "bg-accent-wash text-text font-medium"
                        : "text-text-muted hover:bg-surface-hover hover:text-text"
                    )}
                  >
                    <Icon size={17} strokeWidth={1.75} className={active ? "text-accent" : ""} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* View-as switcher (design tool — stands in for the auth session) */}
      <ViewAsSwitcher />
    </>
  );
}

function ViewAsSwitcher() {
  const { users, roles, viewerId, setViewerId, currentUser, isAuthenticated, canViewAs } =
    useRbac();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

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

  // Signed in without impersonation rights → who you are, plus the two things you can do
  // with your own account.
  if (isAuthenticated && !canViewAs) {
    return (
      <div className="px-3 py-3 border-t border-border flex items-center gap-2">
        <Link
          href="/account"
          className="flex items-center gap-2 min-w-0 flex-1 rounded-md p-1.5 -m-1.5 hover:bg-surface-hover transition-colors"
        >
          <Avatar name={currentUser.name} tone="crimson" />
          <span className="leading-tight min-w-0 flex-1">
            <span className="block text-small text-text truncate">{currentUser.name}</span>
            <span className="block text-label text-text-subtle truncate">
              {roleNames(currentUser.roleIds)}
            </span>
          </span>
        </Link>
        <button
          onClick={signOut}
          disabled={signingOut}
          aria-label="ออกจากระบบ"
          title="ออกจากระบบ"
          className="size-7 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors shrink-0 disabled:opacity-50"
        >
          <LogOut size={14} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-3 border-t border-border">
      <div className="text-label uppercase text-text-subtle mb-1.5 flex items-center gap-1">
        <Eye size={11} strokeWidth={2} /> ดูในมุมมอง
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-md p-1.5 -m-1.5 hover:bg-surface-hover transition-colors"
      >
        <Avatar name={currentUser.name} tone="crimson" />
        <span className="leading-tight min-w-0 flex-1 text-left">
          <span className="block text-small text-text truncate">{currentUser.name}</span>
          <span className="block text-label text-text-subtle truncate">
            {roleNames(currentUser.roleIds)}
          </span>
        </span>
        <ChevronsUpDown size={14} strokeWidth={1.75} className="text-text-subtle shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bottom-[calc(100%-4px)] left-3 right-3 mb-1 rounded-lg border border-border bg-surface shadow-pop overflow-hidden max-h-[60vh] overflow-y-auto">
            {/* Signed-in admins get a way back to their own identity, and a way out. */}
            {isAuthenticated && (
              <>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-surface-hover transition-colors"
                >
                  <KeyRound size={14} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                  <span className="text-small text-text">บัญชีของฉัน</span>
                </Link>
                <button
                  onClick={() => {
                    setViewerId(SELF_ID);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors",
                    viewerId === SELF_ID ? "bg-accent-wash" : "hover:bg-surface-hover"
                  )}
                >
                  <UserCheck size={14} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                  <span className="text-small text-text flex-1">กลับเป็นตัวเอง</span>
                  {viewerId === SELF_ID && (
                    <Check size={14} strokeWidth={2.5} className="text-accent shrink-0" />
                  )}
                </button>
                <button
                  onClick={signOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-surface-hover transition-colors border-b border-border disabled:opacity-50"
                >
                  <LogOut size={14} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                  <span className="text-small text-text">ออกจากระบบ</span>
                </button>
              </>
            )}
            {users.map((u) => {
              const on = u.id === viewerId;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setViewerId(u.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors",
                    on ? "bg-accent-wash" : "hover:bg-surface-hover"
                  )}
                >
                  <Avatar name={u.name} tone={on ? "crimson" : "neutral"} />
                  <span className="leading-tight min-w-0 flex-1">
                    <span className="block text-small text-text truncate">{u.name}</span>
                    <span className="block text-label text-text-subtle truncate">
                      {roleNames(u.roleIds)}
                    </span>
                  </span>
                  {on && <Check size={14} strokeWidth={2.5} className="text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
