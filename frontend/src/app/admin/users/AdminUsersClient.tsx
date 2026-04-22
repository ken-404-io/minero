"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api-url";
import {
  IconSearch,
  IconArrowLeft,
  IconArrowRight,
  IconShield,
  IconLock,
  IconCheck,
} from "@/components/icons";

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

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
      await fetch(`${API_URL}/admin/users/${userId}`, {
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

  const empty = users.length === 0;

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <span className="section-title">Admin</span>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
              Users <span style={{ color: "var(--text-muted)" }}>({total.toLocaleString()})</span>
            </h1>
          </div>
          <form onSubmit={doSearch} className="flex gap-2">
            <div className="relative flex-1 lg:w-72">
              <IconSearch
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 14,
                  color: "var(--text-subtle)",
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Search name or email…"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                aria-label="Search users"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
        </header>

        {empty ? (
          <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
            No users match your search.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <section
              className="card hidden lg:block"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Plan</th>
                      <th>Balance</th>
                      <th>Claims</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {u.email}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                            Joined {fmtDate(u.createdAt)}
                          </div>
                        </td>
                        <td><span className={`badge badge-${u.plan}`}>{u.plan}</span></td>
                        <td>
                          <div className="font-mono font-semibold tabular-nums">
                            ₱{u.balance.toFixed(2)}
                          </div>
                          <div
                            className="text-xs font-mono"
                            style={{ color: "var(--text-muted)" }}
                          >
                            +₱{u.pendingBalance.toFixed(2)} pending
                          </div>
                        </td>
                        <td className="font-mono tabular-nums">{u._count.claims}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {u.frozen ? (
                              <span className="badge badge-rejected">
                                <IconLock size={12} /> Frozen
                              </span>
                            ) : (
                              <span className="badge badge-approved">
                                <IconCheck size={12} /> Active
                              </span>
                            )}
                            {u.role === "admin" && (
                              <span className="badge badge-paid">
                                <IconShield size={12} /> Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right">
                          {u.role !== "admin" ? (
                            <button
                              onClick={() => toggleFreeze(u.id, u.frozen)}
                              disabled={loading === u.id}
                              className={`btn btn-sm ${u.frozen ? "btn-success" : "btn-danger"}`}
                            >
                              {loading === u.id ? "…" : u.frozen ? "Unfreeze" : "Freeze"}
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Mobile list */}
            <section className="lg:hidden flex flex-col gap-3">
              {users.map((u) => (
                <article key={u.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.name}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {u.email}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                      {u.frozen ? (
                        <span className="badge badge-rejected">
                          <IconLock size={12} /> Frozen
                        </span>
                      ) : (
                        <span className="badge badge-approved">
                          <IconCheck size={12} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div>
                      <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        Balance
                      </dt>
                      <dd className="font-mono font-semibold">
                        ₱{u.balance.toFixed(2)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        Pending
                      </dt>
                      <dd
                        className="font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ₱{u.pendingBalance.toFixed(2)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        Claims
                      </dt>
                      <dd className="font-mono">{u._count.claims}</dd>
                    </div>
                  </dl>
                  {u.role !== "admin" && (
                    <button
                      onClick={() => toggleFreeze(u.id, u.frozen)}
                      disabled={loading === u.id}
                      className={`mt-3 btn btn-sm w-full ${u.frozen ? "btn-success" : "btn-danger"}`}
                    >
                      {loading === u.id ? "…" : u.frozen ? "Unfreeze account" : "Freeze account"}
                    </button>
                  )}
                </article>
              ))}
            </section>
          </>
        )}

        {pages > 1 && <Pagination page={page} pages={pages} search={search} />}
      </div>
    </div>
  );
}

function Pagination({ page, pages, search }: { page: number; pages: number; search: string }) {
  return (
    <nav
      className="flex items-center justify-center gap-1 mt-6"
      aria-label="Pagination"
    >
      <Link
        aria-label="Previous page"
        aria-disabled={page <= 1}
        href={`/admin/users?page=${Math.max(1, page - 1)}&search=${encodeURIComponent(search)}`}
        className="btn btn-icon"
        style={page <= 1 ? { pointerEvents: "none", opacity: 0.4 } : {}}
      >
        <IconArrowLeft size={16} />
      </Link>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={`/admin/users?page=${p}&search=${encodeURIComponent(search)}`}
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
        href={`/admin/users?page=${Math.min(pages, page + 1)}&search=${encodeURIComponent(search)}`}
        className="btn btn-icon"
        style={page >= pages ? { pointerEvents: "none", opacity: 0.4 } : {}}
      >
        <IconArrowRight size={16} />
      </Link>
    </nav>
  );
}
