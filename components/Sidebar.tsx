"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV, navItemFor } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useShell } from "@/components/Shell";
import { useRbac } from "@/components/RbacProvider";
import { Avatar } from "@/components/ui/Avatar";
import { IdentityMenu } from "@/components/IdentityMenu";
import { Brand } from "@/components/Brand";

/** Desktop: static rail in the layout grid, 228px or collapsed to a 64px icon rail.
 *  Mobile: off-canvas drawer overlay, never collapsed — there is nothing to save width for. */
export function Sidebar() {
  const { mobileOpen, setMobileOpen, collapsed } = useShell();
  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface lg:flex",
          "transition-[width] duration-200",
          collapsed ? "w-16" : "w-[228px]"
        )}
      >
        <SidebarBody collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn("fixed inset-0 z-40 lg:hidden", mobileOpen ? "" : "pointer-events-none")}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-[270px] max-w-[82%] flex-col border-r border-border bg-surface shadow-pop transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarBody collapsed={false} />
        </aside>
      </div>
    </>
  );
}

function SidebarBody({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { can, currentUser, roles } = useRbac();
  const { setCollapsed } = useShell();
  const current = navItemFor(pathname);
  const roleLabel = currentUser.roleIds.length
    ? currentUser.roleIds.map((id) => roles.find((r) => r?.id === id)?.name ?? id).join(" · ")
    : "ไม่มีบทบาท";

  return (
    <>
      {/* Brand — the house mark alone on the icon rail, the full lockup otherwise. */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-0" : "justify-between gap-2 px-4"
        )}
      >
        <Brand variant={collapsed ? "mark" : "lockup"} />
        {!collapsed && <CollapseButton collapsed={false} onClick={() => setCollapsed(true)} />}
      </div>
      {collapsed && (
        <div className="flex justify-center border-b border-border py-1.5 lg:flex">
          <CollapseButton collapsed onClick={() => setCollapsed(false)} />
        </div>
      )}

      {/* Nav — items filtered by the viewer's permissions */}
      <nav className={cn("flex flex-1 flex-col overflow-y-auto pb-2 pt-3", collapsed ? "px-2.5" : "px-2")}>
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => can(i.perm));
          if (items.length === 0) return null;
          return (
            <div
              key={group.title || group.items[0]?.href}
              className={cn("mb-3", group.bottom ? "mb-0 mt-auto" : "last:mb-0")}
            >
              {group.title &&
                (collapsed ? (
                  gi > 0 && <div className="mx-1 mb-2 border-t border-border" />
                ) : (
                  <div className="mb-1 px-2 text-label uppercase text-text-subtle">{group.title}</div>
                ))}
              {items.map((item) => {
                const active = current?.href === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center rounded-md text-body transition-colors",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-2",
                      active
                        ? "bg-accent-wash font-medium text-accent-ink"
                        : "text-text-muted hover:bg-surface-hover hover:text-text"
                    )}
                  >
                    <Icon size={17} strokeWidth={1.75} className={cn("shrink-0", active && "text-accent")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Profile card → identity menu (account, theme, view-as, sign out) */}
      <div className={cn("border-t border-border", collapsed ? "px-2.5 py-2.5" : "px-3 py-3")}>
        <IdentityMenu placement="up">
          {({ open, toggle }) => (
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={collapsed ? currentUser.name : undefined}
              title={collapsed ? currentUser.name : undefined}
              className={cn(
                "flex w-full items-center rounded-md transition-colors hover:bg-surface-hover",
                collapsed ? "justify-center p-1.5" : "-m-1.5 gap-2 p-1.5",
                open && "bg-surface-hover"
              )}
            >
              <Avatar name={currentUser.name} tone="accent" className="size-7 text-label" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 text-left leading-tight">
                    <span className="block truncate text-small text-text">{currentUser.name}</span>
                    <span className="block truncate text-label text-text-subtle">{roleLabel}</span>
                  </span>
                  <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
                </>
              )}
            </button>
          )}
        </IdentityMenu>
      </div>
    </>
  );
}

function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "ขยายเมนู" : "ย่อเมนู";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // Desktop only: the mobile drawer renders this body too and has nothing to collapse.
      className="ml-auto hidden size-7 shrink-0 place-items-center rounded-md text-text-subtle transition-colors hover:bg-surface-hover hover:text-text lg:grid"
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}
