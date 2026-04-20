"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconPickaxe,
  IconUsers,
  IconArrowLeft,
  IconArrowRight,
  IconChart,
  IconCheck,
  IconClock,
  IconError,
} from "@/components/icons";

type Earning = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string | Date;
};

type Props = {
  earnings: Earning[];
  total: number;
  page: number;
  pages: number;
  approvedTotal: number;
  pendingBalance: number;
};

type StatusFilter = "all" | "approved" | "pending" | "rejected";
type TypeFilter = "all" | "mining" | "referral";

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function TypePill({ type }: { type: string }) {
  const isMining = type === "mining";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-md"
        style={{
          background: isMining ? "var(--brand-weak)" : "var(--info-weak)",
          color: isMining ? "var(--brand)" : "var(--info-fg)",
        }}
      >
        {isMining ? <IconPickaxe size={14} /> : <IconUsers size={14} />}
      </span>
      {isMining ? "Mining" : "Referral"}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved")
    return <IconCheck size={14} style={{ color: "var(--success-fg)" }} />;
  if (status === "pending")
    return <IconClock size={14} style={{ color: "var(--warning-fg)" }} />;
  return <IconError size={14} style={{ color: "var(--danger-fg)" }} />;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EarningsClient({
  earnings,
  total,
  page,
  pages,
  approvedTotal,
  pendingBalance,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = earnings.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    return true;
  });

  const empty = filtered.length === 0;

  return (
    <div className="w-full">
      {/* ============== DESKTOP (≥1024): filter rail + data table + summary ============== */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <header className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="section-title">Ledger</span>
              <h1 className="text-3xl font-bold tracking-tight mt-1">Earnings</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {total.toLocaleString()} total entries · showing page {page} of {pages || 1}
              </p>
            </div>
            <Link href="/withdraw" className="btn btn-primary btn-sm">
              Withdraw <IconArrowRight size={14} />
            </Link>
          </header>

          <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-6">
            {/* Filter rail */}
            <aside className="flex flex-col gap-4">
              <div className="kpi">
                <span className="kpi-label">Total approved</span>
                <span className="kpi-value kpi-value-brand">₱{approvedTotal.toFixed(4)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Pending</span>
                <span className="kpi-value" style={{ color: "var(--text-muted)" }}>
                  ₱{pendingBalance.toFixed(4)}
                </span>
                <span className="kpi-delta">Clears in 24–72h</span>
              </div>

              <div className="card">
                <div className="section-title mb-2">Type</div>
                <div role="radiogroup" aria-label="Filter by type" className="flex flex-col gap-1">
                  {([
                    ["all", "All types"],
                    ["mining", "Mining"],
                    ["referral", "Referral"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      role="radio"
                      aria-checked={typeFilter === val}
                      onClick={() => setTypeFilter(val)}
                      className="flex items-center justify-between text-sm px-2 py-2 rounded-md"
                      style={
                        typeFilter === val
                          ? { background: "var(--brand-weak)", color: "var(--brand-weak-fg)" }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      <span>{label}</span>
                      {typeFilter === val && <IconCheck size={14} />}
                    </button>
                  ))}
                </div>
                <div className="section-title mt-4 mb-2">Status</div>
                <div role="radiogroup" aria-label="Filter by status" className="flex flex-col gap-1">
                  {([
                    ["all", "All"],
                    ["approved", "Approved"],
                    ["pending", "Pending"],
                    ["rejected", "Rejected"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      role="radio"
                      aria-checked={statusFilter === val}
                      onClick={() => setStatusFilter(val)}
                      className="flex items-center justify-between text-sm px-2 py-2 rounded-md"
                      style={
                        statusFilter === val
                          ? { background: "var(--brand-weak)", color: "var(--brand-weak-fg)" }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      <span>{label}</span>
                      {statusFilter === val && <IconCheck size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Table */}
            <section className="card" style={{ padding: 0, overflow: "hidden" }}>
              {empty ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Status</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.id}>
                          <td><TypePill type={e.type} /></td>
                          <td><StatusBadge status={e.status} /></td>
                          <td
                            className="text-right font-mono font-semibold tabular-nums"
                            style={{ color: "var(--brand)" }}
                          >
                            +₱{e.amount.toFixed(4)}
                          </td>
                          <td
                            className="text-right text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {fmtDate(e.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pages > 1 && <Pagination page={page} pages={pages} />}
            </section>
          </div>
        </div>
      </div>

      {/* ============== MOBILE (<1024) — summary header + stream list ============== */}
      <div className="lg:hidden">
        <div className="px-4 pt-4 pb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-4">Earnings</h1>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="kpi" style={{ padding: "0.875rem" }}>
              <span className="kpi-label">Approved</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)", color: "var(--brand)" }}>
                ₱{approvedTotal.toFixed(2)}
              </span>
            </div>
            <div className="kpi" style={{ padding: "0.875rem" }}>
              <span className="kpi-label">Pending</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)", color: "var(--text-muted)" }}>
                ₱{pendingBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Horizontal filter chips */}
          <div
            className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-3 mb-1"
            style={{ scrollbarWidth: "none" }}
            role="tablist"
            aria-label="Filter earnings"
          >
            {([
              ["all", "All"],
              ["mining", "Mining"],
              ["referral", "Referral"],
              ["pending", "Pending"],
              ["approved", "Approved"],
            ] as const).map(([val, label]) => {
              const isActive =
                (val === "mining" || val === "referral")
                  ? typeFilter === val
                  : val === "all"
                  ? typeFilter === "all" && statusFilter === "all"
                  : statusFilter === val;
              return (
                <button
                  key={val}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (val === "all") {
                      setTypeFilter("all");
                      setStatusFilter("all");
                    } else if (val === "mining" || val === "referral") {
                      setTypeFilter(val as TypeFilter);
                    } else {
                      setStatusFilter(val as StatusFilter);
                    }
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border"
                  style={
                    isActive
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
                  {label}
                </button>
              );
            })}
          </div>

          {empty ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="surface p-3 flex items-center gap-3"
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                    style={{
                      background:
                        e.type === "mining" ? "var(--brand-weak)" : "var(--info-weak)",
                      color:
                        e.type === "mining" ? "var(--brand)" : "var(--info-fg)",
                    }}
                  >
                    {e.type === "mining" ? <IconPickaxe size={18} /> : <IconUsers size={18} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {e.type === "mining" ? "Mining reward" : "Referral commission"}
                    </div>
                    <div
                      className="text-xs flex items-center gap-1.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <StatusIcon status={e.status} />
                      <span className="capitalize">{e.status}</span>
                      <span aria-hidden>·</span>
                      <span>{fmtDate(e.createdAt)}</span>
                    </div>
                  </div>
                  <div
                    className="font-mono text-sm font-semibold tabular-nums"
                    style={{ color: "var(--brand)" }}
                  >
                    +₱{e.amount.toFixed(4)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && <Pagination page={page} pages={pages} />}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 px-6 text-center">
      <div
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-3"
        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
      >
        <IconChart size={22} />
      </div>
      <h2 className="font-semibold mb-1">No earnings yet</h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Start claiming rewards on the Mine tab.
      </p>
      <Link href="/dashboard" className="btn btn-primary btn-sm inline-flex">
        Go to Mine <IconArrowRight size={14} />
      </Link>
    </div>
  );
}

function Pagination({ page, pages }: { page: number; pages: number }) {
  return (
    <nav
      className="flex items-center justify-center gap-1 py-4"
      aria-label="Pagination"
    >
      <Link
        aria-label="Previous page"
        aria-disabled={page <= 1}
        href={`/earnings?page=${Math.max(1, page - 1)}`}
        className="btn btn-icon"
        style={page <= 1 ? { pointerEvents: "none", opacity: 0.4 } : {}}
      >
        <IconArrowLeft size={16} />
      </Link>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={`/earnings?page=${p}`}
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
        href={`/earnings?page=${Math.min(pages, page + 1)}`}
        className="btn btn-icon"
        style={page >= pages ? { pointerEvents: "none", opacity: 0.4 } : {}}
      >
        <IconArrowRight size={16} />
      </Link>
    </nav>
  );
}
