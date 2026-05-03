"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconFileText,
  IconCheck,
  IconError,
  IconWarning,
} from "@/components/icons";

type Report = {
  id: string;
  userId: string;
  message: string;
  mediaUrl: string | null;
  status: string;
  createdAt: string;
  dismissedAt: string | null;
  dismissedBy: string | null;
  user: { id: string; name: string; email: string } | null;
};

type Props = {
  reports: Report[];
  total: number;
  page: number;
  pages: number;
  statusFilter: string;
};

const TABS = [
  { key: "open",      label: "Open" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all",       label: "All" },
];

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReportsClient({
  reports, total, page, pages, statusFilter,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function dismiss(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/reports/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
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
            User Reports{" "}
            <span style={{ color: "var(--text-muted)" }}>({total.toLocaleString()})</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Problems submitted by users. Dismiss once resolved.
          </p>
        </header>

        {/* Status tabs */}
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
                href={`/admin/reports?status=${t.key}`}
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
          <div className="alert alert-danger mb-4 flex items-center gap-2" role="alert">
            <IconError size={16} /> <span>{error}</span>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
            <IconFileText size={28} className="mx-auto mb-2" />
            <p>No {statusFilter === "all" ? "" : statusFilter} reports.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0 flex-1">
                    {/* User + timestamp */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {r.status === "open" ? (
                        <span className="badge badge-pending">
                          <IconWarning size={11} /> open
                        </span>
                      ) : (
                        <span className="badge badge-neutral">dismissed</span>
                      )}
                      {r.user ? (
                        <span className="text-sm font-medium">
                          {r.user.name}{" "}
                          <span
                            className="font-mono text-xs"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {r.user.email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-subtle)" }}>
                          Unknown user
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        {fmtDateTime(r.createdAt)}
                      </span>
                    </div>

                    {/* Message body */}
                    <p
                      className="text-sm mt-2 whitespace-pre-wrap"
                      style={{ color: "var(--text)" }}
                    >
                      {r.message}
                    </p>

                    {/* Attached media */}
                    {r.mediaUrl && (
                      r.mediaUrl.match(/\.(mp4|mov|webm|ogg)(\?|$)/i)
                        ? (
                          <video
                            src={r.mediaUrl}
                            controls
                            className="mt-3 rounded-lg max-w-sm w-full"
                            style={{ maxHeight: 300 }}
                          />
                        ) : (
                          <a href={r.mediaUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={r.mediaUrl}
                              alt="Attached screenshot"
                              className="mt-3 rounded-lg max-w-sm w-full object-cover cursor-pointer"
                              style={{ maxHeight: 300 }}
                            />
                          </a>
                        )
                    )}

                    {/* Dismissed info */}
                    {r.dismissedAt && (
                      <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
                        Dismissed {fmtDateTime(r.dismissedAt)}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  {r.status === "open" && (
                    <button
                      onClick={() => dismiss(r.id)}
                      disabled={busy === r.id}
                      className="btn btn-success btn-sm shrink-0"
                    >
                      <IconCheck size={14} />
                      {busy === r.id ? "Dismissing…" : "Dismiss"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <nav
            className="flex items-center justify-center gap-1 mt-6"
            aria-label="Pagination"
          >
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/admin/reports?status=${statusFilter}&page=${p}`}
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
