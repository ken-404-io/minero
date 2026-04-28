"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api-url";
import {
  IconBell,
  IconCheck,
  IconPickaxe,
  IconWallet,
  IconShield,
  IconX,
} from "@/components/icons";

type NotificationType =
  | "mining_ready"
  | "withdrawal_submitted"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "admin";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type ListResponse = {
  notifications: Notification[];
  unread: number;
};

type CountResponse = { unread: number };

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(type: NotificationType) {
  switch (type) {
    case "mining_ready":
      return { Icon: IconPickaxe, color: "var(--brand)" };
    case "withdrawal_submitted":
    case "withdrawal_approved":
    case "withdrawal_rejected":
      return { Icon: IconWallet, color: "var(--success-fg, var(--brand))" };
    case "admin":
    default:
      return { Icon: IconShield, color: "var(--text-muted)" };
  }
}

export default function NotificationBell({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as CountResponse;
      setUnread(data.unread);
    } catch {
      // silent — bell stays at last known count
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notifications?limit=20`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as ListResponse;
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial count + polling.
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchCount]);

  // Load full list whenever the panel opens.
  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  // Click-outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n))
    );
    setUnread((u) => Math.max(0, u - ids.length));
    try {
      await fetch(`${API_URL}/notifications/read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // optimistic update stays even on failure; next poll reconciles
    }
  }

  async function markAllRead() {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    try {
      await fetch(`${API_URL}/notifications/read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // tolerate
    }
  }

  async function dismiss(id: string) {
    const removed = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (removed && !removed.readAt) setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`${API_URL}/notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // tolerate; next refresh will reconcile
    }
  }

  const buttonClass = variant === "mobile" ? "mobile-topbar-bell" : "btn-icon notif-bell-desktop";

  return (
    <div className={variant === "desktop" ? "relative inline-block" : "relative"}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClass}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <IconBell size={variant === "mobile" ? 20 : 18} />
        {unread > 0 && (
          <span
            className="notif-badge"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className={`notif-panel ${variant === "desktop" ? "notif-panel-up" : ""}`}
        >
          <div className="notif-panel-header">
            <span className="font-semibold">Notifications</span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-xs link-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark all read
            </button>
          </div>

          <div className="notif-panel-body">
            {loading && items.length === 0 ? (
              <div className="notif-empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">
                <IconBell size={28} />
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const { Icon, color } = iconFor(n.type);
                  const isUnread = !n.readAt;
                  const Wrapper: React.ElementType = n.link ? Link : "div";
                  const wrapperProps = n.link
                    ? {
                        href: n.link,
                        onClick: () => {
                          if (isUnread) markRead([n.id]);
                          setOpen(false);
                        },
                      }
                    : {
                        onClick: () => {
                          if (isUnread) markRead([n.id]);
                        },
                      };

                  return (
                    <li key={n.id} className={`notif-item ${isUnread ? "notif-item-unread" : ""}`}>
                      <Wrapper {...wrapperProps} className="notif-item-link">
                        <span
                          aria-hidden
                          className="notif-item-icon"
                          style={{ color }}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="notif-item-text">
                          <div className="flex items-center gap-2">
                            <span className="notif-item-title">{n.title}</span>
                            {isUnread && <span className="notif-item-dot" aria-hidden />}
                          </div>
                          <p className="notif-item-body">{n.body}</p>
                          <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                        </div>
                      </Wrapper>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                        }}
                        aria-label="Dismiss notification"
                        className="notif-item-dismiss"
                      >
                        <IconX size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="notif-panel-footer">
              <button
                type="button"
                onClick={() => fetchList()}
                className="text-xs link-brand"
              >
                Refresh
              </button>
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                {unread > 0 ? `${unread} unread` : "All caught up"}{" "}
                <IconCheck size={12} style={{ display: "inline-block", verticalAlign: "middle" }} />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
