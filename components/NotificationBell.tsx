"use client";

// Topbar bell + dropdown panel. Follows the ViewAsSwitcher popover convention (backdrop
// click-out + Escape + shadow-pop panel). Clicking a row marks it read and deep-links to
// the entity; rows without a link just mark read.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotifications } from "@/components/NotificationsProvider";
import {
  NOTIFICATION_META,
  notificationHref,
  relativeTimeTh,
  groupByDay,
  DAY_BUCKET_LABEL,
  type AppNotification,
} from "@/lib/notifications";

const ICON_TONE: Record<string, string> = {
  accent: "bg-accent-wash text-accent",
  green: "bg-green-bg text-green",
  amber: "bg-amber-bg text-amber",
  blue: "bg-blue-bg text-blue",
  violet: "bg-violet-bg text-violet",
};

export function NotificationBell() {
  const router = useRouter();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = React.useState(false);

  // Close on Escape while open (matches the mobile drawer + view-as switcher).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const groups = groupByDay(items);

  const onItemClick = (n: AppNotification) => {
    markRead(n.id);
    const href = notificationHref(n);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={
          unreadCount > 0 ? `การแจ้งเตือน (ยังไม่อ่าน ${unreadCount} รายการ)` : "การแจ้งเตือน"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "relative size-9 grid place-items-center rounded-md transition-colors",
          open ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-hover hover:text-text"
        )}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-accent text-text-onaccent text-[10px] font-semibold leading-none num tabular-nums border-2 border-surface box-content"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="การแจ้งเตือน"
            className="absolute z-50 right-0 top-[calc(100%+6px)] w-[min(calc(100vw-2rem),380px)] rounded-lg border border-border bg-surface shadow-pop overflow-hidden"
          >
            <div className="h-11 px-3 flex items-center gap-2 border-b border-border">
              <span className="text-h3">การแจ้งเตือน</span>
              {unreadCount > 0 && (
                <span className="text-label text-text-subtle num">ยังไม่อ่าน {unreadCount}</span>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="ml-auto inline-flex items-center gap-1 text-small font-medium text-accent hover:bg-accent-wash rounded-md px-2 h-7 transition-colors"
                >
                  <CheckCheck size={14} strokeWidth={2} /> อ่านทั้งหมด
                </button>
              )}
            </div>

            <div className="max-h-[min(70vh,440px)] overflow-y-auto overscroll-contain">
              {groups.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <span className="mx-auto mb-2 size-9 rounded-full bg-surface-2 text-text-subtle grid place-items-center">
                    <Bell size={17} strokeWidth={1.75} />
                  </span>
                  <p className="text-body text-text-muted">ไม่มีการแจ้งเตือน</p>
                  <p className="text-label text-text-subtle mt-0.5">
                    เมื่อมี Lead ใหม่ หรือดีลคืบหน้า จะแจ้งที่นี่
                  </p>
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.bucket}>
                    <div className="px-3 py-1.5 text-label uppercase text-text-subtle bg-surface-2/60 border-b border-border sticky top-0">
                      {DAY_BUCKET_LABEL[g.bucket]}
                    </div>
                    <ul className="divide-y divide-border">
                      {g.items.map((n) => (
                        <li key={n.id}>
                          <NotificationRow n={n} onClick={() => onItemClick(n)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const meta = NOTIFICATION_META[n.type];
  const Icon = meta.icon;
  const unread = !n.readAt;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
        unread ? "bg-accent-wash/40 hover:bg-accent-wash/70" : "hover:bg-surface-hover"
      )}
    >
      <span
        className={cn("size-7 rounded-md grid place-items-center shrink-0 mt-0.5", ICON_TONE[meta.tone])}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn("text-body truncate", unread ? "font-medium text-text" : "text-text-muted")}>
            {n.title}
          </span>
          {unread && <span className="size-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />}
        </span>
        {n.body && <span className="block text-small text-text-muted truncate">{n.body}</span>}
        <span className="block text-label text-text-subtle mt-0.5">
          {relativeTimeTh(n.createdAt)}
          {n.actor ? ` · โดย ${n.actor}` : ""}
        </span>
      </span>
    </button>
  );
}
