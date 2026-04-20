"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconWarning,
  IconCheck,
  IconX,
  IconLock,
  IconError,
} from "@/components/icons";

type Alert = {
  id: string;
  userId: string | null;
  type: string;
  severity: string;
  details: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNote: string | null;
  user: { id: string; name: string; email: string; frozen: boolean } | null;
};

type Props = {
  alerts: Alert[];
  total: number;
  page: number;
  pages: number;
  statusFilter: string;
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityStyle(severity: string): string {
  if (severity === "high") return "badge-rejected";
  if (severity === "medium") return "badge-pending";
  return "badge-neutral";
}

function parseDetails(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

const TABS = [
  { key: "open",      label: "Open" },
  { key: "resolved",  label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all",       label: "All" },
];

export default function AdminAlertsClient({
  alerts, total, page, pages, statusFilter,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(id: string, action: "resolve" | "dismiss" | "freeze_user") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/fraud-alerts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Action failed");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-4">
          <span className="section-title">Admin</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
            Fraud alerts <span style={{ color: "var(--text-muted)" }}>({total.toLocaleString()})</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Auto-generated signals. Review and decide whether to resolve, dismiss, or freeze.
          </p>
        </header>

        <div
          className="-mx-4 px-4 lg:mx-0 lg:px-0 flex gap-2 overflow-x-auto pb-3 mb-5"
          role="tablist"
          aria-label="Filter by status"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map((t) => {
            const active = t.key === statusFilter;
            return (
              <Link
                key={t.key}
                href={`/admin/alerts?status=${t.key}`}
                role="tab"
                aria-selected={active}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-medium border"
                style={
                  active
                    ? { background: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }
                }
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {error && (
          <div className="alert alert-danger mb-4" role="alert">
            <IconError size={16} /> <span>{error}</span>
          </div>
        )}

        {alerts.length === 0 ? (
          <div
            className="card text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            <IconWarning size={28} className="mx-auto mb-2" />
            <p>No {statusFilter} alerts.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {alerts.map((a) => {
              const details = parseDetails(a.details);
              return (
                <li key={a.id} className="card">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${severityStyle(a.severity)}`}>
                          <IconWarning size={12} /> {a.severity}
                        </span>
                        <span className="font-semibold">{a.type.replace(/_/g, " ")}</span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {fmtDateTime(a.createdAt)}
                        </span>
                      </div>

                      {a.user ? (
                        <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                          {a.user.name} · <span className="font-mono">{a.user.email}</span>
                          {a.user.frozen && (
                            <span className="badge badge-rejected ml-2">
                              <IconLock size={12} /> Frozen
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm mt-1" style={{ color: "var(--text-subtle)" }}>
                          No user associated
                        </div>
                      )}

                      {Object.keys(details).length > 0 && (
                        <pre
                          className="text-xs mt-2 p-2 overflow-x-auto"
                          style={{
                            background: "var(--surface-2)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--text-muted)",
                            maxWidth: "100%",
                          }}
                        >
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      )}

                      {a.adminNote && (
                        <div
                          className="text-xs mt-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Note: {a.adminNote}
                        </div>
                      )}
                    </div>

                    {a.status === "open" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => act(a.id, "resolve")}
                          disabled={busy === a.id}
                          className="btn btn-success btn-sm"
                        >
                          <IconCheck size={14} /> Resolve
                        </button>
                        <button
                          onClick={() => act(a.id, "dismiss")}
                          disabled={busy === a.id}
                          className="btn btn-ghost btn-sm"
                        >
                          <IconX size={14} /> Dismiss
                        </button>
                        {a.userId && (
                          <button
                            onClick={() => act(a.id, "freeze_user")}
                            disabled={busy === a.id}
                            className="btn btn-danger btn-sm"
                          >
                            <IconLock size={14} /> Freeze user
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/admin/alerts?status=${statusFilter}&page=${p}`}
                aria-current={p === page ? "page" : undefined}
                className="h-9 min-w-9 px-2 flex items-center justify-center rounded-md text-sm font-medium"
                style={
                  p === page
                    ? { background: "var(--brand)", color: "var(--brand-fg)" }
                    : { background: "var(--surface-2)", color: "var(--text)" }
                }
              >
                {p}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
