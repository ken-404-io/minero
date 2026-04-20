"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api-url";

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

export default function AdminWithdrawalsClient({ withdrawals, total, page, pages, statusFilter }: Props) {
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

  const tabs = ["pending", "approved", "rejected", "all"];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Withdrawals ({total})</h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/admin/withdrawals?status=${t}`}
            className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={
              t === statusFilter
                ? { background: "var(--gold)", color: "#000" }
                : { background: "var(--surface-2)", color: "var(--muted)" }
            }
          >
            {t}
          </Link>
        ))}
      </div>

      {withdrawals.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--muted)" }}>
          No {statusFilter} withdrawals.
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((w) => (
            <div key={w.id} className="card">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="font-bold">{w.user.name}</div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>{w.user.email}</div>
                  <div className="mt-1 text-sm">
                    <strong style={{ color: "var(--gold)" }}>₱{w.amount.toFixed(2)}</strong>
                    {" → "}
                    <span className="font-mono">{w.method === "gcash" ? "GCash" : "Maya"} {w.accountNumber}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Requested {new Date(w.requestedAt).toLocaleString("en-PH")}
                    {w.processedAt && ` · Processed ${new Date(w.processedAt).toLocaleString("en-PH")}`}
                    {w.adminNote && ` · Note: ${w.adminNote}`}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <span className={`badge badge-${w.status}`}>{w.status}</span>
                  {w.status === "pending" && (
                    <div className="flex flex-col gap-2 items-end">
                      <input
                        className="input text-xs w-48"
                        placeholder="Admin note (optional)"
                        value={note[w.id] ?? ""}
                        onChange={(e) => setNote((n) => ({ ...n, [w.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => process(w.id, "approve")}
                          disabled={loading === w.id}
                          className="text-xs px-4 py-2 rounded font-semibold"
                          style={{ background: "#0a2e1a", color: "#34d399" }}
                        >
                          {loading === w.id ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => process(w.id, "reject")}
                          disabled={loading === w.id}
                          className="text-xs px-4 py-2 rounded font-semibold"
                          style={{ background: "#2e0a0a", color: "#f87171" }}
                        >
                          {loading === w.id ? "…" : "Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/withdrawals?page=${p}&status=${statusFilter}`}
              className="w-8 h-8 flex items-center justify-center rounded text-sm"
              style={p === page ? { background: "var(--gold)", color: "#000" } : { background: "var(--surface-2)" }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
