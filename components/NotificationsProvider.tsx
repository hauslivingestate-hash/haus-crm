"use client";

// The signed-in person's notification feed.
//
// Phase 6: reads `notifications` (server-rendered in the app layout) and writes read_at
// through server actions. It used to hold a seeded array keyed on a login id that no real
// session carries, so the bell was permanently empty for everyone actually using the app —
// and the read state it did track reset on every reload.
//
// Deliberately NOT tied to the "view as" switcher any more. Impersonation previews what
// another role can see; marking someone else's notification read is an action, not a
// preview, and RLS would refuse it anyway.

import * as React from "react";
import { useRouter } from "next/navigation";
import { unreadCount as countUnread, type AppNotification } from "@/lib/notifications";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/mutations/notifications";

interface NotificationsCtx {
  /** The viewer's feed, newest first. */
  items: AppNotification[];
  unreadCount: number;
  markRead: (id: number) => void;
  markAllRead: () => void;
  busy: boolean;
}

const Ctx = React.createContext<NotificationsCtx>({
  items: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  busy: false,
});

export const useNotifications = () => React.useContext(Ctx);

export function NotificationsProvider({
  children,
  items = [],
}: {
  children: React.ReactNode;
  items?: AppNotification[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  // Optimistic read-marks, so the dot clears on click rather than a round-trip later.
  const [readIds, setReadIds] = React.useState<Set<number>>(new Set());
  React.useEffect(() => setReadIds(new Set()), [items]);

  const shown = React.useMemo(
    () => items.map((n) => (readIds.has(n.id) ? { ...n, readAt: n.readAt ?? "optimistic" } : n)),
    [items, readIds]
  );

  const run = React.useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSaving(true);
      try {
        await fn();
        startRefresh(() => router.refresh());
      } catch {
        // Marking read is not worth an error card; the next render corrects the dot.
        startRefresh(() => router.refresh());
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  const markRead = React.useCallback(
    (id: number) => {
      if (items.find((n) => n.id === id)?.readAt) return;
      setReadIds((prev) => new Set(prev).add(id));
      void run(() => markNotificationRead(id));
    },
    [items, run]
  );

  const markAllRead = React.useCallback(() => {
    setReadIds(new Set(items.filter((n) => !n.readAt).map((n) => n.id)));
    void run(() => markAllNotificationsRead());
  }, [items, run]);

  const value = React.useMemo(
    () => ({
      items: shown,
      unreadCount: countUnread(shown),
      markRead,
      markAllRead,
      busy: saving || refreshing,
    }),
    [shown, markRead, markAllRead, saving, refreshing]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
