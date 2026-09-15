"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Menu, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { navItemFor, SETTINGS_NAV } from "@/lib/nav";
import { useShell } from "@/components/Shell";
import { useRbac } from "@/components/RbacProvider";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { IdentityMenu } from "@/components/IdentityMenu";
import { GlobalSearch } from "@/components/GlobalSearch";

/* Page header: breadcrumb on the left, the page's own actions and the identity cluster on
 * the right.
 *
 * The breadcrumb is DERIVED, not passed. The first crumb is the nav entry the path falls
 * under (lib/nav navItemFor) and the last is `title` — so a list page reads "Lead" and a
 * detail page reads "Lead / สมชาย" with no change to the 40-odd call sites, which keep
 * passing exactly what they did. `title` stays an <h1>: it is still the page's name. */
export function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Right-side actions (e.g. an add button). Omit or pass false for none — there is no
   *  default action; each page provides its own contextual one. The bell is always shown. */
  actions?: React.ReactNode;
}) {
  const { setMobileOpen } = useShell();
  const { can, currentUser } = useRbac();
  const pathname = usePathname();
  const parent = navItemFor(pathname);
  const showParent = parent !== null && parent.label !== title;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-6">
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="เปิดเมนู"
        className="-ml-1 grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:hidden"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      <div className="min-w-0">
        <nav aria-label="breadcrumb">
          <ol className="flex min-w-0 items-center gap-1">
            {showParent && (
              <>
                <li className="hidden min-w-0 sm:block">
                  <Link
                    href={parent.href}
                    className="block truncate text-body text-text-muted transition-colors hover:text-text"
                  >
                    {parent.label}
                  </Link>
                </li>
                <li aria-hidden="true" className="hidden text-text-subtle sm:block">
                  <ChevronRight size={14} strokeWidth={1.75} />
                </li>
              </>
            )}
            <li className="min-w-0" aria-current="page">
              <h1 className="truncate text-h1">{title}</h1>
            </li>
          </ol>
        </nav>
        {subtitle && <p className="-mt-0.5 truncate text-small text-text-muted">{subtitle}</p>}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {/* ⌘K search — before the page's actions so it sits in the same place on every
            page, whatever the page adds to its right. */}
        <GlobalSearch />
        {actions}
        {/* Always present — deliberately outside the `actions` slot so pages that pass
            their own actions (or none) still get the bell. */}
        <NotificationBell />
        {can(SETTINGS_NAV.perm) && (
          <Link
            href={SETTINGS_NAV.href}
            aria-label={SETTINGS_NAV.label}
            title={SETTINGS_NAV.label}
            className="grid size-9 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Settings size={18} strokeWidth={1.75} />
          </Link>
        )}
        <IdentityMenu placement="down">
          {({ open, toggle }) => (
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={currentUser.name}
              className={cn(
                "flex h-9 items-center gap-1 rounded-md pl-1 pr-1.5 transition-colors",
                open ? "bg-surface-2" : "hover:bg-surface-hover"
              )}
            >
              <Avatar name={currentUser.name} tone="accent" className="size-7 text-label" />
              <ChevronDown size={14} strokeWidth={1.75} className="text-text-subtle" />
            </button>
          )}
        </IdentityMenu>
      </div>
    </header>
  );
}
