"use client";

// Holds the notification feed for the CURRENT viewer (follows the view-as switcher, so
// switching persona switches the bell). Design phase: read-state lives in memory only —
// it survives client-side navigation but resets on a hard reload, and nothing persists.
// Wire later = replace the seed with a `notifications` query scoped to the session user
// (RLS: user_id = auth.uid()), and make markRead/markAllRead write read_at.

import * as React from "react";
import { useRbac } from "@/components/RbacProvider";
import {
  listNotifications,
  unreadCount as countUnread,
  NOW,
  type AppNotification,
} from "@/lib/notifications";

interface NotificationsCtx {
  /** The current viewer's feed, newest first. */
  items: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const Ctx = React.createContext<NotificationsCtx>({
  items: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
});

export const useNotifications = () => React.useContext(Ctx);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { viewerId } = useRbac();
  // Hold every persona's rows so read-state survives switching back and forth.
  const [all, setAll] = React.useState<AppNotification[]>(() => listNotifications());

  const items = React.useMemo(
    () =>
      all
        .filter((n) => n.userId === viewerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [all, viewerId]
  );

  const markRead = React.useCallback((id: string) => {
    setAll((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: NOW } : n))
    );
  }, []);

  const markAllRead = React.useCallback(() => {
    setAll((prev) =>
      prev.map((n) => (n.userId === viewerId && !n.readAt ? { ...n, readAt: NOW } : n))
    );
  }, [viewerId]);

  const value = React.useMemo(
    () => ({ items, unreadCount: countUnread(items), markRead, markAllRead }),
    [items, markRead, markAllRead]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
