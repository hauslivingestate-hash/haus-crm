"use client";

/* Which overlay does Escape close?
 *
 * Every sheet in this repo closes itself on Escape by listening on `document`. That was
 * correct while overlays could not contain one another: exactly one was ever open.
 *
 * The detail drawer (components/ui/Drawer.tsx) ended that. A lead now opens inside a
 * drawer, and its แก้ไข button opens LeadEditSheet ON TOP of that drawer. Both listen on
 * the same document, so one Escape ran both handlers — the edit sheet closed and the
 * drawer went with it, throwing the user back to the list when they meant to cancel a
 * form. The same for ListingEditSheet and ListingCopyButton.
 *
 * The fix is the rule every windowing system uses: Escape belongs to the topmost thing.
 * Overlays register on mount, the last one in wins, and the ones underneath ignore the
 * key until it leaves. Order is mount order, which for nested overlays is the same as
 * stacking order — a sheet cannot mount before the drawer that renders it.
 *
 * Deliberately NOT a React context: the drawer is rendered by a parallel route slot and
 * the sheets by the page inside it. They are siblings in the route tree, so no provider
 * sits above both without wrapping the whole app in one.
 */

import * as React from "react";

/** Open overlays, oldest first. Tokens are identity-only; nothing reads their contents. */
const STACK: object[] = [];

/**
 * Close this overlay on Escape, but only while it is the topmost one.
 *
 * @param onEscape what to run. Held in a ref, so an inline arrow is fine — a changing
 *                 identity must not re-register, which would shuffle this overlay back to
 *                 the top of the stack and hand it a key press meant for the sheet above.
 * @param active   false while the overlay is closed. An unmounted-but-rendered sheet
 *                 (`if (!open) return null` happens after hooks run) must not hold a slot.
 */
export function useTopmostEscape(onEscape: () => void, active = true) {
  const handler = React.useRef(onEscape);
  handler.current = onEscape;

  React.useEffect(() => {
    if (!active) return;

    const token = {};
    STACK.push(token);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (STACK[STACK.length - 1] !== token) return; // something is open above us
      handler.current();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = STACK.indexOf(token);
      if (i !== -1) STACK.splice(i, 1);
    };
  }, [active]);
}
