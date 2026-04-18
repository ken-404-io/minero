"use client";

import Link from "next/link";

type Earning = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: Date;
};

type Props = {
  earnings: Earning[];
  total: number;
  page: number;
  pages: number;
  approvedTotal: number;
  pendingBalance: number;
};

function statusBadge(status: string) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function typeBadge(type: string) {
  return (
    <span
      className="text-xs font-medium"
      style={{ color: type === "mining" ? "var(--gold)" : "#60a5fa" }}
    >
      {type === "mining" ? "⛏ Mining" : "🤝 Referral"}
    </span>
  );
}

export default function EarningsClient({ earnings, total, page, pages, approvedTotal, pendingBalance }: Props) {
  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">Earnings History</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="card">
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Total Approved</div>
          <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>₱{approvedTotal.toFixed(4)}</div>
        </div>
        <div className="card">
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Pending Commissions</div>
          <div className="text-2xl font-bold" style={{ color: "var(--muted)" }}>₱{pendingBalance.toFixed(4)}</div>
        </div>
      </div>

      {earnings.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--muted)" }}>
          No earnings yet. Start claiming on the{" "}
          <Link href="/dashboard" className="hover:underline" style={{ color: "var(--gold)" }}>
            Dashboard
          </Link>
          .
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--muted)" }}>Type</th>
                <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--muted)" }}>Amount</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: "var(--muted)" }}>Status</th>
                <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--muted)" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-3 px-2">{typeBadge(e.type)}</td>
                  <td className="py-3 px-2 text-right font-mono font-bold" style={{ color: "var(--gold)" }}>
                    +₱{e.amount.toFixed(4)}
                  </td>
                  <td className="py-3 px-2 text-center">{statusBadge(e.status)}</td>
                  <td className="py-3 px-2 text-right text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(e.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/earnings?page=${p}`}
              className="w-8 h-8 flex items-center justify-center rounded text-sm font-medium"
              style={
                p === page
                  ? { background: "var(--gold)", color: "#000" }
                  : { background: "var(--surface-2)", color: "var(--foreground)" }
              }
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs mt-4 text-center" style={{ color: "var(--muted)" }}>
        {total} total records
      </p>
    </div>
  );
}
