"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconCheck,
  IconX,
  IconSparkles,
  IconError,
  IconClock,
} from "@/components/icons";

type PlanLog = {
  id: string;
  userId: string;
  plan: string;
  amountPaid: number;
  paymentRef: string | null;
  paymentProvider: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  user: { name: string; email: string; plan: string } | null;
};

type Props = {
  plans: PlanLog[];
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

const TABS = [
  { key: "pending",  label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all",      label: "All" },
];

export default function AdminPlansClient({
  plans, total, page, pages, statusFilter,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/plans/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note[id] }),
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
            Plan upgrades <span style={{ color: "var(--text-muted)" }}>({total.toLocaleString()})</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Manual review queue. Approval applies the user&apos;s new tier.
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
                href={`/admin/plans?status=${t.key}`}
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

        {plans.length === 0 ? (
          <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
            <IconSparkles size={28} className="mx-auto mb-2" />
            <p>No {statusFilter} upgrades.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 lg:gap-4">
            {plans.map((p) => (
              <li key={p.id} className="card">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{p.user?.name ?? "Unknown"}</span>
                      <span className={`badge badge-${p.status}`}>
                        {p.status === "pending" && <IconClock size={12} />}
                        {p.status === "approved" && <IconCheck size={12} />}
                        {p.status === "rejected" && <IconX size={12} />}
                        {p.status}
                      </span>
                    </div>
                    <div className="text-sm mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {p.user?.email}
                    </div>

                    <dl className="grid grid-cols-2 lg:grid-cols-[auto_auto_auto_auto] gap-x-6 gap-y-2 mt-3 text-sm">
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Target plan</dt>
                        <dd><span className={`badge badge-${p.plan}`}>{p.plan}</span></dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Amount</dt>
                        <dd className="font-mono font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
                          ₱{p.amountPaid.toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Reference</dt>
                        <dd className="font-mono text-xs">{p.paymentRef ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Submitted</dt>
                        <dd style={{ color: "var(--text-muted)" }}>{fmtDateTime(p.createdAt)}</dd>
                      </div>
                    </dl>

                    {(p.reviewedAt || p.adminNote) && (
                      <div
                        className="mt-3 pt-3 border-t text-xs"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      >
                        {p.reviewedAt && <div>Reviewed {fmtDateTime(p.reviewedAt)}</div>}
                        {p.adminNote && <div className="mt-1">Note: {p.adminNote}</div>}
                      </div>
                    )}
                  </div>

                  {p.status === "pending" && (
                    <div className="flex flex-col gap-2 lg:min-w-64">
                      <input
                        className="input text-sm"
                        placeholder="Admin note (optional)"
                        value={note[p.id] ?? ""}
                        onChange={(e) => setNote((n) => ({ ...n, [p.id]: e.target.value }))}
                        aria-label={`Admin note for ${p.user?.name}`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => act(p.id, "approve")}
                          disabled={busy === p.id}
                          className="btn btn-success btn-sm flex-1"
                        >
                          {busy === p.id ? "…" : (<><IconCheck size={14} /> Approve</>)}
                        </button>
                        <button
                          onClick={() => act(p.id, "reject")}
                          disabled={busy === p.id}
                          className="btn btn-danger btn-sm flex-1"
                        >
                          {busy === p.id ? "…" : (<><IconX size={14} /> Reject</>)}
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
          <nav className="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((pNum) => (
              <Link
                key={pNum}
                href={`/admin/plans?status=${statusFilter}&page=${pNum}`}
                aria-current={pNum === page ? "page" : undefined}
                className="h-9 min-w-9 px-2 flex items-center justify-center rounded-md text-sm font-medium"
                style={
                  pNum === page
                    ? { background: "var(--brand)", color: "var(--brand-fg)" }
                    : { background: "var(--surface-2)", color: "var(--text)" }
                }
              >
                {pNum}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
