"use client";

/* The slide-over shell — a detail page rendered over the list it came from.
   Read it together with app/(app)/leads/@drawer/ and app/(app)/listings/@drawer/.

   ── WHY A ROUTE AND NOT A useState ──────────────────────────────────────────────
   The obvious build is `const [selected, setSelected] = useState(row)` in the browser
   component. It is fewer files and it is what most CRMs do. It also throws away three
   things this product already depends on:

     · The notification bell links to /leads/L26-322. A drawer held in component state
       has no address, so those links would have to keep opening something else — two
       ways to look at one lead, drifting apart from the day they ship.
     · Back would leave the list instead of closing the drawer. On a phone, where Back
       is a hardware gesture, that is the difference between "close this" and "lose my
       filters and my scroll position".
     · A sale could not send a colleague a link to the deal being argued about.

   So the drawer IS the route. Clicking a row soft-navigates to /leads/:id, Next
   intercepts it (app/(app)/leads/@drawer/(.)[id]) and renders the detail here, over
   the list. Open that same address cold — from the bell, from a pasted link, from a
   refresh — and no interception happens: the full page renders instead. One set of
   content, two shapes, decided by how you arrived.

   ── CLOSING IS router.back() ────────────────────────────────────────────────────
   Not `router.push("/leads")`. Back pops the history entry the drawer created, which
   restores the list exactly as it was — scroll, filters, the lot — and keeps Forward
   working to reopen it. Pushing would stack a new entry and re-mount the list at the
   top, which reads as "you lost your place". */

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTopmostEscape } from "@/lib/overlayStack";
import { cn } from "@/lib/cn";

/** How long the panel takes to slide out. Must match the CSS below; the close is
    deferred by this much so the exit is seen rather than cut off. Kept short — a
    close that has to be waited for is worse than one with no animation at all. */
const EXIT_MS = 180;

export function Drawer({
  title,
  /** Tailwind max-width for the panel on sm+. Listings carry more than leads do. */
  width = "sm:max-w-[460px]",
  children,
}: {
  title: string;
  width?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = React.useState(false);
  const panel = React.useRef<HTMLDivElement>(null);
  /* Guards the close, in two directions:
       · `closing` — Escape held down, or a double click on the scrim, must not queue a
         second router.back(). One would close the drawer, the next would take the user
         off the leads list entirely.
       · `timer` — a queued back() has to be cancelled if the drawer unmounts first (the
         sidebar, a link inside the panel). Otherwise it fires into whatever page the
         user has since landed on and throws them backwards out of it. */
  const closing = React.useRef(false);
  const timer = React.useRef<number | null>(null);

  const close = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    timer.current = window.setTimeout(() => router.back(), EXIT_MS);
  }, [router]);

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  // Escape closes — unless an edit sheet is open on top of this drawer, in which case
  // that sheet gets the key and this one stays put. See lib/overlayStack.ts.
  useTopmostEscape(close);

  // Hold the page behind still, the same as every sheet in this repo. The previous
  // overflow is restored rather than cleared: the value is not always "" — a sheet
  // opened inside this drawer sets it too, and blanking it on close would leave the
  // list scrollable underneath whatever is still open.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Move the keyboard into the drawer. Without this, Tab from a just-clicked row keeps
  // walking the list underneath — which a screen reader reads out as if nothing opened.
  React.useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
      className={cn(
        // Lighter scrim than a modal's, plus a slight blur — the list behind stays legible
        // as context rather than being hidden, which is the difference between "a panel
        // over my list" and "a dialog interrupting me".
        "fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[2px]",
        leaving ? "drawer-scrim-out" : "drawer-scrim-in"
      )}
    >
      <div
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // Full width on a phone; a column on anything larger. `overscroll-contain`
          // stops a flick at the end of the drawer from scrolling the list behind it.
          "relative flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-background shadow-pop outline-none",
          "sm:rounded-l-[26px] sm:border-l sm:border-border",
          "scroll-thin",
          width,
          leaving ? "drawer-panel-out" : "drawer-panel-in"
        )}
      >
        {/* The close button FLOATS over the content rather than sitting in a title bar.
            A bar would repeat the lead's name two lines above the header that already
            says it, and spend a row of a phone screen restating what the user just
            tapped. `sticky` + a zero-height row keeps it reachable at any scroll depth
            without occupying any.

            ── pointer-events-none IS LOAD-BEARING ─────────────────────────────────
            The row is zero-height but its CHILD is not: it is a full-width, 48px-tall
            box holding the ✕ against the right edge, and it sits at z-20 over the
            content. Invisible, but not intangible — it swallowed every click in the
            top strip of the panel, which is exactly where both detail headers put
            their แก้ไข button (top-right, `sm:ml-auto`). The button rendered, the
            cursor changed, and nothing happened, because the click never reached it.
            Only the ✕ itself takes pointer events back. */}
        <div className="pointer-events-none sticky top-0 z-20 h-0 overflow-visible">
          <div className="flex justify-end px-3 pt-3">
            <button
              type="button"
              onClick={close}
              aria-label={`ปิด${title}`}
              className="pointer-events-auto grid size-9 place-items-center rounded-full bg-surface text-text-muted shadow-pop ring-1 ring-border transition-colors hover:text-text"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Keeping the header text clear of the floating ✕ is the content's job (the
            detail components pad their own header when `inDrawer`) — a rule here would
            have to guess which child is the header and would indent the whole panel. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
