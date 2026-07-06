"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[228px] shrink-0 h-screen sticky top-0 bg-surface border-r border-border flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <div className="leading-none">
          <div
            className="text-h1 font-bold tracking-tight"
            style={{ color: "var(--maroon-900)" }}
          >
            HAUS
          </div>
          <div className="text-label uppercase text-text-subtle mt-0.5">Living Estate</div>
        </div>
      </div>

      {/* Unit switcher */}
      <div className="px-3 pt-3">
        <div className="inline-flex w-full items-center gap-0.5 bg-surface-2 rounded-md p-0.5">
          <span className="flex-1 text-center h-7 leading-7 rounded-[7px] bg-surface shadow-card text-small text-accent font-medium">
            ขาย
          </span>
          <span className="flex-1 text-center h-7 leading-7 rounded-[7px] text-small text-text-muted">
            เช่า
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-surface-2 text-text-subtle text-small">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span className="flex-1">ค้นหา…</span>
          <kbd className="num text-label border border-border rounded px-1 bg-surface">⌘K</kbd>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-4 flex-1">
        <div className="px-2 text-label uppercase text-text-subtle mb-1">เมนู</div>
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={active ? "text-accent" : ""}
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-wash text-accent text-label">
            HB
          </span>
          <div className="leading-tight">
            <div className="text-small text-text">Haus Boss</div>
            <div className="text-label text-text-subtle">CEO</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
