"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const MobileNavCtx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export const useMobileNav = () => React.useContext(MobileNavCtx);

/** Holds the off-canvas sidebar drawer state (mobile only). Shared by the
 *  Topbar hamburger and the Sidebar drawer. Auto-closes on navigation and Escape. */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close whenever the route changes (covers nav-item taps).
  React.useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll + close on Escape while the drawer is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return <MobileNavCtx.Provider value={{ open, setOpen }}>{children}</MobileNavCtx.Provider>;
}
