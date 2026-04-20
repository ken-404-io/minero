"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api-url";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconX,
  IconClock,
  IconError,
} from "@/components/icons";

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  requestedAt: string | Date;
  processedAt: string | Date | null;
  adminNote: string | null;
  user: { name: string; email: string };
};

type Props = {
  withdrawals: Withdrawal[];
  total: number;
  page: number;
  pages: number;
  statusFilter: string;
};

function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusIcon(status: string) {
  if (status === "approved") return <IconCheck size={12} style={{ color: "var(--success-fg)" }} />;
  if (status === "pending")  return <IconClock size={12} style={{ color: "var(--warning-fg)" }} />;
  return <IconError size={12} style={{ color: "var(--danger-fg)" }} />;
}

const TABS = [
  { key: "pending",  label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all",      label: "All" },
];

export default function AdminWithdrawalsClient({
  withdrawals,
  total,
  page,
  pages,
  statusFilter,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  async function process(id: string, action: "approve" | "reject") {
    setLoading(id);
    try {
      await fetch(`${API_URL}/admin/withdrawals/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note[id] }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-4">
          <span className="section-title">Admin</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
            Withdrawals <span style={{ color: "var(--text-muted)" }}>({total.toLocaleString()})</span>
          </h1>
        </header>

        {/* Tabs — horizontal scroll on mobile */}
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
                href={`/admin/withdrawals?status=${t.key}`}
                role="tab"
                aria-selected={active}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-medium border"
                style={
                  active
                    ? {
                        background: "var(--brand)",
                        color: "var(--brand-fg)",
                        borderColor: "var(--brand)",
                      }
                    : {
                        background: "var(--surface-2)",
                        color: "var(--text-muted)",
                        borderColor: "var(--border)",
                      }
                }
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {withdrawals.length === 0 ? (
          <div
            className="card text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            No {statusFilter} withdrawals.
          </div>
        ) : (
          <ul className="flex flex-col gap-3 lg:gap-4">
            {withdrawals.map((w) => (
              <li key={w.id} className="card">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{w.user.name}</span>
                      <span className={`badge badge-${w.status}`}>
                        {statusIcon(w.status)}
                        {w.status}
                      </span>
                    </div>
                    <div className="text-sm mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {w.user.email}
                    </div>

                    <dl className="grid grid-cols-2 lg:grid-cols-[auto_auto_auto] gap-x-6 gap-y-2 mt-3 text-sm">
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Amount</dt>
                        <dd className="font-mono font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
                          ₱{w.amount.toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Method</dt>
                        <dd className="font-mono">
                          {w.method === "gcash" ? "GCash" : "Maya"} {w.accountNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Requested</dt>
                        <dd style={{ color: "var(--text-muted)" }}>
                          {fmtDateTime(w.requestedAt)}
                        </dd>
                      </div>
                    </dl>

                    {(w.processedAt || w.adminNote) && (
                      <div
                        className="mt-3 pt-3 border-t text-xs"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      >
                        {w.processedAt && (
                          <div>Processed {fmtDateTime(w.processedAt)}</div>
                        )}
                        {w.adminNote && (
                          <div className="mt-1">
                            <span style={{ color: "var(--text-subtle)" }}>Note:</span>{" "}
                            {w.adminNote}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {w.status === "pending" && (
                    <div className="flex flex-col gap-2 lg:min-w-64">
                      <input
                        className="input text-sm"
                        placeholder="Admin note (optional)"
                        value={note[w.id] ?? ""}
                        onChange={(e) =>
                          setNote((n) => ({ ...n, [w.id]: e.target.value }))
                        }
                        aria-label={`Admin note for ${w.user.name}`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => process(w.id, "approve")}
                          disabled={loading === w.id}
                          className="btn btn-success btn-sm flex-1"
                        >
                          {loading === w.id ? "…" : (
                            <>
                              <IconCheck size={14} /> Approve
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => process(w.id, "reject")}
                          disabled={loading === w.id}
                          className="btn btn-danger btn-sm flex-1"
                        >
                          {loading === w.id ? "…" : (
                            <>
                              <IconX size={14} /> Reject
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav
            className="flex items-center justify-center gap-1 mt-6"
            aria-label="Pagination"
          >
            <Link
              aria-label="Previous page"
              aria-disabled={page <= 1}
              href={`/admin/withdrawals?page=${Math.max(1, page - 1)}&status=${statusFilter}`}
              className="btn btn-icon"
              style={page <= 1 ? { pointerEvents: "none", opacity: 0.4 } : {}}
            >
              <IconArrowLeft size={16} />
            </Link>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/admin/withdrawals?page=${p}&status=${statusFilter}`}
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
            <Link
              aria-label="Next page"
              aria-disabled={page >= pages}
              href={`/admin/withdrawals?page=${Math.min(pages, page + 1)}&status=${statusFilter}`}
              className="btn btn-icon"
              style={page >= pages ? { pointerEvents: "none", opacity: 0.4 } : {}}
            >
              <IconArrowRight size={16} />
            </Link>
          </nav>
        )}
      </div>
    </div>
  );
}
