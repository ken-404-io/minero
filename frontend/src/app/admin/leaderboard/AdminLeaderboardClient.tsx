"use client";

import { useState } from "react";
import Link from "next/link";
import { IconTrophy, IconArrowLeft, IconArrowRight, IconLock } from "@/components/icons";
import AdminUserDrawer from "../AdminUserDrawer";

const ONLINE_MS = 2 * 60 * 1000;
function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_MS;
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

type LeaderboardUser = {
  id: string;
  name: string;
  email: string;
  plan: string;
  balance: number;
  pendingBalance: number;
  frozen: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

type Props = {
  users: LeaderboardUser[];
  total: number;
  page: number;
  pages: number;
};

export default function AdminLeaderboardClient({ users, total, page, pages }: Props) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const pageOffset = (page - 1) * 50;
  const topBalance = users[0]?.balance ?? 0;

  return (
    <>
      <div className="w-full">
        <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
          <header className="mb-6">
            <span className="section-title">Admin</span>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1 flex items-center gap-2">
              <IconTrophy size={26} style={{ color: "var(--brand)" }} />
              Leaderboard
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              All {total.toLocaleString()} users ranked by wallet balance (₱)
            </p>
          </header>

          {users.length === 0 ? (
            <div className="card text-center py-16" style={{ color: "var(--text-muted)" }}>No users yet.</div>
          ) : (
            <>
              {/* Desktop table */}
              <section className="card hidden lg:block" style={{ padding: 0, overflow: "hidden" }}>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Rank</th>
                        <th>Member</th>
                        <th>Plan</th>
                        <th>Balance</th>
                        <th>Pending</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => {
                        const rank = pageOffset + i + 1;
                        const m = medal(rank);
                        const online = isOnline(u.lastSeenAt);
                        const barPct = topBalance > 0 ? (u.balance / topBalance) * 100 : 0;
                        return (
                          <tr key={u.id}>
                            <td>
                              <div className="flex items-center justify-center font-mono font-bold text-base"
                                style={{ color: m ? undefined : "var(--text-muted)" }}>
                                {m ?? `#${rank}`}
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                {online && (
                                  <span aria-label="Online" title="Online now"
                                    className="inline-block h-2 w-2 rounded-full flex-shrink-0 animate-pulse"
                                    style={{ background: "var(--success-fg)" }} />
                                )}
                                <div>
                                  <div className="font-medium">{u.name}</div>
                                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className={`badge badge-${u.plan}`}>{u.plan}</span></td>
                            <td>
                              <div className="font-mono font-bold tabular-nums" style={{ color: "var(--brand)" }}>
                                ₱{u.balance.toFixed(2)}
                              </div>
                              <div className="progress mt-1" style={{ width: 80 }}>
                                <div className="progress-bar" style={{ width: `${barPct}%` }} />
                              </div>
                            </td>
                            <td className="font-mono tabular-nums text-sm" style={{ color: "var(--text-muted)" }}>
                              ₱{u.pendingBalance.toFixed(2)}
                            </td>
                            <td>
                              {u.frozen
                                ? <span className="badge badge-rejected"><IconLock size={12} /> Frozen</span>
                                : <span className="badge badge-approved">Active</span>}
                            </td>
                            <td className="text-right">
                              <button onClick={() => setActiveUserId(u.id)} className="btn btn-secondary btn-sm">
                                Manage
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Mobile list */}
              <section className="lg:hidden flex flex-col gap-3">
                {users.map((u, i) => {
                  const rank = pageOffset + i + 1;
                  const m = medal(rank);
                  const online = isOnline(u.lastSeenAt);
                  const barPct = topBalance > 0 ? (u.balance / topBalance) * 100 : 0;
                  return (
                    <article key={u.id} className="card">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="font-mono font-bold text-lg w-10 text-center flex-shrink-0"
                          style={{ color: m ? undefined : "var(--text-muted)" }}>
                          {m ?? `#${rank}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {online && (
                              <span aria-label="Online"
                                className="inline-block h-2 w-2 rounded-full flex-shrink-0 animate-pulse"
                                style={{ background: "var(--success-fg)" }} />
                            )}
                            <div className="font-medium truncate">{u.name}</div>
                          </div>
                          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</div>
                        </div>
                        <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-mono font-bold" style={{ color: "var(--brand)" }}>₱{u.balance.toFixed(2)}</div>
                          <div className="progress mt-1">
                            <div className="progress-bar" style={{ width: `${barPct}%` }} />
                          </div>
                          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>+₱{u.pendingBalance.toFixed(2)} pending</div>
                        </div>
                        {u.frozen && <span className="badge badge-rejected"><IconLock size={12} /> Frozen</span>}
                      </div>
                      <button onClick={() => setActiveUserId(u.id)}
                        className="btn btn-secondary btn-sm w-full">
                        Manage
                      </button>
                    </article>
                  );
                })}
              </section>

              {pages > 1 && <LeaderboardPagination page={page} pages={pages} />}
            </>
          )}
        </div>
      </div>

      <AdminUserDrawer userId={activeUserId} onClose={() => setActiveUserId(null)} />
    </>
  );
}

function LeaderboardPagination({ page, pages }: { page: number; pages: number }) {
  const visiblePages = Array.from({ length: pages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2);

  return (
    <nav className="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
      <Link aria-label="Previous page" aria-disabled={page <= 1}
        href={`/admin/leaderboard?page=${Math.max(1, page - 1)}`}
        className="btn btn-icon" style={page <= 1 ? { pointerEvents: "none", opacity: 0.4 } : {}}>
        <IconArrowLeft size={16} />
      </Link>
      {visiblePages.map((p, idx) => (
        <span key={p}>
          {idx > 0 && visiblePages[idx - 1] !== p - 1 && (
            <span className="px-1 text-sm" style={{ color: "var(--text-muted)" }}>…</span>
          )}
          <Link href={`/admin/leaderboard?page=${p}`} aria-current={p === page ? "page" : undefined}
            className="h-9 min-w-9 px-2 flex items-center justify-center rounded-md text-sm font-medium"
            style={p === page ? { background: "var(--brand)", color: "var(--brand-fg)" } : { background: "var(--surface-2)", color: "var(--text)" }}>
            {p}
          </Link>
        </span>
      ))}
      <Link aria-label="Next page" aria-disabled={page >= pages}
        href={`/admin/leaderboard?page=${Math.min(pages, page + 1)}`}
        className="btn btn-icon" style={page >= pages ? { pointerEvents: "none", opacity: 0.4 } : {}}>
        <IconArrowRight size={16} />
      </Link>
    </nav>
  );
}
