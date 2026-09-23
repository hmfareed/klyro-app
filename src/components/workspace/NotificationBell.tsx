"use client";

import { useEffect, useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = () => {
    fetch("/api/v1/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) markAllRead();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-white/10 bg-[#0f172a] p-4 text-white shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Notifications
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2.5">
            {notifications.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg p-2.5 text-xs transition-colors ${
                    n.isRead ? "bg-white/5 text-slate-300" : "bg-blue-950/40 border border-blue-800/40 text-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-200">{n.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(n.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">{n.body}</p>
                  {n.linkUrl && (
                    <Link
                      href={n.linkUrl}
                      onClick={() => setOpen(false)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                    >
                      View details <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
