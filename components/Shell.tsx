"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/* The application frame: sidebar + main, and the two bits of chrome state that both the
 * Sidebar and the Topbar read.
 *
 *   mobileOpen  the off-canvas drawer (phones). Auto-closes on navigation and Escape.
 *   collapsed   the desktop rail, 228px ⇄ 64px.
 *
 * ── WHY THE COLLAPSE PREFERENCE IS A COOKIE, NOT localStorage ───────────────────
 * The frame is server-rendered. A preference that only the browser can read would render
 * every page expanded and then snap to 64px after hydration — a visible jump on every
 * load for anyone who collapsed it. A cookie is readable by the (app) layout, so the
 * first paint is already the right width. It is a UI preference, so it is not HttpOnly:
 * the toggle writes it from the client and the server only ever reads it.
 */
export const SIDEBAR_COOKIE = "haus.sidebar"; // "1" = collapsed

interface ShellState {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const ShellCtx = React.createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = React.useContext(ShellCtx);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}

export function ShellProvider({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsedState] = React.useState(initialCollapsed);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (covers nav-item taps).
  React.useEffect(() => setMobileOpen(false), [pathname]);

  // Lock body scroll + close on Escape while the drawer is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    document.cookie = `${SIDEBAR_COOKIE}=${v ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  return (
    <ShellCtx.Provider value={{ mobileOpen, setMobileOpen, collapsed, setCollapsed }}>
      {children}
    </ShellCtx.Provider>
  );
}

/** The grid. Lives here rather than in the layout because its column width is client state. */
export function AppFrame({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const { collapsed } = useShell();
  return (
    <div
      className={cn(
        "grid min-h-screen grid-cols-1 lg:transition-[grid-template-columns] lg:duration-200",
        collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[228px_1fr]"
      )}
    >
      {sidebar}
      <main className="flex min-w-0 flex-col">{children}</main>
    </div>
  );
}
