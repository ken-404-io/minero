"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  name: string;
  email: string;
  balance: number;
  pendingBalance: number;
  plan: string;
  role: string;
  frozen: boolean;
  createdAt: string | Date;
  _count: { claims: number };
};

type Props = {
  users: User[];
  total: number;
  page: number;
  pages: number;
  search: string;
};

export default function AdminUsersClient({ users, total, page, pages, search }: Props) {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState(search);
  const [loading, setLoading] = useState<string | null>(null);

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/users?search=${encodeURIComponent(searchVal)}`);
  }

  async function toggleFreeze(userId: string, frozen: boolean) {
    setLoading(userId);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frozen: !frozen }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Users ({total})</h1>
        <form onSubmit={doSearch} className="flex gap-2">
          <input
            className="input w-60 text-sm"
            placeholder="Search name or email…"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
          <button type="submit" className="btn-primary text-sm px-4 py-2">Search</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name / Email", "Plan", "Balance", "Claims", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-3 px-3">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{u.email}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    Joined {new Date(u.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                </td>
                <td className="py-3 px-3 font-mono text-xs">
                  <div>₱{u.balance.toFixed(2)}</div>
                  <div style={{ color: "var(--muted)" }}>+₱{u.pendingBalance.toFixed(2)} pending</div>
                </td>
                <td className="py-3 px-3">{u._count.claims}</td>
                <td className="py-3 px-3">
                  {u.frozen ? (
                    <span className="badge badge-rejected">Frozen</span>
                  ) : (
                    <span className="badge badge-approved">Active</span>
                  )}
                  {u.role === "admin" && (
                    <span className="badge ml-1" style={{ background: "#1a1230", color: "#a78bfa" }}>Admin</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  {u.role !== "admin" && (
                    <button
                      onClick={() => toggleFreeze(u.id, u.frozen)}
                      disabled={loading === u.id}
                      className="text-xs px-3 py-1.5 rounded font-semibold"
                      style={
                        u.frozen
                          ? { background: "#0a2e1a", color: "#34d399" }
                          : { background: "#2e0a0a", color: "#f87171" }
                      }
                    >
                      {loading === u.id ? "…" : u.frozen ? "Unfreeze" : "Freeze"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/users?page=${p}&search=${encodeURIComponent(search)}`}
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
