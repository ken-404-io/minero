"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import { IconCheck, IconError, IconShield, IconUsers, IconUser } from "@/components/icons";

type AdminNotificationRow = {
  title: string;
  body: string;
  link: string | null;
  sentAt: string;
  sentBy: string | null;
  recipients: number;
  reads: number;
};

type Mode = "broadcast" | "single";

export default function AdminNotificationsClient({
  recent,
}: {
  recent: AdminNotificationRow[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("broadcast");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [userId, setUserId] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (mode === "single" && !userId.trim()) {
      setError("Provide a user ID.");
      return;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim(),
      };
      if (link.trim()) payload.link = link.trim();
      if (mode === "broadcast") payload.broadcast = true;
      else payload.userId = userId.trim();

      const res = await fetch(`${API_URL}/admin/notifications`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Failed to send";
        setError(msg);
        return;
      }
      setSuccess(
        mode === "broadcast"
          ? `Sent to ${data.sent} user${data.sent === 1 ? "" : "s"}.`
          : `Sent to user.`
      );
      setTitle("");
      setBody("");
      setLink("");
      setUserId("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[900px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-6">
          <span className="section-title">Admin</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Notifications</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Broadcast announcements to all users, or send a targeted message to a single user.
            They appear in the bell dropdown immediately.
          </p>
        </header>

        {success && (
          <div className="alert alert-success mb-4" role="status">
            <IconCheck size={16} /> <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="alert alert-danger mb-4" role="alert">
            <IconError size={16} /> <span>{error}</span>
          </div>
        )}

        <section className="card mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <IconShield size={18} /> Send a notification
          </h2>

          <form onSubmit={send} className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("broadcast")}
                className={`btn btn-sm ${mode === "broadcast" ? "btn-primary" : "btn-secondary"}`}
              >
                <IconUsers size={14} /> Broadcast to all
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`btn btn-sm ${mode === "single" ? "btn-primary" : "btn-secondary"}`}
              >
                <IconUser size={14} /> Single user
              </button>
            </div>

            {mode === "single" && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">User ID</span>
                <input
                  type="text"
                  className="input"
                  placeholder="user_xxxxxxxxxxxx"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required={mode === "single"}
                />
                <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                  Find a user&apos;s ID on the Users page.
                </span>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Title</span>
              <input
                type="text"
                className="input"
                placeholder="e.g. New 2× weekend bonus"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Message</span>
              <textarea
                className="input"
                rows={4}
                placeholder="What do you want users to know?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                required
              />
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                {body.length}/1000
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Link <span style={{ color: "var(--text-subtle)" }}>(optional)</span>
              </span>
              <input
                type="text"
                className="input"
                placeholder="/dashboard"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                maxLength={500}
              />
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                In-app path that the notification deep-links to when tapped.
              </span>
            </label>

            <div className="flex justify-end">
              <button type="submit" disabled={sending} className="btn btn-primary">
                {sending ? "Sending…" : mode === "broadcast" ? "Broadcast to all users" : "Send"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Recent admin notifications</h2>
          {recent.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No admin notifications sent yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.map((n, i) => {
                const readPct =
                  n.recipients > 0 ? Math.round((n.reads / n.recipients) * 100) : 0;
                return (
                  <li
                    key={`${n.sentAt}-${i}`}
                    className="rounded-lg border p-3"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{n.title}</div>
                        <p
                          className="text-sm mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {n.body}
                        </p>
                        {n.link && (
                          <p
                            className="text-xs font-mono mt-2"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            → {n.link}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div
                          className="text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {new Date(n.sentAt).toLocaleString()}
                        </div>
                        <div className="text-sm font-mono mt-1">
                          {n.reads}/{n.recipients} read
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {readPct}%
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
